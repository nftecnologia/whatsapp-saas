import { Router } from 'express';
import { TemplateController } from '@/controllers/templateController';
import { authenticateToken } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
import { z } from 'zod';

const router = Router();

const createTemplateSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    content: z.string().min(1, 'Content is required'),
    category: z.enum(['marketing', 'notification', 'support']).optional()
  })
};

const updateTemplateSchema = {
  body: z.object({
    name: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    category: z.enum(['marketing', 'notification', 'support']).optional()
  })
};

const previewSchema = {
  body: z.object({
    variables: z.record(z.string()).optional()
  })
};

const idParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid template ID')
  })
};

router.use(authenticateToken);
router.use(apiRateLimit);

router.get('/', TemplateController.getAll);
router.get('/stats', TemplateController.getStats);
router.get('/:id', validateRequest(idParamSchema), TemplateController.getById);

router.post('/', validateRequest(createTemplateSchema), TemplateController.create);
router.post('/:id/preview', validateRequest({...idParamSchema, ...previewSchema}), TemplateController.preview);

router.put('/:id', validateRequest({...idParamSchema, ...updateTemplateSchema}), TemplateController.update);

router.delete('/:id', validateRequest(idParamSchema), TemplateController.delete);

export default router;