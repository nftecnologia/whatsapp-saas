import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';

// Mock dependencies before importing
jest.mock('@/models/MessageLog', () => ({
  MessageLogModel: {
    findByWhatsAppMessageId: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/utils/response', () => ({
  createResponse: jest.fn((success, data, message, error) => ({
    success,
    data,
    message,
    error,
  })),
}));

// Import after mocking
import { WebhookController } from '@/controllers/webhookController';
import { MessageLogModel } from '@/models/MessageLog';
import logger from '@/utils/logger';

const mockMessageLogModel = MessageLogModel as jest.Mocked<typeof MessageLogModel>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('WebhookController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      ip: '127.0.0.1',
      headers: {},
    };
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleEvolutionWebhook', () => {
    it('should handle message status update webhook successfully', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            id: 'test-message-id-123',
          },
          messageTimestamp: 1640995200,
          status: 'DELIVERY_ACK',
        },
        destination: '5511888888888@s.whatsapp.net',
        date_time: '2023-01-01T12:00:00Z',
        sender: 'test-sender',
        server_url: 'https://api.evolution.com',
        apikey: 'test-api-key',
        webhook: 'https://example.com/webhook',
        events: ['MESSAGES_UPDATE'],
      };

      const mockMessageLog = {
        id: 'log-123',
        company_id: 'company-123',
        campaign_id: 'campaign-123',
        contact_id: 'contact-123',
        phone: '5511999999999',
        message_content: 'Test message',
        status: 'sent' as const,
        whatsapp_message_id: 'test-message-id-123',
        evolution_api_response: {},
        error_message: null,
        sent_at: new Date('2023-01-01T11:00:00Z'),
        delivered_at: null,
        read_at: null,
        created_at: new Date('2023-01-01T10:00:00Z'),
        updated_at: new Date('2023-01-01T11:00:00Z'),
      };

      const mockUpdatedMessageLog = {
        ...mockMessageLog,
        status: 'delivered' as const,
        delivered_at: new Date('2023-01-01T12:00:00Z'),
        updated_at: new Date('2023-01-01T12:00:00Z'),
      };

      mockRequest.body = webhookPayload;
      mockMessageLogModel.findByWhatsAppMessageId.mockResolvedValue(mockMessageLog);
      mockMessageLogModel.updateStatus.mockResolvedValue(mockUpdatedMessageLog);

      await WebhookController.handleEvolutionWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockMessageLogModel.findByWhatsAppMessageId).toHaveBeenCalledWith('test-message-id-123');
      expect(mockMessageLogModel.updateStatus).toHaveBeenCalledWith(
        'log-123',
        'delivered',
        expect.objectContaining({
          evolution_api_response: expect.any(Object),
          delivered_at: expect.any(Date),
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            messageLogId: 'log-123',
            oldStatus: 'sent',
            newStatus: 'delivered',
          }),
          message: 'Message status updated successfully',
        })
      );
    });

    it('should handle webhook with missing message ID', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            // Missing id field
          },
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['MESSAGES_UPDATE'],
      };

      mockRequest.body = webhookPayload;

      await WebhookController.handleEvolutionWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Webhook received but no message ID provided',
        })
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Evolution webhook missing message ID',
        expect.any(Object)
      );
    });

    it('should handle webhook for non-existent message', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            id: 'non-existent-message-id',
          },
          status: 'DELIVERY_ACK',
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['MESSAGES_UPDATE'],
      };

      mockRequest.body = webhookPayload;
      mockMessageLogModel.findByWhatsAppMessageId.mockResolvedValue(null);

      await WebhookController.handleEvolutionWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockMessageLogModel.findByWhatsAppMessageId).toHaveBeenCalledWith('non-existent-message-id');
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Message not found in logs',
        })
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Message log not found for WhatsApp message ID',
        expect.any(Object)
      );
    });

    it('should not update status when moving backwards', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            id: 'test-message-id-123',
          },
          status: 'SERVER_ACK', // This is "sent" status
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['MESSAGES_UPDATE'],
      };

      const mockMessageLog = {
        id: 'log-123',
        company_id: 'company-123',
        campaign_id: 'campaign-123',
        contact_id: 'contact-123',
        phone: '5511999999999',
        message_content: 'Test message',
        status: 'delivered' as const, // Already delivered
        whatsapp_message_id: 'test-message-id-123',
        evolution_api_response: {},
        error_message: null,
        sent_at: new Date('2023-01-01T11:00:00Z'),
        delivered_at: new Date('2023-01-01T11:30:00Z'),
        read_at: null,
        created_at: new Date('2023-01-01T10:00:00Z'),
        updated_at: new Date('2023-01-01T11:30:00Z'),
      };

      mockRequest.body = webhookPayload;
      mockMessageLogModel.findByWhatsAppMessageId.mockResolvedValue(mockMessageLog);

      await WebhookController.handleEvolutionWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockMessageLogModel.findByWhatsAppMessageId).toHaveBeenCalledWith('test-message-id-123');
      expect(mockMessageLogModel.updateStatus).not.toHaveBeenCalled();

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Status update received',
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Webhook status update ignored (not progressing)',
        expect.any(Object)
      );
    });

    it('should handle failed status update', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            id: 'test-message-id-123',
          },
          status: 'ERROR',
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['MESSAGES_UPDATE'],
      };

      const mockMessageLog = {
        id: 'log-123',
        company_id: 'company-123',
        campaign_id: 'campaign-123',
        contact_id: 'contact-123',
        phone: '5511999999999',
        message_content: 'Test message',
        status: 'sent' as const,
        whatsapp_message_id: 'test-message-id-123',
        evolution_api_response: {},
        error_message: null,
        sent_at: new Date('2023-01-01T11:00:00Z'),
        delivered_at: null,
        read_at: null,
        created_at: new Date('2023-01-01T10:00:00Z'),
        updated_at: new Date('2023-01-01T11:00:00Z'),
      };

      const mockUpdatedMessageLog = {
        ...mockMessageLog,
        status: 'failed' as const,
        updated_at: new Date('2023-01-01T12:00:00Z'),
      };

      mockRequest.body = webhookPayload;
      mockMessageLogModel.findByWhatsAppMessageId.mockResolvedValue(mockMessageLog);
      mockMessageLogModel.updateStatus.mockResolvedValue(mockUpdatedMessageLog);

      await WebhookController.handleEvolutionWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockMessageLogModel.updateStatus).toHaveBeenCalledWith(
        'log-123',
        'failed',
        expect.any(Object)
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            messageLogId: 'log-123',
            oldStatus: 'sent',
            newStatus: 'failed',
          }),
        })
      );
    });

    it('should handle database update failure', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            id: 'test-message-id-123',
          },
          status: 'DELIVERY_ACK',
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['MESSAGES_UPDATE'],
      };

      const mockMessageLog = {
        id: 'log-123',
        company_id: 'company-123',
        campaign_id: 'campaign-123',
        contact_id: 'contact-123',
        phone: '5511999999999',
        message_content: 'Test message',
        status: 'sent' as const,
        whatsapp_message_id: 'test-message-id-123',
        evolution_api_response: {},
        error_message: null,
        sent_at: new Date('2023-01-01T11:00:00Z'),
        delivered_at: null,
        read_at: null,
        created_at: new Date('2023-01-01T10:00:00Z'),
        updated_at: new Date('2023-01-01T11:00:00Z'),
      };

      mockRequest.body = webhookPayload;
      mockMessageLogModel.findByWhatsAppMessageId.mockResolvedValue(mockMessageLog);
      mockMessageLogModel.updateStatus.mockResolvedValue(null); // Simulate update failure

      await WebhookController.handleEvolutionWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Failed to update message status',
        })
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update message log status',
        expect.any(Object)
      );
    });

    it('should handle unexpected errors', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            id: 'test-message-id-123',
          },
          status: 'DELIVERY_ACK',
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['MESSAGES_UPDATE'],
      };

      mockRequest.body = webhookPayload;
      mockMessageLogModel.findByWhatsAppMessageId.mockRejectedValue(new Error('Database connection failed'));

      await WebhookController.handleEvolutionWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Error processing webhook',
        })
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing Evolution API webhook',
        expect.objectContaining({
          error: 'Database connection failed',
        })
      );
    });
  });

  describe('handleGenericEvolutionWebhook', () => {
    it('should route message status updates to specific handler', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            id: 'test-message-id-123',
          },
          status: 'READ',
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['MESSAGE_STATUS_UPDATE'],
      };

      mockRequest.body = webhookPayload;
      mockMessageLogModel.findByWhatsAppMessageId.mockResolvedValue(null);

      await WebhookController.handleGenericEvolutionWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Evolution API generic webhook received',
        expect.any(Object)
      );
    });

    it('should handle connection status updates', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          instance: {
            state: 'open',
          },
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['CONNECTION_UPDATE'],
      };

      mockRequest.body = webhookPayload;

      await WebhookController.handleGenericEvolutionWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Instance status webhook received',
        })
      );
    });

    it('should acknowledge other webhook events', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          some: 'data',
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['OTHER_EVENT'],
      };

      mockRequest.body = webhookPayload;

      await WebhookController.handleGenericEvolutionWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Webhook received',
        })
      );
    });
  });
});