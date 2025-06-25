import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthUser } from '@/types';
import { audit, AuditEventType } from './auditLogger';
import redis from '@/config/redis';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: string;
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    audit.logSecurityEvent(req, AuditEventType.UNAUTHORIZED_ACCESS, {
      reason: 'Missing access token',
    });
    return res.status(401).json({
      success: false,
      message: 'Access token required',
      error: 'MISSING_TOKEN',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
    
    // Verify token integrity
    if (!decoded.id || !decoded.email) {
      throw new Error('Invalid token payload');
    }
    
    req.user = decoded;
    req.token = token;
    
    next();
  } catch (error: any) {
    audit.logSecurityEvent(req, AuditEventType.UNAUTHORIZED_ACCESS, {
      reason: 'Invalid or expired token',
      error: error.message,
      tokenHash: hashToken(token),
    });
    
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
      error: 'INVALID_TOKEN',
      timestamp: new Date().toISOString(),
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      audit.logSecurityEvent(req, AuditEventType.UNAUTHORIZED_ACCESS, {
        reason: 'Authentication required for role check',
        requiredRoles: roles,
      });
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED',
        timestamp: new Date().toISOString(),
      });
    }

    if (!roles.includes(req.user.role)) {
      audit.logSecurityEvent(req, AuditEventType.PERMISSION_DENIED, {
        reason: 'Insufficient role permissions',
        userRole: req.user.role,
        requiredRoles: roles,
        userId: req.user.id,
      });
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'INSUFFICIENT_PERMISSIONS',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

// Company-based authorization
export const requireCompanyAccess = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED',
        timestamp: new Date().toISOString(),
      });
    }

    const resourceCompanyId = req.params.companyId || req.body.company_id || req.query.company_id;
    
    if (resourceCompanyId && resourceCompanyId !== req.user.company_id && req.user.role !== 'admin') {
      audit.logSecurityEvent(req, AuditEventType.PERMISSION_DENIED, {
        reason: 'Attempted access to different company data',
        userCompanyId: req.user.company_id,
        requestedCompanyId: resourceCompanyId,
        userId: req.user.id,
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied to company resources',
        error: 'COMPANY_ACCESS_DENIED',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

// Resource ownership validation
export const requireResourceOwnership = (resourceType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED',
        timestamp: new Date().toISOString(),
      });
    }

    // Skip ownership check for admins
    if (req.user.role === 'admin') {
      return next();
    }

    // For non-admin users, ensure they can only access their own resources
    const resourceUserId = req.params.userId || req.body.user_id || req.query.user_id;
    
    if (resourceUserId && resourceUserId !== req.user.id) {
      audit.logSecurityEvent(req, AuditEventType.PERMISSION_DENIED, {
        reason: 'Attempted access to other user resources',
        userId: req.user.id,
        requestedUserId: resourceUserId,
        resourceType,
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied to user resources',
        error: 'RESOURCE_ACCESS_DENIED',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

// Token management functions
export const blacklistToken = async (token: string): Promise<void> => {
  const tokenHash = hashToken(token);
  const decoded = jwt.decode(token) as any;
  
  if (decoded && decoded.exp) {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.setEx(`blacklist:${tokenHash}`, ttl, '1');
    }
  }
};

async function isTokenBlacklisted(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const result = await redis.get(`blacklist:${tokenHash}`);
  return result === '1';
}

// Track token usage for security monitoring
async function trackTokenUsage(token: string, userId: string, ip: string): Promise<void> {
  const tokenHash = hashToken(token);
  const key = `token_usage:${tokenHash}`;
  
  const usage = {
    userId,
    ip,
    timestamp: new Date().toISOString(),
    count: 1,
  };
  
  const existing = await redis.get(key);
  if (existing) {
    const existingUsage = JSON.parse(existing);
    usage.count = existingUsage.count + 1;
    
    // Detect suspicious activity (same token used from different IPs)
    if (existingUsage.ip !== ip) {
      audit.log({
        eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
        userId,
        ip,
        action: 'Token used from different IP',
        details: {
          tokenHash,
          previousIp: existingUsage.ip,
          currentIp: ip,
          usageCount: usage.count,
        },
      }, 'warn' as any);
    }
  }
  
  await redis.setEx(key, 3600, JSON.stringify(usage)); // Store for 1 hour
}

// Hash token for secure storage and logging
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
}

// Session timeout middleware
export const sessionTimeout = (timeoutMinutes: number = 30) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.token) {
      return next();
    }

    const sessionKey = `session:${req.user.id}:${hashToken(req.token)}`;
    const lastActivity = await redis.get(sessionKey);
    
    if (lastActivity) {
      const lastActivityTime = new Date(lastActivity).getTime();
      const now = Date.now();
      const timeDiff = (now - lastActivityTime) / (1000 * 60); // minutes
      
      if (timeDiff > timeoutMinutes) {
        await blacklistToken(req.token);
        audit.logAuthEvent(req, AuditEventType.LOGOUT, {
          reason: 'Session timeout',
          timeoutMinutes,
          lastActivity,
        });
        return res.status(401).json({
          success: false,
          message: 'Session has expired due to inactivity',
          error: 'SESSION_TIMEOUT',
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    // Update last activity
    await redis.setEx(sessionKey, timeoutMinutes * 60, new Date().toISOString());
    next();
  };
};