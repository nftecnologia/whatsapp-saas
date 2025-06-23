import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/authService';
import { AuthUser } from '@/types';

declare global {
  namespace Express {
    interface Request {
      stackUser?: any;
    }
  }
}

export const validateStackAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stackToken = req.headers['x-stack-auth-token'] as string;

    if (!stackToken) {
      return res.status(401).json({
        success: false,
        message: 'Stack Auth token required',
      });
    }

    const user = await AuthService.validateStackAuthToken(stackToken);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Stack Auth token',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Stack Auth validation failed',
    });
  }
};

export const optionalStackAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stackToken = req.headers['x-stack-auth-token'] as string;

    if (stackToken) {
      const user = await AuthService.validateStackAuthToken(stackToken);
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    next();
  }
};

export const createStackAuthWebhook = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, data } = req.body;

      switch (type) {
        case 'user.created':
          console.log('Stack Auth user created:', data);
          break;
        
        case 'user.updated':
          console.log('Stack Auth user updated:', data);
          break;
        
        case 'user.deleted':
          console.log('Stack Auth user deleted:', data);
          break;
        
        default:
          console.log('Unknown Stack Auth webhook event:', type);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Stack Auth webhook error:', error);
      res.status(500).json({ success: false, error: 'Webhook processing failed' });
    }
  };
};