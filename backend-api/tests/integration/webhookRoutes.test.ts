import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import webhookRoutes from '@/routes/webhooks';
import { MessageLogModel } from '@/models/MessageLog';

// Mock dependencies
jest.mock('@/models/MessageLog');
jest.mock('@/utils/logger');

const mockMessageLogModel = MessageLogModel as jest.Mocked<typeof MessageLogModel>;

describe('Webhook Routes Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/webhooks', webhookRoutes);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /webhooks/evolution', () => {
    it('should accept valid Evolution API webhook', async () => {
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

      mockMessageLogModel.findByWhatsAppMessageId.mockResolvedValue(mockMessageLog);
      mockMessageLogModel.updateStatus.mockResolvedValue(mockUpdatedMessageLog);

      const response = await request(app)
        .post('/webhooks/evolution')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          messageLogId: 'log-123',
          oldStatus: 'sent',
          newStatus: 'delivered',
        },
        message: 'Message status updated successfully',
      });
    });

    it('should reject webhook with missing required fields', async () => {
      const invalidPayload = {
        instance: 'test-instance',
        // Missing data object
        date_time: '2023-01-01T12:00:00Z',
        events: ['MESSAGES_UPDATE'],
      };

      const response = await request(app)
        .post('/webhooks/evolution')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid webhook payload',
      });
    });

    it('should reject webhook with invalid data types', async () => {
      const invalidPayload = {
        instance: 123, // Should be string
        data: 'invalid', // Should be object
        date_time: '2023-01-01T12:00:00Z',
        events: 'invalid', // Should be array
      };

      const response = await request(app)
        .post('/webhooks/evolution')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid webhook payload',
      });

      expect(response.body.error).toContain('Instance is required');
    });

    it('should handle webhook rate limiting', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            id: 'test-message-id',
          },
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['OTHER_EVENT'],
      };

      // Make many requests quickly to trigger rate limiting
      const promises = Array.from({ length: 105 }, (_, i) => 
        request(app)
          .post('/webhooks/evolution')
          .send({
            ...webhookPayload,
            data: {
              ...webhookPayload.data,
              key: {
                ...webhookPayload.data.key,
                id: `test-message-id-${i}`,
              },
            },
          })
      );

      const responses = await Promise.allSettled(promises);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('POST /webhooks/evolution/messages', () => {
    it('should handle message-specific webhook', async () => {
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
        events: ['MESSAGES_UPDATE'],
      };

      const mockMessageLog = {
        id: 'log-123',
        company_id: 'company-123',
        campaign_id: 'campaign-123',
        contact_id: 'contact-123',
        phone: '5511999999999',
        message_content: 'Test message',
        status: 'delivered' as const,
        whatsapp_message_id: 'test-message-id-123',
        evolution_api_response: {},
        error_message: null,
        sent_at: new Date('2023-01-01T11:00:00Z'),
        delivered_at: new Date('2023-01-01T11:30:00Z'),
        read_at: null,
        created_at: new Date('2023-01-01T10:00:00Z'),
        updated_at: new Date('2023-01-01T11:30:00Z'),
      };

      const mockUpdatedMessageLog = {
        ...mockMessageLog,
        status: 'read' as const,
        read_at: new Date('2023-01-01T12:00:00Z'),
        updated_at: new Date('2023-01-01T12:00:00Z'),
      };

      mockMessageLogModel.findByWhatsAppMessageId.mockResolvedValue(mockMessageLog);
      mockMessageLogModel.updateStatus.mockResolvedValue(mockUpdatedMessageLog);

      const response = await request(app)
        .post('/webhooks/evolution/messages')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          messageLogId: 'log-123',
          oldStatus: 'delivered',
          newStatus: 'read',
        },
        message: 'Message status updated successfully',
      });
    });
  });

  describe('POST /webhooks/evolution/instance', () => {
    it('should handle instance status webhook', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          instance: {
            state: 'open',
            displayName: 'Test Bot',
          },
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['CONNECTION_UPDATE'],
      };

      const response = await request(app)
        .post('/webhooks/evolution/instance')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Instance status webhook received',
      });
    });
  });

  describe('GET /webhooks/health', () => {
    it('should return webhook service health status', async () => {
      const response = await request(app)
        .get('/webhooks/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          timestamp: expect.any(String),
          endpoints: {
            'POST /webhooks/evolution': 'Evolution API unified webhook',
            'POST /webhooks/evolution/messages': 'Message status updates',
            'POST /webhooks/evolution/instance': 'Instance status updates',
          },
        },
        message: 'Webhook service is healthy',
      });
    });
  });

  describe('Authentication Middleware', () => {
    it('should accept webhook with API key in header', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            id: 'test-message-id',
          },
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['OTHER_EVENT'],
      };

      const response = await request(app)
        .post('/webhooks/evolution')
        .set('x-api-key', 'test-api-key')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept webhook with API key in body', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            id: 'test-message-id',
          },
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['OTHER_EVENT'],
        apikey: 'test-api-key',
      };

      const response = await request(app)
        .post('/webhooks/evolution')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept webhook with Authorization header', async () => {
      const webhookPayload = {
        instance: 'test-instance',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: true,
            id: 'test-message-id',
          },
        },
        date_time: '2023-01-01T12:00:00Z',
        events: ['OTHER_EVENT'],
      };

      const response = await request(app)
        .post('/webhooks/evolution')
        .set('Authorization', 'Bearer test-token')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/webhooks/evolution')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      // Express handles malformed JSON before our routes
      expect(response.status).toBe(400);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/webhooks/evolution')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid webhook payload',
      });
    });

    it('should handle server errors gracefully', async () => {
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

      // Mock a database error
      mockMessageLogModel.findByWhatsAppMessageId.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/webhooks/evolution')
        .send(webhookPayload)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Error processing webhook',
      });
    });
  });
});