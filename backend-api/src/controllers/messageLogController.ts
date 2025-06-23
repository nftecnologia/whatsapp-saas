import { Request, Response, NextFunction } from 'express';
import { MessageLogModel } from '@/models/MessageLog';
import { sendSuccess, sendError, sendPaginatedResponse } from '@/utils/response';

export class MessageLogController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const {
        campaign_id,
        status,
        phone,
        start_date,
        end_date,
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

      if (campaign_id) {
        filters.campaign_id = campaign_id as string;
      }

      if (status) {
        filters.status = status as 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
      }

      if (phone) {
        filters.phone = phone as string;
      }

      if (start_date) {
        filters.start_date = new Date(start_date as string);
      }

      if (end_date) {
        filters.end_date = new Date(end_date as string);
      }

      const { logs, total } = await MessageLogModel.findByCompany(req.user.company_id, filters);

      return sendPaginatedResponse(res, logs, {
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
      const log = await MessageLogModel.findById(id);

      if (!log || log.company_id !== req.user.company_id) {
        return sendError(res, 'Message log not found', 404);
      }

      return sendSuccess(res, log);
    } catch (error) {
      next(error);
    }
  }

  static async getByCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { campaignId } = req.params;
      const {
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

      if (status) {
        filters.status = status as 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
      }

      const { logs, total } = await MessageLogModel.findByCampaign(campaignId, filters);

      return sendPaginatedResponse(res, logs, {
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

      const {
        campaign_id,
        start_date,
        end_date
      } = req.query;

      const filters: any = {};

      if (campaign_id) {
        filters.campaign_id = campaign_id as string;
      }

      if (start_date) {
        filters.start_date = new Date(start_date as string);
      }

      if (end_date) {
        filters.end_date = new Date(end_date as string);
      }

      const stats = await MessageLogModel.getStats(req.user.company_id, filters);

      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}