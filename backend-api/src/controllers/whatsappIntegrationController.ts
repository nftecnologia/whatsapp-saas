import { Request, Response, NextFunction } from 'express';
import { WhatsAppInstanceModel } from '@/models/WhatsAppInstanceModel';
import { sendSuccess, sendError, sendPaginatedResponse } from '@/utils/response';
import { createError } from '@/middleware/errorHandler';
import logger from '@/utils/logger';
import axios from 'axios';

export class WhatsAppIntegrationController {
  /**
   * Create new WhatsApp integration
   * POST /integrations/whatsapp
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const {
        instance_name,
        meta_access_token,
        meta_phone_number_id,
        meta_business_id
      } = req.body;

      // Validate Meta access token format
      if (!WhatsAppIntegrationController.validateMetaToken(meta_access_token)) {
        return sendError(res, 'Invalid Meta access token format', 400);
      }

      // Verify token with Meta Graph API
      const tokenValid = await WhatsAppIntegrationController.verifyMetaToken(
        meta_access_token,
        meta_phone_number_id
      );

      if (!tokenValid) {
        return sendError(res, 'Invalid Meta access token or phone number ID', 400);
      }

      const instance = await WhatsAppInstanceModel.create({
        company_id: req.user.company_id,
        instance_name,
        integration_type: 'WHATSAPP-BUSINESS',
        meta_access_token,
        meta_phone_number_id,
        meta_business_id,
        status: 'disconnected'
      });

      // Convert to response format (masked token)
      const response = {
        ...instance,
        meta_access_token: WhatsAppIntegrationController.maskToken(meta_access_token)
      };

      logger.info('WhatsApp integration created', {
        companyId: req.user.company_id,
        instanceId: instance.id,
        instanceName: instance_name
      });

      return sendSuccess(res, response, 'WhatsApp integration created successfully', 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return sendError(res, error.message, 400);
      }
      next(error);
    }
  }

  /**
   * List company's WhatsApp integrations
   * GET /integrations/whatsapp
   */
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const {
        status,
        page = '1',
        limit = '20'
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const filters: any = {
        limit: limitNum,
        offset
      };

      if (status && typeof status === 'string') {
        if (!['connected', 'disconnected', 'error'].includes(status)) {
          return sendError(res, 'Invalid status filter', 400);
        }
        filters.status = status as 'connected' | 'disconnected' | 'error';
      }

      const { instances, total } = await WhatsAppInstanceModel.findByCompanyId(
        req.user.company_id,
        filters
      );

      return sendPaginatedResponse(res, instances, {
        page: pageNum,
        limit: limitNum,
        total
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific WhatsApp integration
   * GET /integrations/whatsapp/:id
   */
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      const instance = await WhatsAppInstanceModel.findById(id, req.user.company_id);

      if (!instance) {
        return sendError(res, 'WhatsApp integration not found', 404);
      }

      // Convert to response format (masked token)
      const response = {
        ...instance,
        meta_access_token: WhatsAppIntegrationController.maskToken(instance.meta_access_token)
      };

      return sendSuccess(res, response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update WhatsApp integration settings
   * PUT /integrations/whatsapp/:id
   */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      const updates = req.body;

      // Validate Meta access token format if provided
      if (updates.meta_access_token && !WhatsAppIntegrationController.validateMetaToken(updates.meta_access_token)) {
        return sendError(res, 'Invalid Meta access token format', 400);
      }

      // Verify token with Meta Graph API if token or phone ID changed
      if (updates.meta_access_token || updates.meta_phone_number_id) {
        const currentInstance = await WhatsAppInstanceModel.findById(id, req.user.company_id);
        if (!currentInstance) {
          return sendError(res, 'WhatsApp integration not found', 404);
        }

        const tokenToVerify = updates.meta_access_token || currentInstance.meta_access_token;
        const phoneIdToVerify = updates.meta_phone_number_id || currentInstance.meta_phone_number_id;

        const tokenValid = await WhatsAppIntegrationController.verifyMetaToken(
          tokenToVerify,
          phoneIdToVerify
        );

        if (!tokenValid) {
          return sendError(res, 'Invalid Meta access token or phone number ID', 400);
        }
      }

      const instance = await WhatsAppInstanceModel.update(id, req.user.company_id, updates);

      if (!instance) {
        return sendError(res, 'WhatsApp integration not found', 404);
      }

      // Convert to response format (masked token)
      const response = {
        ...instance,
        meta_access_token: WhatsAppIntegrationController.maskToken(instance.meta_access_token)
      };

      logger.info('WhatsApp integration updated', {
        companyId: req.user.company_id,
        instanceId: id,
        updatedFields: Object.keys(updates)
      });

      return sendSuccess(res, response, 'WhatsApp integration updated successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return sendError(res, error.message, 400);
      }
      next(error);
    }
  }

  /**
   * Delete WhatsApp integration
   * DELETE /integrations/whatsapp/:id
   */
  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      const deleted = await WhatsAppInstanceModel.delete(id, req.user.company_id);

      if (!deleted) {
        return sendError(res, 'WhatsApp integration not found', 404);
      }

      logger.info('WhatsApp integration deleted', {
        companyId: req.user.company_id,
        instanceId: id
      });

      return sendSuccess(res, null, 'WhatsApp integration deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Connect instance to Evolution API
   * POST /integrations/whatsapp/:id/connect
   */
  static async connect(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      const instance = await WhatsAppInstanceModel.findById(id, req.user.company_id);

      if (!instance) {
        return sendError(res, 'WhatsApp integration not found', 404);
      }

      // Attempt connection to Evolution API
      const connectionResult = await WhatsAppIntegrationController.connectToEvolutionAPI(instance);

      if (!connectionResult.success) {
        await WhatsAppInstanceModel.updateStatus(id, req.user.company_id, 'error');
        return sendError(res, connectionResult.error || 'Failed to connect to Evolution API', 500);
      }

      // Update status to connected
      await WhatsAppInstanceModel.updateStatus(id, req.user.company_id, 'connected');

      logger.info('WhatsApp integration connected to Evolution API', {
        companyId: req.user.company_id,
        instanceId: id
      });

      return sendSuccess(res, {
        status: 'connected',
        connection_details: connectionResult.data
      }, 'WhatsApp integration connected successfully');
    } catch (error) {
      // Update status to error on connection failure
      await WhatsAppInstanceModel.updateStatus(req.params.id, req.user?.company_id || '', 'error');
      next(error);
    }
  }

  /**
   * Get real-time connection status
   * GET /integrations/whatsapp/:id/status
   */
  static async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const { id } = req.params;
      const instance = await WhatsAppInstanceModel.findById(id, req.user.company_id);

      if (!instance) {
        return sendError(res, 'WhatsApp integration not found', 404);
      }

      // Check real-time status with Meta Graph API
      const realTimeStatus = await WhatsAppIntegrationController.checkMetaAPIStatus(instance);

      // Update status if different from database
      if (realTimeStatus.status !== instance.status) {
        await WhatsAppInstanceModel.updateStatus(id, req.user.company_id, realTimeStatus.status);
      }

      return sendSuccess(res, {
        id: instance.id,
        instance_name: instance.instance_name,
        status: realTimeStatus.status,
        phone_number_id: instance.meta_phone_number_id,
        last_checked: new Date().toISOString(),
        details: realTimeStatus.details
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get integration statistics
   * GET /integrations/whatsapp/stats
   */
  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 401);
      }

      const stats = await WhatsAppInstanceModel.getStats(req.user.company_id);

      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  // Helper methods

  /**
   * Validate Meta access token format
   */
  private static validateMetaToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Meta tokens typically start with specific patterns
    // This is a basic validation - adjust based on Meta's current token format
    const tokenPattern = /^[A-Za-z0-9_-]+$/;
    return tokenPattern.test(token) && token.length >= 20;
  }

  /**
   * Verify Meta access token with Graph API
   */
  private static async verifyMetaToken(token: string, phoneNumberId: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          timeout: 10000
        }
      );

