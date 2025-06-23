import { Router } from 'express';
import { MessageLogController } from '@/controllers/messageLogController';
import { authenticateToken } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
import { z } from 'zod';

const router = Router();

const idParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid message log ID')
  })
};

const campaignIdParamSchema = {
  params: z.object({
    campaignId: z.string().uuid('Invalid campaign ID')
  })
};

router.use(authenticateToken);
router.use(apiRateLimit);

router.get('/', MessageLogController.getAll);
router.get('/stats', MessageLogController.getStats);
router.get('/:id', validateRequest(idParamSchema), MessageLogController.getById);
router.get('/campaign/:campaignId', validateRequest(campaignIdParamSchema), MessageLogController.getByCampaign);

export default router;