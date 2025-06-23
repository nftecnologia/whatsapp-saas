import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import crypto from 'crypto';
import { AuthUser } from '@/types';

// Audit log levels
export enum AuditLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// Audit event types
export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGOUT = 'auth.logout',
  TOKEN_REFRESH = 'auth.token.refresh',
  PASSWORD_CHANGE = 'auth.password.change',
  PASSWORD_RESET = 'auth.password.reset',
  
  // Data access events
  DATA_CREATE = 'data.create',
  DATA_READ = 'data.read',
  DATA_UPDATE = 'data.update',
  DATA_DELETE = 'data.delete',
  DATA_EXPORT = 'data.export',
  
  // Security events
  RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  SUSPICIOUS_ACTIVITY = 'security.suspicious.activity',
  IP_BLOCKED = 'security.ip.blocked',
  UNAUTHORIZED_ACCESS = 'security.unauthorized.access',
  PERMISSION_DENIED = 'security.permission.denied',
  
  // System events
  SYSTEM_ERROR = 'system.error',
  SYSTEM_WARNING = 'system.warning',
  API_KEY_USED = 'system.api_key.used',
  INTEGRATION_ERROR = 'integration.error',
  
  // Business events
  CAMPAIGN_CREATED = 'business.campaign.created',
  CAMPAIGN_SENT = 'business.campaign.sent',
  MESSAGE_SENT = 'business.message.sent',
  CONTACT_IMPORTED = 'business.contact.imported',
  TEMPLATE_CREATED = 'business.template.created',
}

// Audit log entry interface
interface AuditLogEntry {
  timestamp: string;
  requestId: string;
  eventType: AuditEventType;
  level: AuditLevel;
  userId?: string;
  userEmail?: string;
  companyId?: string;
  ip: string;
  userAgent: string;
  method: string;
  path: string;
  statusCode?: number;
  duration?: number;
  resource?: string;
  resourceId?: string;
  action: string;
  details?: Record<string, any>;
  sensitive?: boolean;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
  risk_score?: number;
}

// Configure Winston logger for audit logs
const createAuditLogger = () => {
  // Create logs directory if it doesn't exist
  const logsDir = process.env.LOGS_DIR || './audit-logs';
  
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf((info) => {
        return JSON.stringify({
          timestamp: info.timestamp,
          level: info.level,
          ...info,
        });
      })
    ),
    transports: [
      // Daily rotate file for audit logs
      new DailyRotateFile({
        filename: path.join(logsDir, 'audit-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        zippedArchive: true,
        level: 'info',
      }),
      
      // Separate file for security events
      new DailyRotateFile({
        filename: path.join(logsDir, 'security-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '90d',
        zippedArchive: true,
        level: 'warn',
      }),
      
      // Critical events go to a separate file
      new DailyRotateFile({
        filename: path.join(logsDir, 'critical-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: '365d',
        zippedArchive: true,
        level: 'error',
      }),
    ],
  });

  // Add console transport in development
  if (process.env.NODE_ENV === 'development') {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }));
  }

  return logger;
};

const auditLogger = createAuditLogger();

// Audit logging class
class AuditLogger {
  private static instance: AuditLogger;
  private logger: winston.Logger;

  private constructor() {
    this.logger = auditLogger;
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  // Log audit event
  public log(entry: Partial<AuditLogEntry>, level: AuditLevel = AuditLevel.INFO): void {
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      requestId: entry.requestId || this.generateRequestId(),
      eventType: entry.eventType || AuditEventType.SYSTEM_ERROR,
      level,
      ip: entry.ip || 'unknown',
      userAgent: entry.userAgent || 'unknown',
      method: entry.method || 'unknown',
      path: entry.path || 'unknown',
      action: entry.action || 'unknown',
      ...entry,
    };

    // Calculate risk score
    auditEntry.risk_score = this.calculateRiskScore(auditEntry);

    // Log based on level
    switch (level) {
      case AuditLevel.INFO:
        this.logger.info(auditEntry);
        break;
      case AuditLevel.WARN:
        this.logger.warn(auditEntry);
        break;
      case AuditLevel.ERROR:
        this.logger.error(auditEntry);
        break;
      case AuditLevel.CRITICAL:
        this.logger.error(auditEntry);
        this.handleCriticalEvent(auditEntry);
        break;
    }
  }

  // Calculate risk score based on various factors
  private calculateRiskScore(entry: AuditLogEntry): number {
    let score = 0;

    // High risk events
    const highRiskEvents = [
      AuditEventType.LOGIN_FAILED,
      AuditEventType.UNAUTHORIZED_ACCESS,
      AuditEventType.PERMISSION_DENIED,
      AuditEventType.SUSPICIOUS_ACTIVITY,
      AuditEventType.IP_BLOCKED,
    ];

    if (highRiskEvents.includes(entry.eventType)) {
      score += 30;
    }

    // Failed requests
    if (entry.statusCode && entry.statusCode >= 400) {
      score += 20;
    }

    // Multiple failed attempts from same IP
    if (entry.eventType === AuditEventType.LOGIN_FAILED) {
      score += 25;
    }

    // Sensitive operations
    if (entry.sensitive) {
      score += 15;
    }

    // Admin operations
    if (entry.path?.includes('/admin/')) {
      score += 10;
    }

    return Math.min(score, 100); // Cap at 100
  }

