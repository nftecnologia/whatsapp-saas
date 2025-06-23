import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/authService';
import { sendSuccess, sendError } from '@/utils/response';
import { createError } from '@/middleware/errorHandler';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return sendError(res, 'Email and password are required', 400);
      }

      const result = await AuthService.login(email, password);

      return sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        email,
        password,
        name,
        companyName,
        companyEmail,
        companyPhone
      } = req.body;

      if (!email || !password || !name || !companyName || !companyEmail) {
        return sendError(res, 'All required fields must be provided', 400);
      }

      if (password.length < 6) {
        return sendError(res, 'Password must be at least 6 characters long', 400);
      }

      const result = await AuthService.register({
        email,
        password,
        name,
        companyName,
        companyEmail,
        companyPhone
      });

      return sendSuccess(res, result, 'Registration successful', 201);
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const result = await AuthService.refreshToken(req.user.id);

      return sendSuccess(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return sendError(res, 'Current password and new password are required', 400);
      }

      if (newPassword.length < 6) {
        return sendError(res, 'New password must be at least 6 characters long', 400);
      }

      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      await AuthService.changePassword(req.user.id, currentPassword, newPassword);

      return sendSuccess(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async stackAuthLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { stackToken } = req.body;

      if (!stackToken) {
        return sendError(res, 'Stack Auth token is required', 400);
      }

      const user = await AuthService.validateStackAuthToken(stackToken);

      if (!user) {
        return sendError(res, 'Invalid Stack Auth token', 401);
      }

      const token = AuthService.generateToken(user);

      return sendSuccess(res, {
        user,
        token
      }, 'Stack Auth login successful');
    } catch (error) {
      next(error);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      return sendSuccess(res, req.user, 'User profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, null, 'Logout successful');
    } catch (error) {
      next(error);
    }
  }
}