import { Request, Response } from 'express';
import { MessageLogModel } from '@/models/MessageLog';
import logger from '@/utils/logger';
import { createResponse } from '@/utils/response';

// Evolution API v2 webhook payload interfaces
interface EvolutionWebhookPayload {
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    messageTimestamp?: number;
    status?: 'ERROR' | 'PENDING' | 'SERVER_ACK' | 'DELIVERY_ACK' | 'READ' | 'PLAYED';
    participant?: string;
    messageType?: string;
    message?: any;
  };
  destination: string;
  date_time: string;
  sender: string;
  server_url: string;
  apikey: string;
  webhook: string;
  events: string[];
}

// Map Evolution API status to our message log status
const mapEvolutionStatusToMessageStatus = (evolutionStatus: string): 'pending' | 'sent' | 'delivered' | 'read' | 'failed' => {
  switch (evolutionStatus) {
    case 'SERVER_ACK':
      return 'sent';
    case 'DELIVERY_ACK':
      return 'delivered';
    case 'READ':
    case 'PLAYED':
      return 'read';
    case 'ERROR':
      return 'failed';
    case 'PENDING':
    default:
      return 'pending';
  }
};

export class WebhookController {
  static async handleEvolutionWebhook(req: Request, res: Response) {
    try {
      const payload: EvolutionWebhookPayload = req.body;
      
      logger.info('Evolution API webhook received', {
        instance: payload.instance,
        events: payload.events,
        messageId: payload.data?.key?.id,
        status: payload.data?.status,
        remoteJid: payload.data?.key?.remoteJid,
        timestamp: payload.date_time,
      });

      // Validate required fields
      if (!payload.data?.key?.id) {
        logger.warn('Evolution webhook missing message ID', { payload });
        return res.json(createResponse(true, null, 'Webhook received but no message ID provided'));
      }

      // Check if this is a message status update we care about
      if (!payload.events?.includes('MESSAGES_UPDATE') && !payload.events?.includes('MESSAGE_STATUS_UPDATE')) {
        logger.debug('Evolution webhook event not relevant for message status', {
          events: payload.events,
          messageId: payload.data.key.id,
        });
        return res.json(createResponse(true, null, 'Webhook received'));
      }

      const messageId = payload.data.key.id;
      const evolutionStatus = payload.data.status;

      if (!evolutionStatus) {
        logger.debug('Evolution webhook has no status update', {
          messageId,
          events: payload.events,
        });
        return res.json(createResponse(true, null, 'Webhook received but no status update'));
      }

      // Find the message log by WhatsApp message ID
      const messageLog = await MessageLogModel.findByWhatsAppMessageId(messageId);
      
      if (!messageLog) {
        logger.warn('Message log not found for WhatsApp message ID', {
          whatsappMessageId: messageId,
          evolutionStatus,
          instance: payload.instance,
        });
        return res.json(createResponse(true, null, 'Message not found in logs'));
      }

      // Map Evolution status to our message status
      const newStatus = mapEvolutionStatusToMessageStatus(evolutionStatus);
      
      // Don't update if the status is the same or moving backwards
      const statusPriority = {
        'pending': 0,
        'sent': 1,
        'delivered': 2,
        'read': 3,
        'failed': -1, // Failed can happen at any stage
      };

      const currentPriority = statusPriority[messageLog.status];
      const newPriority = statusPriority[newStatus];

      if (newStatus !== 'failed' && newPriority <= currentPriority) {
        logger.debug('Webhook status update ignored (not progressing)', {
          messageId,
          currentStatus: messageLog.status,
          newStatus,
          evolutionStatus,
        });
        return res.json(createResponse(true, null, 'Status update received'));
      }

      // Prepare timestamp updates based on new status
      const timestampUpdates: any = {
        evolution_api_response: {
          ...messageLog.evolution_api_response,
          lastWebhookUpdate: payload,
          lastStatusUpdate: new Date().toISOString(),
        },
      };

      if (newStatus === 'sent' && !messageLog.sent_at) {
        timestampUpdates.sent_at = payload.data.messageTimestamp 
          ? new Date(payload.data.messageTimestamp * 1000) 
          : new Date();
      } else if (newStatus === 'delivered' && !messageLog.delivered_at) {
        timestampUpdates.delivered_at = payload.data.messageTimestamp 
          ? new Date(payload.data.messageTimestamp * 1000) 
          : new Date();
      } else if (newStatus === 'read' && !messageLog.read_at) {
        timestampUpdates.read_at = payload.data.messageTimestamp 
          ? new Date(payload.data.messageTimestamp * 1000) 
          : new Date();
      }

      // Update message status in database
      const updatedMessageLog = await MessageLogModel.updateStatus(
        messageLog.id,
        newStatus,
        timestampUpdates
      );

      if (!updatedMessageLog) {
        logger.error('Failed to update message log status', {
          messageLogId: messageLog.id,
          whatsappMessageId: messageId,
          newStatus,
        });
        return res.status(500).json(createResponse(false, null, 'Failed to update message status'));
      }

      logger.info('Message status updated from Evolution webhook', {
        messageLogId: messageLog.id,
        whatsappMessageId: messageId,
        companyId: messageLog.company_id,
        campaignId: messageLog.campaign_id,
        phone: messageLog.phone,
        oldStatus: messageLog.status,
        newStatus,
        evolutionStatus,
        instance: payload.instance,
      });

      // TODO: Update campaign statistics if this is part of a campaign
      if (messageLog.campaign_id) {
        // This could be implemented to update campaign counters
        logger.debug('Campaign message status updated', {
          campaignId: messageLog.campaign_id,
          newStatus,
        });
      }

      return res.json(createResponse(true, {
        messageLogId: updatedMessageLog.id,
        oldStatus: messageLog.status,
        newStatus,
        updatedAt: updatedMessageLog.updated_at,
      }, 'Message status updated successfully'));

    } catch (error) {
      logger.error('Error processing Evolution API webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
      });

      return res.status(500).json(createResponse(
        false, 
        null, 
        'Error processing webhook'
      ));
    }
  }

  static async handleEvolutionInstanceStatus(req: Request, res: Response) {
    try {
      const payload = req.body;
      
      logger.info('Evolution API instance status webhook received', {
        instance: payload.instance,
        status: payload.data?.instance?.state,
        events: payload.events,
        timestamp: payload.date_time,
      });

      // TODO: Update WhatsApp integration status in database
      // This would require matching the instance name to our whatsapp_integrations table

      return res.json(createResponse(true, null, 'Instance status webhook received'));

    } catch (error) {
      logger.error('Error processing Evolution API instance status webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
      });

      return res.status(500).json(createResponse(
        false, 
        null, 
        'Error processing instance status webhook'
      ));
    }
  }

  static async handleGenericEvolutionWebhook(req: Request, res: Response) {
    try {
      const payload = req.body;
      
      logger.debug('Evolution API generic webhook received', {
        instance: payload.instance,
        events: payload.events,
        timestamp: payload.date_time,
      });

      // Handle different webhook events
      if (payload.events?.includes('MESSAGES_UPDATE') || payload.events?.includes('MESSAGE_STATUS_UPDATE')) {
        return WebhookController.handleEvolutionWebhook(req, res);
      }

      if (payload.events?.includes('CONNECTION_UPDATE') || payload.events?.includes('QRCODE_UPDATED')) {
        return WebhookController.handleEvolutionInstanceStatus(req, res);
      }

      // For all other events, just acknowledge receipt
      return res.json(createResponse(true, null, 'Webhook received'));

    } catch (error) {
      logger.error('Error processing Evolution API generic webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
      });

      return res.status(500).json(createResponse(
        false, 
        null, 
        'Error processing webhook'
      ));
    }
  }
}