  private handleCriticalEvent(entry: AuditLogEntry): void {
    // In production, you might want to:
    // - Send alerts to monitoring systems
    // - Notify security team
    // - Trigger automated responses
    console.error('🚨 CRITICAL SECURITY EVENT:', entry);
  }

  private generateRequestId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Convenience methods for different event types
  public logAuthEvent(req: Request, eventType: AuditEventType, details?: Record<string, any>): void {
    this.log({
      requestId: req.headers['x-request-id'] as string,
      eventType,
      userId: req.user?.id,
      userEmail: req.user?.email,
      companyId: req.user?.company_id,
      ip: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      method: req.method,
      path: req.path,
      action: `${req.method} ${req.path}`,
      details,
      sensitive: true,
    }, AuditLevel.INFO);
  }

  public logDataAccess(
    req: Request, 
    res: Response, 
    resource: string, 
    resourceId?: string, 
    details?: Record<string, any>
  ): void {
    let eventType: AuditEventType;
    
    switch (req.method) {
      case 'GET':
        eventType = AuditEventType.DATA_READ;
        break;
      case 'POST':
        eventType = AuditEventType.DATA_CREATE;
        break;
      case 'PUT':
      case 'PATCH':
        eventType = AuditEventType.DATA_UPDATE;
        break;
      case 'DELETE':
        eventType = AuditEventType.DATA_DELETE;
        break;
      default:
        eventType = AuditEventType.DATA_READ;
    }

    this.log({
      requestId: req.headers['x-request-id'] as string,
      eventType,
      userId: req.user?.id,
      userEmail: req.user?.email,
      companyId: req.user?.company_id,
      ip: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      resource,
      resourceId,
      action: `${req.method} ${resource}${resourceId ? `/${resourceId}` : ''}`,
      details,
      sensitive: this.isSensitiveResource(resource),
    }, this.getLevelFromStatusCode(res.statusCode));
  }

  public logSecurityEvent(
    req: Request, 
    eventType: AuditEventType, 
    details?: Record<string, any>
  ): void {
    this.log({
      requestId: req.headers['x-request-id'] as string,
      eventType,
      userId: req.user?.id,
      userEmail: req.user?.email,
      companyId: req.user?.company_id,
      ip: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      method: req.method,
      path: req.path,
      action: eventType,
      details,
      sensitive: true,
    }, AuditLevel.WARN);
  }

  public logBusinessEvent(
    req: Request, 
    eventType: AuditEventType, 
    resource: string,
    resourceId?: string,
    details?: Record<string, any>
  ): void {
    this.log({
      requestId: req.headers['x-request-id'] as string,
      eventType,
      userId: req.user?.id,
      userEmail: req.user?.email,
      companyId: req.user?.company_id,
      ip: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      method: req.method,
      path: req.path,
      resource,
      resourceId,
      action: `${eventType} ${resource}${resourceId ? `/${resourceId}` : ''}`,
      details,
    }, AuditLevel.INFO);
  }

  private getClientIP(req: Request): string {
    return req.clientIP || 
           req.ip || 
           req.connection.remoteAddress || 
           (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
           'unknown';
  }

  private getLevelFromStatusCode(statusCode: number): AuditLevel {
    if (statusCode >= 500) return AuditLevel.ERROR;
    if (statusCode >= 400) return AuditLevel.WARN;
    return AuditLevel.INFO;
  }

  private isSensitiveResource(resource: string): boolean {
    const sensitiveResources = ['users', 'auth', 'companies', 'integrations'];
    return sensitiveResources.some(sr => resource.includes(sr));
  }
}

// Express middleware for automatic audit logging
export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const audit = AuditLogger.getInstance();

  // Log the request
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    
    // Log based on route and method
    if (req.path.startsWith('/api/')) {
      const pathParts = req.path.split('/');
      const resource = pathParts[2] || 'unknown';
      const resourceId = pathParts[3];
      
      audit.logDataAccess(req, res, resource, resourceId, {
        query: req.query,
        body: req.method !== 'GET' ? this.sanitizeBody(req.body) : undefined,
        duration,
      });
    }
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Sanitize request body for logging (remove sensitive data)
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  const sanitized = { ...body };
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '***REDACTED***';
    }
  });
  
  return sanitized;
}

// Export singleton instance
export const audit = AuditLogger.getInstance();
export { AuditEventType, AuditLevel };
export default audit;