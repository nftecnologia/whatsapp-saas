import { Router } from 'express';
import { UserController } from '@/controllers/userController';
import { authenticateToken } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
import { z } from 'zod';

const router = Router();

const createUserSchema = {
  body: z.object({
    email: z.string().email('Invalid email format'),
    name: z.string().min(1, 'Name is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['admin', 'user']).optional()
  })
};

const updateUserSchema = {
  body: z.object({
    email: z.string().email().optional(),
    name: z.string().min(1).optional(),
    password: z.string().min(6).optional(),
    role: z.enum(['admin', 'user']).optional()
  })
};

const idParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid user ID')
  })
};

router.use(authenticateToken);
router.use(apiRateLimit);

router.get('/', UserController.getAll);
router.get('/stats', UserController.getStats);
router.get('/:id', validateRequest(idParamSchema), UserController.getById);

router.post('/', validateRequest(createUserSchema), UserController.create);

router.put('/:id', validateRequest({...idParamSchema, ...updateUserSchema}), UserController.update);

router.delete('/:id', validateRequest(idParamSchema), UserController.deactivate);

export default router;