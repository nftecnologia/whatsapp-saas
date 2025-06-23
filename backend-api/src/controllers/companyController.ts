import { Request, Response, NextFunction } from 'express';
import { CompanyModel } from '@/models/Company';
import { sendSuccess, sendError } from '@/utils/response';

export class CompanyController {
  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const result = await CompanyModel.getCompanyWithStats(req.user.company_id);

      if (!result) {
        return sendError(res, 'Company not found', 404);
      }

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      if (req.user.role !== 'admin') {
        return sendError(res, 'Admin access required', 403);
      }

      const updates = req.body;
      
      if (updates.email) {
        const existingCompany = await CompanyModel.findByEmail(updates.email);
        if (existingCompany && existingCompany.id !== req.user.company_id) {
          return sendError(res, 'Another company with this email already exists', 400);
        }
      }

      const company = await CompanyModel.update(req.user.company_id, updates);

      if (!company) {
        return sendError(res, 'Company not found', 404);
      }

      return sendSuccess(res, company, 'Company profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      if (req.user.role !== 'admin') {
        return sendError(res, 'Admin access required', 403);
      }

      const stats = await CompanyModel.getStats();

      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}