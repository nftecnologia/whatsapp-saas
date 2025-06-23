import { Router } from 'express';
import { ContactController } from '@/controllers/contactController';
import { authenticateToken } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
import { z } from 'zod';

const router = Router();

const createContactSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    phone: z.string().min(1, 'Phone is required'),
    email: z.string().email().optional(),
    tags: z.array(z.string()).optional(),
    custom_fields: z.record(z.any()).optional()
  })
};

const updateContactSchema = {
  body: z.object({
    name: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    email: z.string().email().optional(),
    tags: z.array(z.string()).optional(),
    custom_fields: z.record(z.any()).optional()
  })
};

const bulkCreateSchema = {
  body: z.object({
    contacts: z.array(z.object({
      name: z.string().min(1, 'Name is required'),
      phone: z.string().min(1, 'Phone is required'),
      email: z.string().email().optional(),
      tags: z.array(z.string()).optional(),
      custom_fields: z.record(z.any()).optional()
    }))
  })
};

const idParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid contact ID')
  })
};

router.use(authenticateToken);
router.use(apiRateLimit);

router.get('/', ContactController.getAll);
router.get('/tags', ContactController.getTags);
router.get('/stats', ContactController.getStats);
router.get('/:id', validateRequest(idParamSchema), ContactController.getById);

router.post('/', validateRequest(createContactSchema), ContactController.create);
router.post('/bulk', validateRequest(bulkCreateSchema), ContactController.bulkCreate);

router.put('/:id', validateRequest({...idParamSchema, ...updateContactSchema}), ContactController.update);

router.delete('/:id', validateRequest(idParamSchema), ContactController.delete);

export default router;