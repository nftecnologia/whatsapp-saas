import { Request, Response, NextFunction } from 'express';
import { ContactModel } from '@/models/Contact';
import { sendSuccess, sendError, sendPaginatedResponse } from '@/utils/response';
import { createError } from '@/middleware/errorHandler';

export class ContactController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const {
        search,
        tags,
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

      if (tags) {
        filters.tags = Array.isArray(tags) ? tags as string[] : [tags as string];
      }

      const { contacts, total } = await ContactModel.findAll(req.user.company_id, filters);

      return sendPaginatedResponse(res, contacts, {
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
      const contact = await ContactModel.findById(id, req.user.company_id);

      if (!contact) {
        return sendError(res, 'Contact not found', 404);
      }

      return sendSuccess(res, contact);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { name, phone, email, tags, custom_fields } = req.body;

      const existingContact = await ContactModel.findByPhone(phone, req.user.company_id);
      if (existingContact) {
        return sendError(res, 'Contact with this phone number already exists', 400);
      }

      const contact = await ContactModel.create({
        company_id: req.user.company_id,
        name,
        phone,
        email,
        tags,
        custom_fields
      });

      return sendSuccess(res, contact, 'Contact created successfully', 201);
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

      if (updates.phone) {
        const existingContact = await ContactModel.findByPhone(updates.phone, req.user.company_id);
        if (existingContact && existingContact.id !== id) {
          return sendError(res, 'Another contact with this phone number already exists', 400);
        }
      }

      const contact = await ContactModel.update(id, req.user.company_id, updates);

      if (!contact) {
        return sendError(res, 'Contact not found', 404);
      }

      return sendSuccess(res, contact, 'Contact updated successfully');
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
      const deleted = await ContactModel.delete(id, req.user.company_id);

      if (!deleted) {
        return sendError(res, 'Contact not found', 404);
      }

      return sendSuccess(res, null, 'Contact deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async bulkCreate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { contacts } = req.body;

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return sendError(res, 'Contacts array is required', 400);
      }

      const results = await ContactModel.bulkCreate(req.user.company_id, contacts);

      return sendSuccess(res, {
        created: results.length,
        contacts: results
      }, 'Contacts imported successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async getTags(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const tags = await ContactModel.getTags(req.user.company_id);

      return sendSuccess(res, tags);
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const stats = await ContactModel.getStats(req.user.company_id);

      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}