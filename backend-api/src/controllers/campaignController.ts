import { Request, Response, NextFunction } from 'express';
import { CampaignModel } from '@/models/Campaign';
import { TemplateModel } from '@/models/Template';
import { CampaignService } from '@/services/campaignService';
import { sendSuccess, sendError, sendPaginatedResponse } from '@/utils/response';

export class CampaignController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const {
        search,
        status,
        page = '1',
        limit = '50'
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const filters: any = {
        limit: limitNum,
        offset
      };

      if (search) {
        filters.search = search as string;
      }

      if (status) {
        filters.status = status as 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'cancelled';
      }

      const { campaigns, total } = await CampaignModel.findAll(req.user.company_id, filters);

      return sendPaginatedResponse(res, campaigns, {
        page: pageNum,
        limit: limitNum,
        total
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      const campaign = await CampaignModel.findById(id, req.user.company_id);

      if (!campaign) {
        return sendError(res, 'Campaign not found', 404);
      }

      return sendSuccess(res, campaign);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { name, template_id, scheduled_at, variables } = req.body;

      const existingCampaign = await CampaignModel.findByName(name, req.user.company_id);
      if (existingCampaign) {
        return sendError(res, 'Campaign with this name already exists', 400);
      }

      const template = await TemplateModel.findById(template_id, req.user.company_id);
      if (!template) {
        return sendError(res, 'Template not found', 400);
      }

      const campaign = await CampaignModel.create({
        company_id: req.user.company_id,
        name,
        template_id,
        scheduled_at: scheduled_at ? new Date(scheduled_at) : undefined,
        variables
      });

      return sendSuccess(res, campaign, 'Campaign created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      const updates = req.body;

      const campaign = await CampaignModel.findById(id, req.user.company_id);
      if (!campaign) {
        return sendError(res, 'Campaign not found', 404);
      }

      if (campaign.status === 'running') {
        return sendError(res, 'Cannot update running campaign', 400);
      }

      if (updates.name) {
        const existingCampaign = await CampaignModel.findByName(updates.name, req.user.company_id);
        if (existingCampaign && existingCampaign.id !== id) {
          return sendError(res, 'Another campaign with this name already exists', 400);
        }
      }

      if (updates.template_id) {
        const template = await TemplateModel.findById(updates.template_id, req.user.company_id);
        if (!template) {
          return sendError(res, 'Template not found', 400);
        }
      }

      if (updates.scheduled_at) {
        updates.scheduled_at = new Date(updates.scheduled_at);
      }

      const updatedCampaign = await CampaignModel.update(id, req.user.company_id, updates);

      return sendSuccess(res, updatedCampaign, 'Campaign updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      
      const campaign = await CampaignModel.findById(id, req.user.company_id);
      if (!campaign) {
        return sendError(res, 'Campaign not found', 404);
      }

      if (campaign.status === 'running') {
        return sendError(res, 'Cannot delete running campaign', 400);
      }

      const deleted = await CampaignModel.delete(id, req.user.company_id);

      if (!deleted) {
        return sendError(res, 'Campaign not found', 404);
      }

      return sendSuccess(res, null, 'Campaign deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async addContacts(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      const { contact_ids } = req.body;

      if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
        return sendError(res, 'Contact IDs array is required', 400);
      }

      const campaign = await CampaignModel.findById(id, req.user.company_id);
      if (!campaign) {
        return sendError(res, 'Campaign not found', 404);
      }

      if (campaign.status === 'running' || campaign.status === 'completed') {
        return sendError(res, 'Cannot modify contacts for running or completed campaign', 400);
      }

      const results = await CampaignModel.addContacts(id, contact_ids);

      return sendSuccess(res, {
        added: results.length,
        contacts: results
      }, 'Contacts added to campaign successfully');
    } catch (error) {
      next(error);
    }
  }

  static async removeContact(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id, contactId } = req.params;

      const campaign = await CampaignModel.findById(id, req.user.company_id);
      if (!campaign) {
        return sendError(res, 'Campaign not found', 404);
      }

      if (campaign.status === 'running' || campaign.status === 'completed') {
        return sendError(res, 'Cannot modify contacts for running or completed campaign', 400);
      }

      const removed = await CampaignModel.removeContact(id, contactId);

      if (!removed) {
        return sendError(res, 'Contact not found in campaign', 404);
      }

      return sendSuccess(res, null, 'Contact removed from campaign successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getContacts(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      const {
        status,
        page = '1',
        limit = '50'
      } = req.query;

      const campaign = await CampaignModel.findById(id, req.user.company_id);
      if (!campaign) {
        return sendError(res, 'Campaign not found', 404);
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const filters: any = {
        limit: limitNum,
        offset
      };

      if (status) {
        filters.status = status as 'pending' | 'sent' | 'delivered' | 'failed';
      }

      const { contacts, total } = await CampaignModel.getCampaignContacts(id, filters);

      return sendPaginatedResponse(res, contacts, {
        page: pageNum,
        limit: limitNum,
        total
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const stats = await CampaignModel.getStats(req.user.company_id);

      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  static async sendCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      const { integration_id } = req.body;

      const result = await CampaignService.sendCampaign(id, req.user.company_id, integration_id);

      return sendSuccess(res, result, 'Campaign sent successfully');
    } catch (error) {
      next(error);
    }
  }

  static async pauseCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;

      const campaign = await CampaignService.pauseCampaign(id, req.user.company_id);

      return sendSuccess(res, campaign, 'Campaign paused successfully');
    } catch (error) {
      next(error);
    }
  }

  static async resumeCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;

      const campaign = await CampaignService.resumeCampaign(id, req.user.company_id);

      return sendSuccess(res, campaign, 'Campaign resumed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async cancelCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;

      const campaign = await CampaignService.cancelCampaign(id, req.user.company_id);

      return sendSuccess(res, campaign, 'Campaign cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  static async sendSingleMessage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { contact_id, template_id, variables, integration_id } = req.body;

      const result = await CampaignService.sendSingleMessage(
        req.user.company_id,
        contact_id,
        template_id,
        variables,
        integration_id
      );

      return sendSuccess(res, result, 'Message sent successfully');
    } catch (error) {
      next(error);
    }
  }
}