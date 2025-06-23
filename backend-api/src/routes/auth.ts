import { Router } from 'express';
import { AuthController } from '@/controllers/authController';
import { authenticateToken } from '@/middleware/auth';
import { authRateLimit } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
import { z } from 'zod';

const router = Router();

const loginSchema = {
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required')
  })
};

const registerSchema = {
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required'),
    companyName: z.string().min(1, 'Company name is required'),
    companyEmail: z.string().email('Invalid company email format'),
    companyPhone: z.string().optional()
  })
};

const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters')
  })
};

const stackAuthSchema = {
  body: z.object({
    stackToken: z.string().min(1, 'Stack Auth token is required')
  })
};

router.post('/login', authRateLimit, validateRequest(loginSchema), AuthController.login);

router.post('/register', authRateLimit, validateRequest(registerSchema), AuthController.register);

router.post('/stack-auth', authRateLimit, validateRequest(stackAuthSchema), AuthController.stackAuthLogin);

router.post('/refresh', authenticateToken, AuthController.refreshToken);

router.post('/change-password', authenticateToken, validateRequest(changePasswordSchema), AuthController.changePassword);

router.get('/me', authenticateToken, AuthController.me);

router.post('/logout', authenticateToken, AuthController.logout);

export default router;