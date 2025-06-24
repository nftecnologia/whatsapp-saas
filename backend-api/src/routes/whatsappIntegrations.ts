import { Router } from 'express';
import { WhatsAppIntegrationController } from '@/controllers/whatsappIntegrationController';
import { authenticateToken } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createIntegrationSchema = {
  body: z.object({
    instance_name: z.string()
      .min(1, 'Instance name is required')
      .max(255, 'Instance name must be less than 255 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Instance name can only contain letters, numbers, underscores, and hyphens'),
    meta_access_token: z.string()
      .min(20, 'Meta access token must be at least 20 characters')
      .max(500, 'Meta access token is too long'),
    meta_phone_number_id: z.string()
      .min(1, 'Meta phone number ID is required')
      .max(50, 'Meta phone number ID is too long'),
    meta_business_id: z.string()
      .min(1, 'Meta business ID is required')
      .max(50, 'Meta business ID is too long')
  })
};

const updateIntegrationSchema = {
  body: z.object({
    instance_name: z.string()
      .min(1, 'Instance name is required')
      .max(255, 'Instance name must be less than 255 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Instance name can only contain letters, numbers, underscores, and hyphens')
      .optional(),
    meta_access_token: z.string()
      .min(20, 'Meta access token must be at least 20 characters')
      .max(500, 'Meta access token is too long')
      .optional(),
    meta_phone_number_id: z.string()
      .min(1, 'Meta phone number ID is required')
      .max(50, 'Meta phone number ID is too long')
      .optional(),
    meta_business_id: z.string()
      .min(1, 'Meta business ID is required')
      .max(50, 'Meta business ID is too long')
      .optional(),
    status: z.enum(['connected', 'disconnected', 'error']).optional()
  })
};

const idParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid integration ID')
  })
};

const queryParamsSchema = {
  query: z.object({
    status: z.enum(['connected', 'disconnected', 'error']).optional(),
    page: z.string()
      .regex(/^\d+$/, 'Page must be a positive integer')
      .transform(val => parseInt(val, 10))
      .refine(val => val > 0, 'Page must be greater than 0')
      .optional(),
    limit: z.string()
      .regex(/^\d+$/, 'Limit must be a positive integer')
      .transform(val => parseInt(val, 10))
      .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
      .optional()
  })
};

// Apply middleware to all routes
router.use(authenticateToken);
router.use(apiRateLimit);

// Routes
router.get('/', validateRequest(queryParamsSchema), WhatsAppIntegrationController.getAll);
router.get('/stats', WhatsAppIntegrationController.getStats);
router.get('/:id', validateRequest(idParamSchema), WhatsAppIntegrationController.getById);
router.get('/:id/status', validateRequest(idParamSchema), WhatsAppIntegrationController.getStatus);

router.post('/', validateRequest(createIntegrationSchema), WhatsAppIntegrationController.create);
router.post('/:id/connect', validateRequest(idParamSchema), WhatsAppIntegrationController.connect);

router.put('/:id', validateRequest({...idParamSchema, ...updateIntegrationSchema}), WhatsAppIntegrationController.update);

router.delete('/:id', validateRequest(idParamSchema), WhatsAppIntegrationController.delete);

export default router;