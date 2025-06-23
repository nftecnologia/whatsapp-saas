import { jest } from '@jest/globals';
import { DatabaseService } from '@/services/databaseService';
import pool from '@/config/database';
import { 
  createMockMessageLog, 
  createMockWhatsAppIntegration 
} from '../setup';

// Mock the database pool
jest.mock('@/config/database');
const mockPool = pool as jest.Mocked<typeof pool>;

describe('DatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMessageLog', () => {
    it('should create a new message log', async () => {
      // Arrange
      const logData = {
        company_id: 'company-123',
        campaign_id: 'campaign-456',
        contact_id: 'contact-789',
        phone: '+5511999999999',
        message_content: 'Test message',
        status: 'pending' as const,
        whatsapp_message_id: 'msg-123',
        evolution_api_response: { test: 'data' },
        error_message: undefined
      };
      const mockResult = createMockMessageLog(logData);

      mockPool.query.mockResolvedValue({ rows: [mockResult] });

      // Act
      const result = await DatabaseService.createMessageLog(logData);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        `INSERT INTO message_logs 
       (company_id, campaign_id, contact_id, phone, message_content, status, whatsapp_message_id, evolution_api_response, error_message) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
        [
          logData.company_id,
          logData.campaign_id,
          logData.contact_id,
          logData.phone,
          logData.message_content,
          logData.status,
          logData.whatsapp_message_id,
          logData.evolution_api_response,
          logData.error_message
        ]
      );
      expect(result).toEqual(mockResult);
    });

    it('should create message log with default status', async () => {
      // Arrange
      const logData = {
        company_id: 'company-123',
        phone: '+5511999999999',
        message_content: 'Test message'
      };
      const mockResult = createMockMessageLog({ ...logData, status: 'pending' });

      mockPool.query.mockResolvedValue({ rows: [mockResult] });

      // Act
      const result = await DatabaseService.createMessageLog(logData);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          logData.company_id,
          undefined, // campaign_id
          undefined, // contact_id
          logData.phone,
          logData.message_content,
          'pending', // default status
          undefined, // whatsapp_message_id
          undefined, // evolution_api_response
          undefined  // error_message
        ])
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateMessageLog', () => {
    it('should update message log status only', async () => {
      // Arrange
      const messageLogId = 'log-123';
      const status = 'sent';
      const mockResult = createMockMessageLog({ id: messageLogId, status });

      mockPool.query.mockResolvedValue({ rows: [mockResult] });

      // Act
      const result = await DatabaseService.updateMessageLog(messageLogId, status);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE message_logs SET status = $2, sent_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [messageLogId, status]
      );
      expect(result).toEqual(mockResult);
    });

    it('should update message log with additional fields', async () => {
      // Arrange
      const messageLogId = 'log-123';
      const status = 'failed';
      const updates = {
        error_message: 'Test error',
        evolution_api_response: { error: 'API Error' }
      };
      const mockResult = createMockMessageLog({ id: messageLogId, status, ...updates });

      mockPool.query.mockResolvedValue({ rows: [mockResult] });

      // Act
      const result = await DatabaseService.updateMessageLog(messageLogId, status, updates);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE message_logs SET status = $2, error_message = $3, evolution_api_response = $4 WHERE id = $1 RETURNING *',
        [messageLogId, status, updates.error_message, updates.evolution_api_response]
      );
      expect(result).toEqual(mockResult);
    });

    it('should return null when no rows affected', async () => {
      // Arrange
      const messageLogId = 'non-existent';
      const status = 'sent';

      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await DatabaseService.updateMessageLog(messageLogId, status);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findMessageLogByJobId', () => {
    it('should find message log by job ID', async () => {
      // Arrange
      const jobId = 'job-123';
      const mockResult = createMockMessageLog({
        evolution_api_response: { jobId }
      });

      mockPool.query.mockResolvedValue({ rows: [mockResult] });

      // Act
      const result = await DatabaseService.findMessageLogByJobId(jobId);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        `SELECT * FROM message_logs 
       WHERE evolution_api_response->>'jobId' = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
        [jobId]
      );
      expect(result).toEqual(mockResult);
    });

    it('should return null when job ID not found', async () => {
      // Arrange
      const jobId = 'non-existent';

      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await DatabaseService.findMessageLogByJobId(jobId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findMessageLogsByPhone', () => {
    it('should find message logs by phone and company', async () => {
      // Arrange
      const phone = '+5511999999999';
      const companyId = 'company-123';
      const limit = 5;
      const mockResults = [
        createMockMessageLog({ phone, company_id: companyId }),
        createMockMessageLog({ phone, company_id: companyId })
      ];

      mockPool.query.mockResolvedValue({ rows: mockResults });

      // Act
      const result = await DatabaseService.findMessageLogsByPhone(phone, companyId, limit);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        `SELECT * FROM message_logs 
       WHERE phone = $1 AND company_id = $2 
       ORDER BY created_at DESC 
       LIMIT $3`,
        [phone, companyId, limit]
      );
      expect(result).toEqual(mockResults);
    });

    it('should use default limit when not provided', async () => {
      // Arrange
      const phone = '+5511999999999';
      const companyId = 'company-123';

      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      await DatabaseService.findMessageLogsByPhone(phone, companyId);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [phone, companyId, 10] // default limit
      );
    });
  });

  describe('getWhatsAppIntegration', () => {
    it('should get WhatsApp integration by ID and company', async () => {
      // Arrange
      const integrationId = 'integration-456';
      const companyId = 'company-123';
      const mockResult = createMockWhatsAppIntegration({
        id: integrationId,
        company_id: companyId
      });

      mockPool.query.mockResolvedValue({ rows: [mockResult] });

      // Act
      const result = await DatabaseService.getWhatsAppIntegration(integrationId, companyId);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM whatsapp_integrations WHERE id = $1 AND company_id = $2 AND is_active = true',
        [integrationId, companyId]
      );
      expect(result).toEqual(mockResult);
    });

    it('should return null when integration not found', async () => {
      // Arrange
      const integrationId = 'non-existent';
      const companyId = 'company-123';

      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await DatabaseService.getWhatsAppIntegration(integrationId, companyId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getActiveWhatsAppIntegration', () => {
    it('should get active WhatsApp integration for company', async () => {
      // Arrange
      const companyId = 'company-123';
      const mockResult = createMockWhatsAppIntegration({
        company_id: companyId,
        status: 'connected',
        is_active: true
      });

      mockPool.query.mockResolvedValue({ rows: [mockResult] });

      // Act
      const result = await DatabaseService.getActiveWhatsAppIntegration(companyId);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        `SELECT * FROM whatsapp_integrations 
       WHERE company_id = $1 AND is_active = true AND status = 'connected' 
       ORDER BY created_at DESC 
       LIMIT 1`,
        [companyId]
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateCampaignContactStatus', () => {
    it('should update campaign contact status to sent', async () => {
      // Arrange
      const campaignId = 'campaign-456';
      const contactId = 'contact-789';
      const status = 'sent';

      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      await DatabaseService.updateCampaignContactStatus(campaignId, contactId, status);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        `UPDATE campaign_contacts 
       SET status = $3, sent_at = CURRENT_TIMESTAMP 
       WHERE campaign_id = $1 AND contact_id = $2`,
        [campaignId, contactId, status]
      );
    });

    it('should update campaign contact status with error message', async () => {
      // Arrange
      const campaignId = 'campaign-456';
      const contactId = 'contact-789';
      const status = 'failed';
      const errorMessage = 'Test error';

      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      await DatabaseService.updateCampaignContactStatus(campaignId, contactId, status, errorMessage);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        `UPDATE campaign_contacts 
       SET status = $3, error_message = $4 
       WHERE campaign_id = $1 AND contact_id = $2`,
        [campaignId, contactId, status, errorMessage]
      );
    });

    it('should call updateCampaignStats after updating contact', async () => {
      // Arrange
      const campaignId = 'campaign-456';
      const contactId = 'contact-789';
      const status = 'sent';

      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      await DatabaseService.updateCampaignContactStatus(campaignId, contactId, status);

      // Assert
      expect(mockPool.query).toHaveBeenCalledTimes(2); // One for update, one for stats
    });
  });

  describe('updateCampaignStats', () => {
    it('should update campaign statistics', async () => {
      // Arrange
      const campaignId = 'campaign-456';

      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      await DatabaseService.updateCampaignStats(campaignId);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        `UPDATE campaigns SET 
        sent_count = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status IN ('sent', 'delivered')),
        delivered_count = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status = 'delivered'),
        failed_count = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status = 'failed')
       WHERE id = $1`,
        [campaignId]
      );
    });
  });

  describe('getCampaignInfo', () => {
    it('should get campaign information with company name', async () => {
      // Arrange
      const campaignId = 'campaign-456';
      const mockResult = {
        id: campaignId,
        name: 'Test Campaign',
        company_name: 'Test Company'
      };

      mockPool.query.mockResolvedValue({ rows: [mockResult] });

      // Act
      const result = await DatabaseService.getCampaignInfo(campaignId);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        `SELECT c.*, co.name as company_name 
       FROM campaigns c 
       JOIN companies co ON c.company_id = co.id 
       WHERE c.id = $1`,
        [campaignId]
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getContactInfo', () => {
    it('should get contact information', async () => {
      // Arrange
      const contactId = 'contact-789';
      const mockResult = {
        id: contactId,
        name: 'Test Contact',
        phone: '+5511999999999'
      };

      mockPool.query.mockResolvedValue({ rows: [mockResult] });

      // Act
      const result = await DatabaseService.getContactInfo(contactId);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM contacts WHERE id = $1',
        [contactId]
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('logWorkerActivity', () => {
    it('should log worker activity successfully', async () => {
      // Arrange
      const workerId = 'worker-001';
      const activity = 'message_sent';
      const data = { jobId: 'job-123', phone: '+5511999999999' };

      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      await DatabaseService.logWorkerActivity(workerId, activity, data);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        `INSERT INTO worker_logs (worker_id, activity, data, created_at) 
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [workerId, activity, data]
      );
    });

    it('should handle logging errors gracefully', async () => {
      // Arrange
      const workerId = 'worker-001';
      const activity = 'message_sent';
      const data = { jobId: 'job-123' };

      mockPool.query.mockRejectedValue(new Error('Database error'));

      // Act & Assert - Should not throw
      await expect(DatabaseService.logWorkerActivity(workerId, activity, data))
        .resolves.not.toThrow();
    });

    it('should log worker activity without data', async () => {
      // Arrange
      const workerId = 'worker-001';
      const activity = 'worker_started';

      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      await DatabaseService.logWorkerActivity(workerId, activity);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [workerId, activity, undefined]
      );
    });
  });
});