import { Router } from 'express';
import { CompanyController } from '@/controllers/companyController';
import { authenticateToken } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
import { z } from 'zod';

const router = Router();

const updateCompanySchema = {
  body: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    plan: z.enum(['free', 'basic', 'premium', 'enterprise']).optional()
  })
};

router.use(authenticateToken);
router.use(apiRateLimit);

router.get('/profile', CompanyController.getProfile);
router.get('/stats', CompanyController.getStats);

router.put('/profile', validateRequest(updateCompanySchema), CompanyController.updateProfile);

export default router;