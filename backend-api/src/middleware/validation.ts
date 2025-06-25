import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { audit, AuditEventType } from './auditLogger';

// Initialize DOMPurify for server-side XSS protection
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

interface ValidationConfig {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  files?: z.ZodSchema;
  headers?: z.ZodSchema;
  strict?: boolean; // If true, reject unknown properties
  sanitize?: boolean; // If true, sanitize input data
}

export const validateRequest = (config: ValidationConfig) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors: Array<{ field: string; message: string; code?: string }> = [];
      
      // Validate and transform body
      if (config.body) {
        try {
          const parsed = config.body.parse(req.body);
          req.body = config.sanitize ? sanitizeObject(parsed) : parsed;
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(...formatZodErrors(error, 'body'));
          }
        }
      }
      
      // Validate and transform query parameters
      if (config.query) {
        try {
          const parsed = config.query.parse(req.query);
          req.query = config.sanitize ? sanitizeObject(parsed) : parsed;
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(...formatZodErrors(error, 'query'));
          }
        }
      }
      
      // Validate and transform path parameters
      if (config.params) {
        try {
          const parsed = config.params.parse(req.params);
          req.params = config.sanitize ? sanitizeObject(parsed) : parsed;
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(...formatZodErrors(error, 'params'));
          }
        }
      }
      
      // Validate files if present
      if (config.files && req.files) {
        try {
          config.files.parse(req.files);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(...formatZodErrors(error, 'files'));
          }
        }
      }
      
      // Validate headers if specified
      if (config.headers) {
        try {
          config.headers.parse(req.headers);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(...formatZodErrors(error, 'headers'));
          }
        }
      }
      
      // SQL Injection detection
      if (config.body && containsSQLInjection(req.body)) {
        audit.logSecurityEvent(req, AuditEventType.SUSPICIOUS_ACTIVITY, {
          reason: 'SQL injection attempt detected in request body',
          body: req.body,
        });
        return res.status(400).json({
          success: false,
          message: 'Potentially dangerous input detected',
          error: 'INVALID_INPUT',
          timestamp: new Date().toISOString(),
        });
      }
      
      if (config.query && containsSQLInjection(req.query)) {
        audit.logSecurityEvent(req, AuditEventType.SUSPICIOUS_ACTIVITY, {
          reason: 'SQL injection attempt detected in query parameters',
          query: req.query,
        });
        return res.status(400).json({
          success: false,
          message: 'Potentially dangerous input detected',
          error: 'INVALID_INPUT',
          timestamp: new Date().toISOString(),
        });
      }
      
      // Return validation errors if any
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
          timestamp: new Date().toISOString(),
        });
      }
      
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal validation error',
        timestamp: new Date().toISOString(),
      });
    }
  };
};

// Format Zod errors with better structure
function formatZodErrors(error: z.ZodError, section: string): Array<{ field: string; message: string; code?: string }> {
  return error.errors.map(err => ({
    field: section + (err.path.length > 0 ? '.' + err.path.join('.') : ''),
    message: err.message,
    code: err.code,
  }));
}

// Enhanced sanitization with comprehensive XSS and injection protection
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key names too
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Comprehensive string sanitization
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  
  // Use DOMPurify for comprehensive XSS protection
  let sanitized = purify.sanitize(str, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  });
  
  // Additional security layers
  sanitized = String(sanitized)
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/eval\s*\(/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/url\s*\(/gi, '')
    .replace(/import\s*\(/gi, '')
    .trim();
  
  return sanitized;
}

// Specific validators for common patterns
export const validateUuid = (paramName: string = 'id') => {
  const UuidSchema = z.object({
    [paramName]: z.string().uuid(`Invalid ${paramName} format`),
  });
  
  return validateRequest({ params: UuidSchema });
};

export const validatePagination = validateRequest({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
});

export const validateIdParam = validateUuid('id');

// Advanced validation with custom error handling
export const validateWithCustomErrors = (
  schema: z.ZodSchema,
  customErrors: Record<string, string> = {}
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => {
          const fieldPath = err.path.join('.');
          return {
            field: fieldPath,
            message: customErrors[fieldPath] || customErrors[err.code] || err.message,
            code: err.code,
          };
        });
        
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
          timestamp: new Date().toISOString(),
        });
      }
      
      req.body = result.data;
      next();
    } catch (error) {
      console.error('Custom validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal validation error',
        timestamp: new Date().toISOString(),
      });
    }
  };
};

