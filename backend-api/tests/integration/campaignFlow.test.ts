import request from 'supertest';
import express from 'express';
import authRoutes from '@/routes/auth';
import companyRoutes from '@/routes/companies';
import contactRoutes from '@/routes/contacts';
import templateRoutes from '@/routes/templates';
import campaignRoutes from '@/routes/campaigns';
import messageLogRoutes from '@/routes/messageLogs';
import { mockUser, mockCompany, mockDbQuery, mockRabbitMQSuccess, mockRedisSuccess } from '../setup';

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = mockUser;
  req.company = mockCompany;
  next();
});

// Setup routes
app.use('/auth', authRoutes);
app.use('/companies', companyRoutes);
app.use('/contacts', contactRoutes);
app.use('/templates', templateRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/message-logs', messageLogRoutes);

describe('Campaign Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisSuccess();
    mockRabbitMQSuccess();
  });

  describe('Complete Campaign Creation and Execution Flow', () => {
    it('should complete full campaign lifecycle', async () => {
      // Step 1: Create a contact
      const contactData = {
        name: 'Integration Test Contact',
        phone: '+5511999999999',
        email: 'integration@test.com',
        tags: ['integration-test']
      };

      const createdContact = {
        id: 'contact-integration-id',
        company_id: mockCompany.id,
        ...contactData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Step 2: Create a template
      const templateData = {
        name: 'Integration Test Template',
        content: 'Hello {{name}}, this is an integration test message!',
        category: 'marketing'
      };

      const createdTemplate = {
        id: 'template-integration-id',
        company_id: mockCompany.id,
        ...templateData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Step 3: Create a campaign
      const campaignData = {
        name: 'Integration Test Campaign',
        template_id: 'template-integration-id',
        contact_ids: ['contact-integration-id'],
        variables: { product: 'WhatsApp SaaS' }
      };

      const createdCampaign = {
        id: 'campaign-integration-id',
        company_id: mockCompany.id,
        status: 'draft',
        total_contacts: 1,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        ...campaignData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Step 4: Send the campaign
      const sentCampaign = {
        ...createdCampaign,
        status: 'running'
      };

      // Step 5: Message logs created
      const messageLog = {
        id: 'message-log-integration-id',
        campaign_id: 'campaign-integration-id',
        contact_id: 'contact-integration-id',
        phone: '+5511999999999',
        message_content: 'Hello Integration Test Contact, this is an integration test message!',
        status: 'sent',
        whatsapp_message_id: 'wamid.integration123',
        evolution_api_response: { success: true },
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString()
      };

      // Mock database responses for the entire flow
      const mockPool = require('@/config/database');
      mockPool.query
        // Contact creation
        .mockResolvedValueOnce({ rows: [createdContact] })
        // Template creation
        .mockResolvedValueOnce({ rows: [createdTemplate] })
        // Campaign creation - template validation
        .mockResolvedValueOnce({ rows: [createdTemplate] })
        // Campaign creation - contact validation
        .mockResolvedValueOnce({ rows: [createdContact] })
        // Campaign creation
        .mockResolvedValueOnce({ rows: [createdCampaign] })
        // Campaign send - get campaign
        .mockResolvedValueOnce({ rows: [createdCampaign] })
        // Campaign send - get contacts
        .mockResolvedValueOnce({ rows: [createdContact] })
        // Campaign send - update status
        .mockResolvedValueOnce({ rows: [sentCampaign] })
        // Message logs query
        .mockResolvedValueOnce({ rows: [messageLog] })
        // Message logs count
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      // Execute the complete flow
      
      // 1. Create contact
      const contactResponse = await request(app)
        .post('/contacts')
        .send(contactData)
        .expect(201);

      expect(contactResponse.body.success).toBe(true);
      expect(contactResponse.body.data.name).toBe(contactData.name);

      // 2. Create template
      const templateResponse = await request(app)
        .post('/templates')
        .send(templateData)
        .expect(201);

      expect(templateResponse.body.success).toBe(true);
      expect(templateResponse.body.data.name).toBe(templateData.name);

      // 3. Create campaign
      const campaignResponse = await request(app)
        .post('/campaigns')
        .send(campaignData)
        .expect(201);

      expect(campaignResponse.body.success).toBe(true);
      expect(campaignResponse.body.data.name).toBe(campaignData.name);
      expect(campaignResponse.body.data.status).toBe('draft');

      // 4. Send campaign
      const sendResponse = await request(app)
        .post(`/campaigns/${createdCampaign.id}/send`)
        .expect(200);

      expect(sendResponse.body.success).toBe(true);
      expect(sendResponse.body.message).toContain('Campaign started');

      // 5. Verify message logs
      const logsResponse = await request(app)
        .get(`/message-logs/campaign/${createdCampaign.id}`)
        .expect(200);

      expect(logsResponse.body.success).toBe(true);
      expect(logsResponse.body.data).toHaveLength(1);
      expect(logsResponse.body.data[0].status).toBe('sent');

      // Verify RabbitMQ was called
      const mockRabbitMQ = require('@/config/rabbitmq');
      expect(mockRabbitMQ.publishToQueue).toHaveBeenCalledWith(
        'send_messages',
        expect.objectContaining({
          campaign_id: createdCampaign.id,
          company_id: mockCompany.id
        })
      );
    });

    it('should handle validation errors in campaign flow', async () => {
      // Try to create campaign with non-existent template
      const campaignData = {
        name: 'Invalid Campaign',
        template_id: 'non-existent-template',
        contact_ids: ['some-contact-id'],
        variables: {}
      };

      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Template not found

      const response = await request(app)
        .post('/campaigns')
        .send(campaignData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Template not found');
    });

    it('should prevent sending campaign without contacts', async () => {
      // Create campaign
      const campaignData = {
        name: 'Empty Campaign',
        template_id: 'template-id',
        contact_ids: [],
        variables: {}
      };

      const campaignWithoutContacts = {
        id: 'empty-campaign-id',
        company_id: mockCompany.id,
        status: 'draft',
        total_contacts: 0,
        ...campaignData
      };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [campaignWithoutContacts] }) // Get campaign
        .mockResolvedValueOnce({ rows: [] }); // No contacts

      const response = await request(app)
        .post(`/campaigns/${campaignWithoutContacts.id}/send`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No contacts found');
    });
  });

  describe('Campaign Performance Tracking Flow', () => {
    it('should track campaign performance metrics', async () => {
      const campaignId = 'performance-campaign-id';
      
      // Mock campaign with performance data
      const campaignPerformance = {
        campaign_id: campaignId,
        campaign_name: 'Performance Test Campaign',
        total_sent: '100',
        delivered: '95',
        read: '80',
        failed: '5',
        success_rate: '95.0',
        delivery_rate: '95.0',
        read_rate: '84.2',
        avg_delivery_time: '42'
      };

      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [campaignPerformance] });

      const response = await request(app)
        .get(`/campaigns/${campaignId}/performance`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalSent).toBe(100);
      expect(response.body.data.delivered).toBe(95);
      expect(response.body.data.successRate).toBe(95.0);
      expect(response.body.data.avgDeliveryTime).toBe(42);
    });
  });

  describe('Campaign Scheduling Flow', () => {
    it('should schedule and execute campaign at specified time', async () => {
      const campaignId = 'scheduled-campaign-id';
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const draftCampaign = {
        id: campaignId,
        company_id: mockCompany.id,
        status: 'draft',
        name: 'Scheduled Campaign'
      };

      const scheduledCampaign = {
        ...draftCampaign,
        status: 'scheduled',
        scheduled_at: futureDate
      };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [draftCampaign] }) // Get campaign
        .mockResolvedValueOnce({ rows: [scheduledCampaign] }); // Update schedule

      // Schedule the campaign
      const scheduleResponse = await request(app)
        .post(`/campaigns/${campaignId}/schedule`)
        .send({ scheduled_at: futureDate })
        .expect(200);

      expect(scheduleResponse.body.success).toBe(true);
      expect(scheduleResponse.body.data.status).toBe('scheduled');
      expect(scheduleResponse.body.data.scheduled_at).toBe(futureDate);
    });

    it('should reject scheduling in the past', async () => {
      const campaignId = 'invalid-schedule-campaign-id';
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .post(`/campaigns/${campaignId}/schedule`)
        .send({ scheduled_at: pastDate })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('future');
    });
  });

  describe('Campaign Pause and Resume Flow', () => {
    it('should pause and resume running campaign', async () => {
      const campaignId = 'pause-resume-campaign-id';

      const runningCampaign = {
        id: campaignId,
        company_id: mockCompany.id,
        status: 'running',
        name: 'Pause Resume Campaign'
      };

      const pausedCampaign = {
        ...runningCampaign,
        status: 'paused'
      };

      const resumedCampaign = {
        ...runningCampaign,
        status: 'running'
      };

      const mockPool = require('@/config/database');
      mockPool.query
        // Pause flow
        .mockResolvedValueOnce({ rows: [runningCampaign] }) // Get campaign for pause
        .mockResolvedValueOnce({ rows: [pausedCampaign] }) // Update to paused
        // Resume flow
        .mockResolvedValueOnce({ rows: [pausedCampaign] }) // Get campaign for resume
        .mockResolvedValueOnce({ rows: [resumedCampaign] }); // Update to running

      // Pause the campaign
      const pauseResponse = await request(app)
        .post(`/campaigns/${campaignId}/pause`)
        .expect(200);

      expect(pauseResponse.body.success).toBe(true);
      expect(pauseResponse.body.data.status).toBe('paused');

      // Resume the campaign
      const resumeResponse = await request(app)
        .post(`/campaigns/${campaignId}/resume`)
        .expect(200);

      expect(resumeResponse.body.success).toBe(true);
      expect(resumeResponse.body.data.status).toBe('running');
    });
  });

  describe('Bulk Contact Import and Campaign Creation Flow', () => {
    it('should import contacts and create campaign', async () => {
      // Bulk contact creation
      const bulkContactData = {
        contacts: [
          {
            name: 'Bulk Contact 1',
            phone: '+5511111111111',
            email: 'bulk1@test.com',
            tags: ['bulk-import']
          },
          {
            name: 'Bulk Contact 2',
            phone: '+5511111111112',
            email: 'bulk2@test.com',
            tags: ['bulk-import']
          }
        ]
      };

      const createdContacts = bulkContactData.contacts.map((contact, index) => ({
        id: `bulk-contact-${index}`,
        company_id: mockCompany.id,
        ...contact,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Template for campaign
      const template = {
        id: 'bulk-template-id',
        company_id: mockCompany.id,
        name: 'Bulk Campaign Template',
        content: 'Hello {{name}}, welcome to our bulk campaign!',
        category: 'marketing'
      };

      // Campaign with bulk contacts
      const campaignData = {
        name: 'Bulk Import Campaign',
        template_id: template.id,
        contact_ids: createdContacts.map(c => c.id),
        variables: { campaign_type: 'bulk' }
      };

      const createdCampaign = {
        id: 'bulk-campaign-id',
        company_id: mockCompany.id,
        status: 'draft',
        total_contacts: 2,
        ...campaignData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const mockPool = require('@/config/database');
      mockPool.query
        // Bulk contact creation
        .mockResolvedValueOnce({ rows: createdContacts })
        // Campaign creation - template validation
        .mockResolvedValueOnce({ rows: [template] })
        // Campaign creation - contact validation
        .mockResolvedValueOnce({ rows: createdContacts })
        // Campaign creation
        .mockResolvedValueOnce({ rows: [createdCampaign] });

      // 1. Create bulk contacts
      const contactsResponse = await request(app)
        .post('/contacts/bulk')
        .send(bulkContactData)
        .expect(201);

      expect(contactsResponse.body.success).toBe(true);
      expect(contactsResponse.body.data).toHaveLength(2);

      // 2. Create campaign with bulk contacts
      const campaignResponse = await request(app)
        .post('/campaigns')
        .send(campaignData)
        .expect(201);

      expect(campaignResponse.body.success).toBe(true);
      expect(campaignResponse.body.data.total_contacts).toBe(2);
      expect(campaignResponse.body.data.name).toBe(campaignData.name);
    });
  });

  describe('Error Recovery Flow', () => {
    it('should handle and recover from service failures', async () => {
      const campaignId = 'error-recovery-campaign-id';

      const campaign = {
        id: campaignId,
        company_id: mockCompany.id,
        status: 'draft',
        name: 'Error Recovery Campaign'
      };

      const contact = {
        id: 'error-contact-id',
        company_id: mockCompany.id,
        name: 'Error Contact',
        phone: '+5511999999999'
      };

      // First attempt - RabbitMQ fails
      const mockRabbitMQ = require('@/config/rabbitmq');
      mockRabbitMQ.publishToQueue.mockRejectedValueOnce(new Error('RabbitMQ connection failed'));

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [campaign] }) // Get campaign
        .mockResolvedValueOnce({ rows: [contact] }) // Get contacts
        .mockResolvedValueOnce({ rows: [{ ...campaign, status: 'running' }] }) // Update to running
        .mockResolvedValueOnce({ rows: [campaign] }); // Rollback to draft

      // First attempt should fail
      const firstAttempt = await request(app)
        .post(`/campaigns/${campaignId}/send`)
        .expect(500);

      expect(firstAttempt.body.success).toBe(false);
      expect(firstAttempt.body.message).toContain('Failed to queue campaign messages');

      // Second attempt - RabbitMQ succeeds
      mockRabbitMQ.publishToQueue.mockResolvedValueOnce(true);

      mockPool.query
        .mockResolvedValueOnce({ rows: [campaign] }) // Get campaign
        .mockResolvedValueOnce({ rows: [contact] }) // Get contacts
        .mockResolvedValueOnce({ rows: [{ ...campaign, status: 'running' }] }); // Update to running

      // Second attempt should succeed
      const secondAttempt = await request(app)
        .post(`/campaigns/${campaignId}/send`)
        .expect(200);

      expect(secondAttempt.body.success).toBe(true);
      expect(secondAttempt.body.message).toContain('Campaign started');
    });
  });
});