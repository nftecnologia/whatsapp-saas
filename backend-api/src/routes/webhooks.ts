import { Router } from 'express';
import { WebhookController } from '@/controllers/webhookController';
import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';
import { createResponse } from '@/utils/response';

const router = Router();

// Webhook validation middleware
const validateWebhookPayload = [
  body('instance').isString().notEmpty().withMessage('Instance is required'),
  body('data').isObject().withMessage('Data object is required'),
  body('date_time').isString().notEmpty().withMessage('Date time is required'),
  body('events').isArray().withMessage('Events array is required'),
];

// Error handling middleware for validation
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Webhook validation failed', {
      errors: errors.array(),
      body: req.body,
      ip: req.ip,
    });
    return res.status(400).json(createResponse(
      false,
      null,
      'Invalid webhook payload',
      errors.array().map(err => err.msg).join(', ')
    ));
  }
  next();
};

// Security middleware to verify webhook authenticity
const verifyWebhookAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Add webhook signature verification if Evolution API supports it
    // For now, we'll check for basic authentication or API key
    
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] || req.body.apikey;
    
    // Log webhook attempt for monitoring
    logger.info('Webhook authentication attempt', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      instance: req.body.instance,
      hasAuth: !!authHeader,
      hasApiKey: !!apiKey,
      contentLength: req.headers['content-length'],
    });

    // For development, we'll be lenient with authentication
    // In production, you should verify the webhook signature or API key
    if (process.env.NODE_ENV === 'production') {
      if (!apiKey && !authHeader) {
        logger.warn('Webhook authentication failed - no credentials', {
          ip: req.ip,
          instance: req.body.instance,
        });
        return res.status(401).json(createResponse(
          false,
          null,
          'Webhook authentication required'
        ));
      }
    }

    next();
  } catch (error) {
    logger.error('Webhook authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
    });
    return res.status(500).json(createResponse(
      false,
      null,
      'Authentication error'
    ));
  }
};

// Rate limiting for webhooks (prevent spam)
const webhookRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // Simple in-memory rate limiting (in production, use Redis)
  const rateLimitMap = new Map();
  const key = `${req.ip}-${req.body.instance || 'unknown'}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 100; // Max 100 requests per minute per IP+instance

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
  } else {
    const rateData = rateLimitMap.get(key);
    if (now > rateData.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    } else {
      rateData.count++;
      if (rateData.count > maxRequests) {
        logger.warn('Webhook rate limit exceeded', {
          ip: req.ip,
          instance: req.body.instance,
          count: rateData.count,
        });
        return res.status(429).json(createResponse(
          false,
          null,
          'Rate limit exceeded'
        ));
      }
    }
  }

  next();
};

/**
 * @route POST /webhooks/evolution
 * @desc Handle Evolution API v2 unified webhook
 * @access Public (with authentication)
 */
router.post('/evolution',
  webhookRateLimit,
  verifyWebhookAuth,
  validateWebhookPayload,
  handleValidationErrors,
  WebhookController.handleGenericEvolutionWebhook
);

/**
 * @route POST /webhooks/evolution/messages
 * @desc Handle Evolution API v2 message status webhooks specifically
 * @access Public (with authentication)
 */
router.post('/evolution/messages',
  webhookRateLimit,
  verifyWebhookAuth,
  validateWebhookPayload,
  handleValidationErrors,
  WebhookController.handleEvolutionWebhook
);

/**
 * @route POST /webhooks/evolution/instance
 * @desc Handle Evolution API v2 instance status webhooks specifically
 * @access Public (with authentication)
 */
router.post('/evolution/instance',
  webhookRateLimit,
  verifyWebhookAuth,
  validateWebhookPayload,
  handleValidationErrors,
  WebhookController.handleEvolutionInstanceStatus
);

/**
 * @route GET /webhooks/health
 * @desc Health check for webhook endpoints
 * @access Public
 */
router.get('/health', (req: Request, res: Response) => {
  res.json(createResponse(true, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /webhooks/evolution': 'Evolution API unified webhook',
      'POST /webhooks/evolution/messages': 'Message status updates',
      'POST /webhooks/evolution/instance': 'Instance status updates',
    }
  }, 'Webhook service is healthy'));
});

export default router;