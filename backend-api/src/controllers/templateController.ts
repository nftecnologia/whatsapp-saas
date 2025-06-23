import { Request, Response, NextFunction } from 'express';
import { TemplateModel } from '@/models/Template';
import { sendSuccess, sendError, sendPaginatedResponse } from '@/utils/response';

export class TemplateController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const {
        search,
        category,
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

      if (category) {
        filters.category = category as 'marketing' | 'notification' | 'support';
      }

      const { templates, total } = await TemplateModel.findAll(req.user.company_id, filters);

      return sendPaginatedResponse(res, templates, {
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
      const template = await TemplateModel.findById(id, req.user.company_id);

      if (!template) {
        return sendError(res, 'Template not found', 404);
      }

      return sendSuccess(res, template);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { name, content, category } = req.body;

      const existingTemplate = await TemplateModel.findByName(name, req.user.company_id);
      if (existingTemplate) {
        return sendError(res, 'Template with this name already exists', 400);
      }

      const variables = TemplateModel.extractVariables(content);

      const template = await TemplateModel.create({
        company_id: req.user.company_id,
        name,
        content,
        variables,
        category
      });

      return sendSuccess(res, template, 'Template created successfully', 201);
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

      if (updates.name) {
        const existingTemplate = await TemplateModel.findByName(updates.name, req.user.company_id);
        if (existingTemplate && existingTemplate.id !== id) {
          return sendError(res, 'Another template with this name already exists', 400);
        }
      }

      if (updates.content) {
        updates.variables = TemplateModel.extractVariables(updates.content);
      }

      const template = await TemplateModel.update(id, req.user.company_id, updates);

      if (!template) {
        return sendError(res, 'Template not found', 404);
      }

      return sendSuccess(res, template, 'Template updated successfully');
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
      const deleted = await TemplateModel.delete(id, req.user.company_id);

      if (!deleted) {
        return sendError(res, 'Template not found', 404);
      }

      return sendSuccess(res, null, 'Template deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async preview(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      const { variables } = req.body;

      const template = await TemplateModel.findById(id, req.user.company_id);

      if (!template) {
        return sendError(res, 'Template not found', 404);
      }

      const previewContent = TemplateModel.replaceVariables(template.content, variables || {});

      return sendSuccess(res, {
        original_content: template.content,
        preview_content: previewContent,
        variables: template.variables,
        provided_variables: variables || {}
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

      const stats = await TemplateModel.getStats(req.user.company_id);

      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}