// File upload validation
// Legacy file upload validation (kept for backward compatibility)
// Moved after validateSecureFileUpload definition

// Rate limiting validation (to be used with rate limiting middleware)
export const validateRateLimit = (identifier: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add rate limit identifier to request for tracking
    req.rateLimit = { identifier };
    next();
  };
};

// Security headers validation
export const validateSecurityHeaders = validateRequest({
  headers: z.object({
    'content-type': z.string().optional(),
    'user-agent': z.string().min(1, 'User-Agent header is required'),
    'x-forwarded-for': z.string().optional(),
    'x-real-ip': z.string().optional(),
    'authorization': z.string().optional(),
    'x-stack-auth-token': z.string().optional(),
    'x-api-key': z.string().optional(),
    'x-request-id': z.string().optional(),
  }),
});

// Enhanced file upload validation with virus scanning simulation
export const validateSecureFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  required?: boolean;
  scanForVirus?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { 
      maxSize = 10 * 1024 * 1024, 
      allowedTypes = [], 
      allowedExtensions = [],
      required = false,
      scanForVirus = true 
    } = options;
    
    if (required && (!req.files || Object.keys(req.files).length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'File upload is required',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (req.files) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      
      for (const file of files) {
        // Size validation
        if (file.size > maxSize) {
          audit.logSecurityEvent(req, AuditEventType.SUSPICIOUS_ACTIVITY, {
            reason: 'File size exceeds limit',
            filename: file.name,
            size: file.size,
            maxSize,
          });
          return res.status(400).json({
            success: false,
            message: `File size exceeds limit of ${maxSize} bytes`,
            timestamp: new Date().toISOString(),
          });
        }
        
        // MIME type validation
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
          audit.logSecurityEvent(req, AuditEventType.SUSPICIOUS_ACTIVITY, {
            reason: 'Disallowed file type',
            filename: file.name,
            mimetype: file.mimetype,
            allowedTypes,
          });
          return res.status(400).json({
            success: false,
            message: `File type ${file.mimetype} is not allowed`,
            timestamp: new Date().toISOString(),
          });
        }
        
        // Extension validation
        if (allowedExtensions.length > 0) {
          const extension = file.name.split('.').pop()?.toLowerCase();
          if (!extension || !allowedExtensions.includes(extension)) {
            audit.logSecurityEvent(req, AuditEventType.SUSPICIOUS_ACTIVITY, {
              reason: 'Disallowed file extension',
              filename: file.name,
              extension,
              allowedExtensions,
            });
            return res.status(400).json({
              success: false,
              message: `File extension .${extension} is not allowed`,
              timestamp: new Date().toISOString(),
            });
          }
        }
        
        // Basic virus scanning simulation (in production, use a real antivirus service)
        if (scanForVirus && containsMaliciousPatterns(file)) {
          audit.logSecurityEvent(req, AuditEventType.SUSPICIOUS_ACTIVITY, {
            reason: 'Potentially malicious file detected',
            filename: file.name,
            mimetype: file.mimetype,
          });
          return res.status(400).json({
            success: false,
            message: 'File appears to contain malicious content',
            error: 'MALICIOUS_FILE_DETECTED',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    
    next();
  };
};

// Legacy file upload validation (kept for backward compatibility)
// Temporarily disabled: export const validateFileUpload = validateSecureFileUpload;

// Simulate basic malicious pattern detection
function containsMaliciousPatterns(file: any): boolean {
  // This is a simplified version - in production use proper antivirus scanning
  const maliciousPatterns = [
    'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', // EICAR test
    '<%eval', // Server-side script
    '<script', // Client-side script
    'php -r', // PHP execution
    'system(', // System calls
    'exec(', // Execution
    'shell_exec(', // Shell execution
  ];
  
  if (file.data) {
    const content = file.data.toString('utf8', 0, Math.min(file.size, 1024)); // Check first 1KB
    return maliciousPatterns.some(pattern => content.includes(pattern));
  }
  
  return false;
}

// SQL Injection detection
function containsSQLInjection(obj: any): boolean {
  const sqlPatterns = [
    /('|('')|(")|("")|(%27)|(%22)|(%2527)|(%2522))/i, // Quote patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi, // SQL keywords
    /(0x[0-9a-f]+)/gi, // Hex values
    /(\b(OR|AND)\b.*=.*)/gi, // Boolean logic
    /(WAITFOR\s+DELAY)/gi, // Time-based attacks
    /(BENCHMARK\s*\()/gi, // MySQL benchmark
    /(SLEEP\s*\()/gi, // MySQL sleep
    /(pg_sleep\s*\()/gi, // PostgreSQL sleep
    /(--|#|(\/\*)|(\*\/))/gi, // Comment patterns
    /(;\s*(SELECT|INSERT|UPDATE|DELETE|DROP))/gi, // Stacked queries
    /(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)/gi, // System tables
    /(xp_cmdshell|sp_executesql)/gi, // Dangerous stored procedures
  ];
  
  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (Array.isArray(value)) {
      return value.some(checkValue);
    }
    if (value && typeof value === 'object') {
      return Object.values(value).some(checkValue);
    }
    return false;
  };
  
  return checkValue(obj);
}

// NoSQL Injection detection
function containsNoSQLInjection(obj: any): boolean {
  const nosqlPatterns = [
    /(\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin)/gi, // MongoDB operators
    /(\$where|\$regex|\$options)/gi, // MongoDB query operators
    /(\$eval|\$function|\$accumulator)/gi, // MongoDB aggregation
    /(this\.|constructor|prototype)/gi, // JavaScript injection
    /(__proto__|valueOf|toString)/gi, // Prototype pollution
  ];
  
  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return nosqlPatterns.some(pattern => pattern.test(value));
    }
    if (Array.isArray(value)) {
      return value.some(checkValue);
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).some(key => 
        nosqlPatterns.some(pattern => pattern.test(key))
      ) || Object.values(value).some(checkValue);
    }
    return false;
  };
  
  return checkValue(obj);
}

// LDAP Injection detection
function containsLDAPInjection(obj: any): boolean {
  const ldapPatterns = [
    /(\*|\(|\)|\\|\||&)/g, // LDAP special characters
    /(objectClass=\*)/gi, // Common LDAP injection
    /(\)\(|\*\)\()/gi, // LDAP filter breaking
  ];
  
  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return ldapPatterns.some(pattern => pattern.test(value));
    }
    if (Array.isArray(value)) {
      return value.some(checkValue);
    }
    if (value && typeof value === 'object') {
      return Object.values(value).some(checkValue);
    }
    return false;
  };
  
  return checkValue(obj);
}

// Comprehensive injection detection
export const detectInjectionAttempts = (req: Request, res: Response, next: NextFunction) => {
  const data = { ...req.body, ...req.query, ...req.params };
  
  if (containsSQLInjection(data)) {
    audit.logSecurityEvent(req, AuditEventType.SUSPICIOUS_ACTIVITY, {
      reason: 'SQL injection attempt detected',
      data: sanitizeObject(data),
    });
    return res.status(400).json({
      success: false,
      message: 'Potentially dangerous input detected',
      error: 'SQL_INJECTION_ATTEMPT',
      timestamp: new Date().toISOString(),
    });
  }
  
  if (containsNoSQLInjection(data)) {
    audit.logSecurityEvent(req, AuditEventType.SUSPICIOUS_ACTIVITY, {
      reason: 'NoSQL injection attempt detected',
      data: sanitizeObject(data),
    });
    return res.status(400).json({
      success: false,
      message: 'Potentially dangerous input detected',
      error: 'NOSQL_INJECTION_ATTEMPT',
      timestamp: new Date().toISOString(),
    });
  }
  
  if (containsLDAPInjection(data)) {
    audit.logSecurityEvent(req, AuditEventType.SUSPICIOUS_ACTIVITY, {
      reason: 'LDAP injection attempt detected',
      data: sanitizeObject(data),
    });
    return res.status(400).json({
      success: false,
      message: 'Potentially dangerous input detected',
      error: 'LDAP_INJECTION_ATTEMPT',
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
};

// Extend Request interface for TypeScript
declare global {
  namespace Express {
    interface Request {
      rateLimit?: { identifier: string };
    }
  }
}