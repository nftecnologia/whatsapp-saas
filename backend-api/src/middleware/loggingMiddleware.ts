import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID
  req.id = uuidv4();
  req.startTime = Date.now();

  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id,
    companyId: req.company?.id,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer'),
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(this: Response, ...args: any[]) {
    const responseTime = Date.now() - (req.startTime || Date.now());
    
    // Log the response
    logger.logRequest(req, res, responseTime);
    
    // Call original end method
    originalEnd.apply(this, args);
  };

  next();
};

export const errorLoggingMiddleware = (error: any, req: Request, res: Response, next: NextFunction) => {
  const responseTime = Date.now() - (req.startTime || Date.now());
  
  logger.error('Request error', {
    requestId: req.id,
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime,
    userId: req.user?.id,
    companyId: req.company?.id,
  });

  next(error);
};

// Middleware to sanitize sensitive data from logs
export const sanitizeLogsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Remove sensitive data from request body for logging
  if (req.body) {
    const sanitizedBody = { ...req.body };
    
    // Remove password fields
    if (sanitizedBody.password) {
      sanitizedBody.password = '[REDACTED]';
    }
    if (sanitizedBody.current_password) {
      sanitizedBody.current_password = '[REDACTED]';
    }
    if (sanitizedBody.new_password) {
      sanitizedBody.new_password = '[REDACTED]';
    }
    if (sanitizedBody.confirm_password) {
      sanitizedBody.confirm_password = '[REDACTED]';
    }
    
    // Remove token fields
    if (sanitizedBody.token) {
      sanitizedBody.token = '[REDACTED]';
    }
    if (sanitizedBody.access_token) {
      sanitizedBody.access_token = '[REDACTED]';
    }
    if (sanitizedBody.refresh_token) {
      sanitizedBody.refresh_token = '[REDACTED]';
    }
    
    req.sanitizedBody = sanitizedBody;
  }

  next();
};

// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Log slow requests (>1 second)
    if (duration > 1000) {
      logger.logPerformance(`HTTP ${req.method} ${req.route?.path || req.originalUrl}`, duration, {
        requestId: req.id,
        statusCode: res.statusCode,
        userId: req.user?.id,
        companyId: req.company?.id,
      });
    }
    
    // Track business metrics
    if (req.route) {
      logger.logBusinessMetric(
        'http_request_duration',
        duration,
        'milliseconds',
        {
          method: req.method,
          route: req.route.path,
          status_code: res.statusCode.toString(),
          status_class: `${Math.floor(res.statusCode / 100)}xx`,
        }
      );
    }
  });

  next();
};

// Rate limiting logging middleware
export const rateLimitLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(this: Response, body: any) {
    // Check if this is a rate limit response
    if (res.statusCode === 429) {
      logger.logSecurity('rate_limit_exceeded', {
        requestId: req.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        userId: req.user?.id,
        companyId: req.company?.id,
      });
    }
    
    return originalSend.call(this, body);
  };

  next();
};

// Database operation logging wrapper
export const logDatabaseOperation = async <T>(
  operation: string,
  query: string,
  params: any[],
  execution: () => Promise<T>
): Promise<T> => {
  const startTime = Date.now();
  
  try {
    const result = await execution();
    const duration = Date.now() - startTime;
    
    logger.logDatabaseQuery(query, params, duration);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabaseQuery(query, params, duration, error as Error);
    throw error;
  }
};

// Redis operation logging wrapper
export const logRedisOperation = async <T>(
  operation: string,
  key: string,
  execution: () => Promise<T>
): Promise<T> => {
  const startTime = Date.now();
  
  try {
    const result = await execution();
    const duration = Date.now() - startTime;
    
    logger.logRedisOperation(operation, key, duration);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logRedisOperation(operation, key, duration, error as Error);
    throw error;
  }
};

// Structured error logging
export const logStructuredError = (
  error: Error,
  context: {
    operation?: string;
    userId?: string;
    companyId?: string;
    requestId?: string;
    metadata?: Record<string, any>;
  }
) => {
  logger.error(`Operation failed: ${context.operation || 'unknown'}`, {
    error: error.message,
    stack: error.stack,
    ...context,
  });
};

// Business event logging
export const logBusinessEvent = (
  event: string,
  details: Record<string, any> = {},
  userId?: string,
  companyId?: string
) => {
  logger.info(`Business event: ${event}`, {
    event,
    userId,
    companyId,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Security event logging
export const logSecurityEvent = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, any> = {}
) => {
  const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  
  logger[logLevel](`Security event: ${event}`, {
    securityEvent: event,
    severity,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Middleware to log authentication events
export const authLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(this: Response, body: any) {
    try {
      const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
      
      // Log successful authentication
      if (res.statusCode === 200 && req.path.includes('/auth/')) {
        const action = req.path.includes('/login') ? 'login' :
                     req.path.includes('/register') ? 'register' :
                     req.path.includes('/logout') ? 'logout' : 'auth';
        
        logger.logAuth(
          action as any,
          parsedBody.data?.user?.id,
          parsedBody.data?.user?.email || req.body?.email,
          true
        );
      }
      
      // Log failed authentication
      if (res.statusCode === 401 || res.statusCode === 403) {
        logger.logAuth(
          'login',
          undefined,
          req.body?.email,
          false,
          parsedBody.message || 'Authentication failed'
        );
      }
    } catch (error) {
      // Ignore JSON parsing errors
    }
    
    return originalSend.call(this, body);
  };

  next();
};