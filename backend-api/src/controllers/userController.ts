import { Request, Response, NextFunction } from 'express';
import { UserModel } from '@/models/User';
import { sendSuccess, sendError, sendPaginatedResponse } from '@/utils/response';
import bcrypt from 'bcryptjs';

export class UserController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      if (req.user.role !== 'admin') {
        return sendError(res, 'Admin access required', 403);
      }

      const users = await UserModel.findByCompanyId(req.user.company_id);

      return sendSuccess(res, users);
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

      if (req.user.role !== 'admin' && req.user.id !== id) {
        return sendError(res, 'Access denied', 403);
      }

      const user = await UserModel.findById(id);

      if (!user || user.company_id !== req.user.company_id) {
        return sendError(res, 'User not found', 404);
      }

      return sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      if (req.user.role !== 'admin') {
        return sendError(res, 'Admin access required', 403);
      }

      const { email, name, password, role } = req.body;

      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return sendError(res, 'User with this email already exists', 400);
      }

      if (password.length < 6) {
        return sendError(res, 'Password must be at least 6 characters long', 400);
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await UserModel.create({
        email,
        name,
        password_hash: hashedPassword,
        company_id: req.user.company_id,
        role: role || 'user'
      });

      const { password_hash, ...userResponse } = user as any;

      return sendSuccess(res, userResponse, 'User created successfully', 201);
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

      if (req.user.role !== 'admin' && req.user.id !== id) {
        return sendError(res, 'Access denied', 403);
      }

      if (updates.role && req.user.role !== 'admin') {
        return sendError(res, 'Only admins can change user roles', 403);
      }

      if (updates.email) {
        const existingUser = await UserModel.findByEmail(updates.email);
        if (existingUser && existingUser.id !== id) {
          return sendError(res, 'Another user with this email already exists', 400);
        }
      }

      if (updates.password) {
        if (updates.password.length < 6) {
          return sendError(res, 'Password must be at least 6 characters long', 400);
        }
        updates.password_hash = await bcrypt.hash(updates.password, 10);
        delete updates.password;
      }

      const user = await UserModel.update(id, updates);

      if (!user || user.company_id !== req.user.company_id) {
        return sendError(res, 'User not found', 404);
      }

      const { password_hash, ...userResponse } = user as any;

      return sendSuccess(res, userResponse, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      if (req.user.role !== 'admin') {
        return sendError(res, 'Admin access required', 403);
      }

      const { id } = req.params;

      if (req.user.id === id) {
        return sendError(res, 'Cannot deactivate your own account', 400);
      }

      const user = await UserModel.findById(id);
      if (!user || user.company_id !== req.user.company_id) {
        return sendError(res, 'User not found', 404);
      }

      const deactivated = await UserModel.deactivate(id);

      if (!deactivated) {
        return sendError(res, 'User not found', 404);
      }

      return sendSuccess(res, null, 'User deactivated successfully');
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

      const stats = await UserModel.getStats(req.user.company_id);

      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}