import { jest } from '@jest/globals';
import { MessageProcessor } from '@/services/messageProcessor';
import evolutionApiService from '@/services/evolutionApiService';
import { DatabaseService } from '@/services/databaseService';
import { 
  createMockSendMessageJob, 
  createMockWhatsAppIntegration, 
  createMockEvolutionAPIResponse,
  createMockMessageLog 
} from '../setup';

// Mock the services
jest.mock('@/services/evolutionApiService');
jest.mock('@/services/databaseService');

const mockEvolutionApiService = evolutionApiService as jest.Mocked<typeof evolutionApiService>;
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

describe('MessageProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MessageProcessor.resetStats();
    
    // Setup default mocks
    mockEvolutionApiService.isValidPhone.mockReturnValue(true);
    mockEvolutionApiService.formatPhoneNumber.mockImplementation((phone) => phone);
  });

  describe('processMessage', () => {
    it('should successfully process a valid message job', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      const integration = createMockWhatsAppIntegration();
      const apiResponse = createMockEvolutionAPIResponse(true);
      const messageLog = createMockMessageLog({ status: 'sent' });

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockEvolutionApiService.sendTextMessage.mockResolvedValue(apiResponse);
      mockDatabaseService.createMessageLog.mockResolvedValue(messageLog);
      mockDatabaseService.updateCampaignContactStatus.mockResolvedValue();
      mockDatabaseService.logWorkerActivity.mockResolvedValue();

      // Act
      await MessageProcessor.processMessage(job);

      // Assert
      expect(mockEvolutionApiService.isValidPhone).toHaveBeenCalledWith(job.phone);
      expect(mockEvolutionApiService.formatPhoneNumber).toHaveBeenCalledWith(job.phone);
      expect(mockEvolutionApiService.sendTextMessage).toHaveBeenCalledWith(
        integration.instance_key,
        job.phone,
        job.message_content
      );
      expect(mockDatabaseService.createMessageLog).toHaveBeenCalledWith({
        company_id: job.company_id,
        campaign_id: job.campaign_id,
        contact_id: job.contact_id,
        phone: job.phone,
        message_content: job.message_content,
        status: 'sent',
        whatsapp_message_id: apiResponse.messageId,
        evolution_api_response: {
          jobId: job.id,
          instanceKey: integration.instance_key,
          response: apiResponse.data
        }
      });
      expect(mockDatabaseService.updateCampaignContactStatus).toHaveBeenCalledWith(
        job.campaign_id,
        job.contact_id,
        'sent'
      );

      const stats = MessageProcessor.getStats();
      expect(stats.processedMessages).toBe(1);
      expect(stats.successfulMessages).toBe(1);
      expect(stats.failedMessages).toBe(0);
    });

    it('should handle invalid job data', async () => {
      // Arrange
      const invalidJob = createMockSendMessageJob({ phone: '' });

      // Act & Assert
      await expect(MessageProcessor.processMessage(invalidJob)).rejects.toThrow(
        'Invalid job data: missing required fields'
      );

      const stats = MessageProcessor.getStats();
      expect(stats.processedMessages).toBe(0);
      expect(stats.failedMessages).toBe(1);
    });

    it('should handle message content too long', async () => {
      // Arrange
      const longMessage = 'A'.repeat(4097);
      const job = createMockSendMessageJob({ message_content: longMessage });

      // Act & Assert
      await expect(MessageProcessor.processMessage(job)).rejects.toThrow(
        'Message content too long (max 4096 characters)'
      );
    });

    it('should handle invalid phone number', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      mockEvolutionApiService.isValidPhone.mockReturnValue(false);

      // Act & Assert
      await expect(MessageProcessor.processMessage(job)).rejects.toThrow(
        `Invalid phone number: ${job.phone}`
      );
    });

    it('should handle missing WhatsApp integration', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(null);
      mockDatabaseService.getActiveWhatsAppIntegration.mockResolvedValue(null);

      // Act & Assert
      await expect(MessageProcessor.processMessage(job)).rejects.toThrow(
        'No active WhatsApp integration found for company'
      );
    });

    it('should handle disconnected WhatsApp integration', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      const integration = createMockWhatsAppIntegration({ status: 'disconnected' });
      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);

      // Act & Assert
      await expect(MessageProcessor.processMessage(job)).rejects.toThrow(
        'WhatsApp integration is disconnected, not connected'
      );
    });

    it('should handle Evolution API failure', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      const integration = createMockWhatsAppIntegration();
      const apiResponse = createMockEvolutionAPIResponse(false, { error: 'API Error' });
      const messageLog = createMockMessageLog({ status: 'failed' });

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockEvolutionApiService.sendTextMessage.mockResolvedValue(apiResponse);
      mockDatabaseService.createMessageLog.mockResolvedValue(messageLog);
      mockDatabaseService.updateCampaignContactStatus.mockResolvedValue();
      mockDatabaseService.logWorkerActivity.mockResolvedValue();

      // Act & Assert
      await expect(MessageProcessor.processMessage(job)).rejects.toThrow('API Error');

      expect(mockDatabaseService.createMessageLog).toHaveBeenCalledWith({
        company_id: job.company_id,
        campaign_id: job.campaign_id,
        contact_id: job.contact_id,
        phone: job.phone,
        message_content: job.message_content,
        status: 'failed',
        error_message: 'API Error',
        evolution_api_response: {
          jobId: job.id,
          error: 'API Error'
        }
      });
      expect(mockDatabaseService.updateCampaignContactStatus).toHaveBeenCalledWith(
        job.campaign_id,
        job.contact_id,
        'failed',
        'API Error'
      );
    });

    it('should use active integration when specific integration not found', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      const activeIntegration = createMockWhatsAppIntegration({ id: 'active-integration' });
      const apiResponse = createMockEvolutionAPIResponse(true);
      const messageLog = createMockMessageLog({ status: 'sent' });

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(null);
      mockDatabaseService.getActiveWhatsAppIntegration.mockResolvedValue(activeIntegration);
      mockEvolutionApiService.sendTextMessage.mockResolvedValue(apiResponse);
      mockDatabaseService.createMessageLog.mockResolvedValue(messageLog);
      mockDatabaseService.updateCampaignContactStatus.mockResolvedValue();
      mockDatabaseService.logWorkerActivity.mockResolvedValue();

      // Act
      await MessageProcessor.processMessage(job);

      // Assert
      expect(mockDatabaseService.getWhatsAppIntegration).toHaveBeenCalledWith(
        job.integration_id,
        job.company_id
      );
      expect(mockDatabaseService.getActiveWhatsAppIntegration).toHaveBeenCalledWith(
        job.company_id
      );
      expect(mockEvolutionApiService.sendTextMessage).toHaveBeenCalledWith(
        activeIntegration.instance_key,
        job.phone,
        job.message_content
      );
    });

    it('should handle database errors during message logging', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      const integration = createMockWhatsAppIntegration();
      const apiResponse = createMockEvolutionAPIResponse(true);

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockEvolutionApiService.sendTextMessage.mockResolvedValue(apiResponse);
      mockDatabaseService.createMessageLog.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(MessageProcessor.processMessage(job)).rejects.toThrow('Database error');
    });

    it('should handle jobs without campaign_id or contact_id', async () => {
      // Arrange
      const job = createMockSendMessageJob({ 
        campaign_id: undefined, 
        contact_id: 'contact-789' // Still has contact_id but no campaign_id
      });
      const integration = createMockWhatsAppIntegration();
      const apiResponse = createMockEvolutionAPIResponse(true);
      const messageLog = createMockMessageLog({ status: 'sent' });

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockEvolutionApiService.sendTextMessage.mockResolvedValue(apiResponse);
      mockDatabaseService.createMessageLog.mockResolvedValue(messageLog);
      mockDatabaseService.logWorkerActivity.mockResolvedValue();

      // Act
      await MessageProcessor.processMessage(job);

      // Assert
      expect(mockDatabaseService.updateCampaignContactStatus).not.toHaveBeenCalled();
      expect(mockDatabaseService.createMessageLog).toHaveBeenCalled();
      expect(mockDatabaseService.logWorkerActivity).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return correct initial stats', () => {
      const stats = MessageProcessor.getStats();
      
      expect(stats.processedMessages).toBe(0);
      expect(stats.successfulMessages).toBe(0);
      expect(stats.failedMessages).toBe(0);
      expect(stats.retryMessages).toBe(0);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.startTime).toBeInstanceOf(Date);
    });

    it('should track stats across multiple operations', async () => {
      // Arrange
      const job1 = createMockSendMessageJob({ id: 'job-1' });
      const job2 = createMockSendMessageJob({ id: 'job-2' });
      const integration = createMockWhatsAppIntegration();
      const successResponse = createMockEvolutionAPIResponse(true);
      const failResponse = createMockEvolutionAPIResponse(false);
      const messageLog = createMockMessageLog();

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockDatabaseService.createMessageLog.mockResolvedValue(messageLog);
      mockDatabaseService.updateCampaignContactStatus.mockResolvedValue();
      mockDatabaseService.logWorkerActivity.mockResolvedValue();

      // Mock first job success, second job failure
      mockEvolutionApiService.sendTextMessage
        .mockResolvedValueOnce(successResponse)
        .mockResolvedValueOnce(failResponse);

      // Act
      await MessageProcessor.processMessage(job1);
      try {
        await MessageProcessor.processMessage(job2);
      } catch (error) {
        // Expected to fail
      }

      // Assert
      const stats = MessageProcessor.getStats();
      expect(stats.processedMessages).toBe(1); // Only successful ones increment processed
      expect(stats.successfulMessages).toBe(1);
      expect(stats.failedMessages).toBe(1);
    });
  });

  describe('resetStats', () => {
    it('should reset all stats to initial values', async () => {
      // Arrange - process a message to modify stats
      const job = createMockSendMessageJob();
      const integration = createMockWhatsAppIntegration();
      const apiResponse = createMockEvolutionAPIResponse(true);
      const messageLog = createMockMessageLog();

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockEvolutionApiService.sendTextMessage.mockResolvedValue(apiResponse);
      mockDatabaseService.createMessageLog.mockResolvedValue(messageLog);
      mockDatabaseService.updateCampaignContactStatus.mockResolvedValue();
      mockDatabaseService.logWorkerActivity.mockResolvedValue();

      await MessageProcessor.processMessage(job);

      // Verify stats are modified
      let stats = MessageProcessor.getStats();
      expect(stats.processedMessages).toBe(1);

      // Act
      MessageProcessor.resetStats();

      // Assert
      stats = MessageProcessor.getStats();
      expect(stats.processedMessages).toBe(0);
      expect(stats.successfulMessages).toBe(0);
      expect(stats.failedMessages).toBe(0);
      expect(stats.retryMessages).toBe(0);
    });
  });
});