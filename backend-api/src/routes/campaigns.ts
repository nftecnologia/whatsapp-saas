import { Router } from 'express';
import { CampaignController } from '@/controllers/campaignController';
import { authenticateToken } from '@/middleware/auth';
import { apiRateLimit, campaignSendRateLimit } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
import { z } from 'zod';

const router = Router();

const createCampaignSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    template_id: z.string().uuid('Invalid template ID'),
    scheduled_at: z.string().datetime().optional(),
    variables: z.record(z.string()).optional()
  })
};

const updateCampaignSchema = {
  body: z.object({
    name: z.string().min(1).optional(),
    template_id: z.string().uuid().optional(),
    scheduled_at: z.string().datetime().optional(),
    variables: z.record(z.string()).optional(),
    status: z.enum(['draft', 'scheduled', 'running', 'completed', 'paused', 'cancelled']).optional()
  })
};

const addContactsSchema = {
  body: z.object({
    contact_ids: z.array(z.string().uuid('Invalid contact ID'))
  })
};

const idParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid campaign ID')
  })
};

const contactIdParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid campaign ID'),
    contactId: z.string().uuid('Invalid contact ID')
  })
};

const sendCampaignSchema = {
  body: z.object({
    integration_id: z.string().optional()
  })
};

const sendSingleMessageSchema = {
  body: z.object({
    contact_id: z.string().uuid('Invalid contact ID'),
    template_id: z.string().uuid('Invalid template ID'),
    variables: z.record(z.string()).optional(),
    integration_id: z.string().optional()
  })
};

router.use(authenticateToken);
router.use(apiRateLimit);

router.get('/', CampaignController.getAll);
router.get('/stats', CampaignController.getStats);
router.get('/:id', validateRequest(idParamSchema), CampaignController.getById);
router.get('/:id/contacts', validateRequest(idParamSchema), CampaignController.getContacts);

router.post('/', validateRequest(createCampaignSchema), CampaignController.create);
router.post('/:id/contacts', validateRequest({...idParamSchema, ...addContactsSchema}), CampaignController.addContacts);

router.put('/:id', validateRequest({...idParamSchema, ...updateCampaignSchema}), CampaignController.update);

router.delete('/:id', validateRequest(idParamSchema), CampaignController.delete);
router.delete('/:id/contacts/:contactId', validateRequest(contactIdParamSchema), CampaignController.removeContact);

router.post('/:id/send', campaignSendRateLimit, validateRequest({...idParamSchema, ...sendCampaignSchema}), CampaignController.sendCampaign);
router.post('/:id/pause', validateRequest(idParamSchema), CampaignController.pauseCampaign);
router.post('/:id/resume', validateRequest(idParamSchema), CampaignController.resumeCampaign);
router.post('/:id/cancel', validateRequest(idParamSchema), CampaignController.cancelCampaign);

router.post('/send-message', campaignSendRateLimit, validateRequest(sendSingleMessageSchema), CampaignController.sendSingleMessage);

export default router;