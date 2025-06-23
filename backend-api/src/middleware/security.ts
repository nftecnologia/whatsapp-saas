import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import ExpressBrute from 'express-brute';
import ExpressBruteRedis from 'express-brute-redis';
import { body, validationResult, sanitizeBody } from 'express-validator';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import crypto from 'crypto-js';
import redis from '@/config/redis';

// Initialize DOMPurify with JSDOM for server-side usage
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// Redis store for brute force protection
const store = new ExpressBruteRedis({
  client: redis,
  prefix: 'bf:',
});

// Brute force protection for login endpoints
export const loginBruteForce = new ExpressBrute(store, {
  freeRetries: 3,
  minWait: 5 * 60 * 1000, // 5 minutes
  maxWait: 60 * 60 * 1000, // 1 hour
  lifetime: 24 * 60 * 60, // 24 hours (seconds)
  failCallback: (req: Request, res: Response, next: NextFunction, nextValidRequestDate: Date) => {
    res.status(429).json({
      success: false,
      message: 'Too many failed login attempts',
      error: 'RATE_LIMITED',
      retryAfter: nextValidRequestDate.toISOString(),
      timestamp: new Date().toISOString(),
    });
  },
});

// Brute force protection for password reset
export const passwordResetBruteForce = new ExpressBrute(store, {
  freeRetries: 5,
  minWait: 30 * 1000, // 30 seconds
  maxWait: 15 * 60 * 1000, // 15 minutes
  lifetime: 60 * 60, // 1 hour (seconds)
  failCallback: (req: Request, res: Response, next: NextFunction, nextValidRequestDate: Date) => {
    res.status(429).json({
      success: false,
      message: 'Too many password reset attempts',
      error: 'RATE_LIMITED',
      retryAfter: nextValidRequestDate.toISOString(),
      timestamp: new Date().toISOString(),
    });
  },
});

// Enhanced security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: { policy: "require-corp" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "no-referrer" },
  xssFilter: true,
});

// Additional security headers
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server fingerprinting
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Feature-Policy', "geolocation 'none'; microphone 'none'; camera 'none'");
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Prevent caching of sensitive data
  if (req.path.includes('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
};

// CORS configuration with origin validation
export const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Stack-Auth-Token',
    'X-API-Key',
    'X-Request-ID',
  ],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400, // 24 hours
};

// Advanced input sanitization
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid input data',
      error: 'SANITIZATION_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
};

// Recursive object sanitization
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

// String sanitization with XSS protection
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  
  // Remove HTML tags and dangerous characters
  let sanitized = purify.sanitize(str, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    FORBID_SCRIPT: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'iframe'],
  });
  
  // Additional security measures
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/eval\s*\(/gi, '')
    .replace(/expression\s*\(/gi, '')
    .trim();
  
  return sanitized;
}

// SQL Injection protection validator
export const validateNoSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
    /('|(\\)|(;)|(--)|(\*)|(%)|(\|)|(\^)|(&))/g,
    /(0x[0-9a-f]+)/gi,
    /(\b(OR|AND)\b.*=.*)/gi,
    /(WAITFOR\s+DELAY)/gi,
    /(BENCHMARK\s*\()/gi,
    /(SLEEP\s*\()/gi,
  ];
  
  const checkForSQLInjection = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (Array.isArray(value)) {
      return value.some(checkForSQLInjection);
    }
    if (value && typeof value === 'object') {
      return Object.values(value).some(checkForSQLInjection);
    }
    return false;
  };
  
  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query) || checkForSQLInjection(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Potentially dangerous input detected',
      error: 'SQL_INJECTION_ATTEMPT',
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
};

// Request size limiting
export const requestSizeLimit = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      return res.status(413).json({
        success: false,
        message: `Request entity too large. Maximum size is ${maxSize}`,
        error: 'REQUEST_TOO_LARGE',
        timestamp: new Date().toISOString(),
      });
    }
    
    next();
  };
};

// Helper function to parse size strings
function parseSize(size: string): number {
  const units = { b: 1, kb: 1024, mb: 1048576, gb: 1073741824 };
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmg]?b)$/);
  if (!match) return 0;
  return parseFloat(match[1]) * (units[match[2] as keyof typeof units] || 1);
}

// API Key validation
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key required',
      error: 'MISSING_API_KEY',
      timestamp: new Date().toISOString(),
    });
  }
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(403).json({
      success: false,
      message: 'Invalid API key',
      error: 'INVALID_API_KEY',
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
};

// Request ID generation for tracking
export const generateRequestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = crypto.lib.WordArray.random(16).toString();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

// IP validation and geoblocking (example)
export const validateIP = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;
  const blockedIPs = process.env.BLOCKED_IPS?.split(',') || [];
  const allowedCountries = process.env.ALLOWED_COUNTRIES?.split(',') || [];
  
  if (blockedIPs.includes(clientIP)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied',
      error: 'IP_BLOCKED',
      timestamp: new Date().toISOString(),
    });
  }
  
  // Add IP to request for logging
  req.clientIP = clientIP;
  next();
};

// Slow down middleware for suspicious behavior
export const slowDownSuspicious = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 10, // allow 10 requests per windowMs without delay
  delayMs: 500, // add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // max delay of 20 seconds
  skipFailedRequests: false,
  skipSuccessfulRequests: true,
});

// Advanced rate limiting with different tiers
export const createAdvancedRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipIf?: (req: Request) => boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    keyGenerator: options.keyGenerator || ((req) => req.ip),
    skip: options.skipIf || (() => false),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: options.message || 'Too many requests',
      error: 'RATE_LIMITED',
      timestamp: new Date().toISOString(),
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: options.message || 'Too many requests',
        error: 'RATE_LIMITED',
        timestamp: new Date().toISOString(),
      });
    },
  });
};

// File upload security
export const secureFileUpload = {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5, // max 5 files
    fields: 20, // max 20 fields
  },
  abortOnLimit: true,
  safeFileNames: true,
  preserveExtension: true,
  useTempFiles: true,
  tempFileDir: '/tmp/',
  createParentPath: false,
  parseNested: false,
};

// Declare global types
declare global {
  namespace Express {
    interface Request {
      clientIP?: string;
    }
  }
}

export default {
  securityHeaders,
  additionalSecurityHeaders,
  corsConfig,
  sanitizeInput,
  validateNoSQLInjection,
  requestSizeLimit,
  validateApiKey,
  generateRequestId,
  validateIP,
  slowDownSuspicious,
  createAdvancedRateLimit,
  loginBruteForce,
  passwordResetBruteForce,
  secureFileUpload,
};