      return response.status === 200 && response.data;
    } catch (error) {
      logger.error('Meta token verification failed:', {
        phoneNumberId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Check Meta API status
   */
  private static async checkMetaAPIStatus(instance: any): Promise<{
    status: 'connected' | 'disconnected' | 'error';
    details: any;
  }> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${instance.meta_phone_number_id}`,
        {
          headers: {
            'Authorization': `Bearer ${instance.meta_access_token}`
          },
          timeout: 10000
        }
      );

      if (response.status === 200) {
        return {
          status: 'connected',
          details: {
            phone_number: response.data.display_phone_number,
            verified_name: response.data.verified_name,
            quality_rating: response.data.quality_rating
          }
        };
      }

      return { status: 'error', details: { error: 'Invalid response from Meta API' } };
    } catch (error) {
      return {
        status: 'error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Connect to Evolution API using WhatsAppInstanceService
   */
  private static async connectToEvolutionAPI(instance: any): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const { WhatsAppInstanceService } = await import('@/services/whatsappInstanceService');
      
      const result = await WhatsAppInstanceService.connectInstance(
        instance.id,
        instance.company_id
      );

      if (result.success) {
        return {
          success: true,
          data: {
            status: result.status,
            connected_at: new Date().toISOString()
          }
        };
      }

      return {
        success: false,
        error: result.error
      };
    } catch (error) {
      logger.error('Evolution API connection failed:', {
        instanceId: instance.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Evolution API connection failed'
      };
    }
  }

  /**
   * Mask access token for API responses
   */
  private static maskToken(token: string): string {
    if (!token || token.length < 8) return '****';
    return token.substring(0, 4) + '****' + token.substring(token.length - 4);
  }
}