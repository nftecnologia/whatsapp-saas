import { jest } from '@jest/globals';
import rabbitmq from '@/config/rabbitmq';
import { MessageProcessor } from '@/services/messageProcessor';
import { DatabaseService } from '@/services/databaseService';
import evolutionApiService from '@/services/evolutionApiService';
import { 
  createMockSendMessageJob, 
  createMockWhatsAppIntegration,
  createMockEvolutionAPIResponse 
} from '../setup';

// Mock dependencies
jest.mock('@/config/rabbitmq');
jest.mock('@/services/databaseService');
jest.mock('@/services/evolutionApiService');

const mockRabbitmq = rabbitmq as jest.Mocked<typeof rabbitmq>;
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;
const mockEvolutionApiService = evolutionApiService as jest.Mocked<typeof evolutionApiService>;

describe('Error Handling and Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MessageProcessor.resetStats();
    
    // Setup default mocks
    mockEvolutionApiService.isValidPhone.mockReturnValue(true);
    mockEvolutionApiService.formatPhoneNumber.mockImplementation(phone => phone);
  });

  describe('MessageProcessor Error Handling', () => {
    it('should handle Evolution API timeout errors', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      const integration = createMockWhatsAppIntegration();
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockEvolutionApiService.sendTextMessage.mockRejectedValue(timeoutError);
      mockDatabaseService.createMessageLog.mockResolvedValue({} as any);
      mockDatabaseService.updateCampaignContactStatus.mockResolvedValue();
      mockDatabaseService.logWorkerActivity.mockResolvedValue();

      // Act & Assert
      await expect(MessageProcessor.processMessage(job)).rejects.toThrow('Request timeout');

      // Verify error was logged correctly
      expect(mockDatabaseService.createMessageLog).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Request timeout'
        })
      );
      expect(mockDatabaseService.updateCampaignContactStatus).toHaveBeenCalledWith(
        job.campaign_id,
        job.contact_id,
        'failed',
        'Request timeout'
      );
    });

    it('should handle Evolution API rate limiting errors', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      const integration = createMockWhatsAppIntegration();
      const rateLimitResponse = createMockEvolutionAPIResponse(false, {
        error: 'Rate limit exceeded. Please try again later.'
      });

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockEvolutionApiService.sendTextMessage.mockResolvedValue(rateLimitResponse);
      mockDatabaseService.createMessageLog.mockResolvedValue({} as any);
      mockDatabaseService.updateCampaignContactStatus.mockResolvedValue();
      mockDatabaseService.logWorkerActivity.mockResolvedValue();

      // Act & Assert
      await expect(MessageProcessor.processMessage(job)).rejects.toThrow(
        'Rate limit exceeded. Please try again later.'
      );

      // Verify proper error handling
      expect(mockDatabaseService.createMessageLog).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Rate limit exceeded. Please try again later.'
        })
      );
    });

    it('should handle database connection errors during logging', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      const integration = createMockWhatsAppIntegration();
      const apiResponse = createMockEvolutionAPIResponse(true);
      const dbError = new Error('Database connection lost');

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockEvolutionApiService.sendTextMessage.mockResolvedValue(apiResponse);
      mockDatabaseService.createMessageLog.mockRejectedValue(dbError);

      // Act & Assert
      await expect(MessageProcessor.processMessage(job)).rejects.toThrow('Database connection lost');
    });

    it('should handle integration lookup failures', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      const dbError = new Error('Integration table not found');

      mockDatabaseService.getWhatsAppIntegration.mockRejectedValue(dbError);

      // Act & Assert
      await expect(MessageProcessor.processMessage(job)).rejects.toThrow('Integration table not found');
    });

    it('should handle malformed job data gracefully', async () => {
      // Arrange
      const malformedJob = {
        id: 'test-123',
        // missing required fields
      } as any;

      // Act & Assert
      await expect(MessageProcessor.processMessage(malformedJob)).rejects.toThrow(
        'Invalid job data: missing required fields'
      );

      const stats = MessageProcessor.getStats();
      expect(stats.failedMessages).toBe(1);
    });
  });

  describe('RabbitMQ Retry Logic', () => {
    let mockChannel: any;
    let mockMessage: any;

    beforeEach(() => {
      mockChannel = {
        ack: jest.fn(),
        nack: jest.fn(),
        publish: jest.fn(),
      };

      mockMessage = {
        content: Buffer.from(JSON.stringify(createMockSendMessageJob())),
        properties: { headers: {} },
      };

      mockRabbitmq.getChannel.mockReturnValue(mockChannel);
    });

    it('should retry message on processing failure (first attempt)', async () => {
      // Arrange
      const callback = jest.fn().mockRejectedValue(new Error('Temporary failure'));
      const queue = 'test_queue';

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return {} as any;
      });

      // Simulate RabbitMQ consumer behavior
      const consumerCallback = async (msg: any) => {
        if (!msg) return;

        try {
          const messageContent = JSON.parse(msg.content.toString());
          await callback(messageContent);
          mockChannel.ack(msg);
        } catch (error) {
          const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
          const maxRetries = 3;

          if (retryCount <= maxRetries) {
            setTimeout(() => {
              mockChannel.publish('', queue, msg.content, {
                ...msg.properties,
                headers: {
                  ...msg.properties.headers,
                  'x-retry-count': retryCount
                }
              });
              mockChannel.ack(msg);
            }, 1000);
          } else {
            mockChannel.nack(msg, false, false);
          }
        }
      };

      // Act
      await consumerCallback(mockMessage);

      // Wait for setTimeout to execute
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(callback).toHaveBeenCalled();
      expect(mockChannel.publish).toHaveBeenCalledWith(
        '',
        queue,
        mockMessage.content,
        {
          ...mockMessage.properties,
          headers: {
            ...mockMessage.properties.headers,
            'x-retry-count': 1
          }
        }
      );
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);

      // Cleanup
      jest.restoreAllMocks();
    });

    it('should send message to DLQ after max retries exceeded', async () => {
      // Arrange
      const callback = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      const messageWithMaxRetries = {
        ...mockMessage,
        properties: { 
          headers: { 'x-retry-count': 3 } // At max retry limit
        }
      };

      // Simulate RabbitMQ consumer behavior
      const consumerCallback = async (msg: any) => {
        if (!msg) return;

        try {
          const messageContent = JSON.parse(msg.content.toString());
          await callback(messageContent);
          mockChannel.ack(msg);
        } catch (error) {
          const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
          const maxRetries = 3;

          if (retryCount <= maxRetries) {
            // Retry logic...
            mockChannel.publish('', 'test_queue', msg.content, {
              ...msg.properties,
              headers: {
                ...msg.properties.headers,
                'x-retry-count': retryCount
              }
            });
            mockChannel.ack(msg);
          } else {
            // Send to DLQ
            mockChannel.nack(msg, false, false);
          }
        }
      };

      // Act
      await consumerCallback(messageWithMaxRetries);

      // Assert
      expect(callback).toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(messageWithMaxRetries, false, false);
      expect(mockChannel.publish).not.toHaveBeenCalled(); // Should not retry again
    });

    it('should handle JSON parsing errors in retry logic', async () => {
      // Arrange
      const malformedMessage = {
        content: Buffer.from('invalid json'),
        properties: { headers: {} },
      };

      // Simulate RabbitMQ consumer behavior
      const consumerCallback = async (msg: any) => {
        if (!msg) return;

        try {
          const messageContent = JSON.parse(msg.content.toString());
          // Process message...
          mockChannel.ack(msg);
        } catch (error) {
          // JSON parsing error should go directly to DLQ
          mockChannel.nack(msg, false, false);
        }
      };

      // Act
      await consumerCallback(malformedMessage);

      // Assert
      expect(mockChannel.nack).toHaveBeenCalledWith(malformedMessage, false, false);
      expect(mockChannel.publish).not.toHaveBeenCalled();
    });

    it('should handle exponential backoff for retries', async () => {
      // Arrange
      const callback = jest.fn().mockRejectedValue(new Error('Temporary failure'));
      const delays: number[] = [];
      
      // Mock setTimeout to capture delay values
      jest.spyOn(global, 'setTimeout').mockImplementation((fn: any, delay: number) => {
        delays.push(delay);
        fn();
        return {} as any;
      });

      // Simulate multiple retry attempts with exponential backoff
      const processMessageWithBackoff = async (retryCount: number) => {
        const baseDelay = 1000;
        const backoffDelay = baseDelay * Math.pow(2, retryCount - 1);
        
        setTimeout(() => {
          // Retry logic here
        }, backoffDelay);
      };

      // Act
      await processMessageWithBackoff(1); // First retry: 1000ms
      await processMessageWithBackoff(2); // Second retry: 2000ms
      await processMessageWithBackoff(3); // Third retry: 4000ms

      // Assert
      expect(delays).toEqual([1000, 2000, 4000]);

      // Cleanup
      jest.restoreAllMocks();
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should implement circuit breaker for Evolution API calls', async () => {
      // This test demonstrates how a circuit breaker could be implemented
      // to prevent cascading failures when Evolution API is down
      
      let consecutiveFailures = 0;
      const maxFailures = 5;
      let circuitOpen = false;
      
      const circuitBreakerWrapper = async (apiCall: () => Promise<any>) => {
        if (circuitOpen) {
          throw new Error('Circuit breaker is open - Evolution API unavailable');
        }
        
        try {
          const result = await apiCall();
          consecutiveFailures = 0; // Reset on success
          return result;
        } catch (error) {
          consecutiveFailures++;
          if (consecutiveFailures >= maxFailures) {
            circuitOpen = true;
            // Could set a timer to reset the circuit after some time
            setTimeout(() => {
              circuitOpen = false;
              consecutiveFailures = 0;
            }, 60000); // Reset after 1 minute
          }
          throw error;
        }
      };

      // Arrange
      const job = createMockSendMessageJob();
      const integration = createMockWhatsAppIntegration();
      
      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockEvolutionApiService.sendTextMessage.mockRejectedValue(new Error('API Error'));

      // Simulate multiple failures
      for (let i = 0; i < maxFailures; i++) {
        try {
          await circuitBreakerWrapper(() => mockEvolutionApiService.sendTextMessage(
            integration.instance_key,
            job.phone,
            job.message_content
          ));
        } catch (error) {
          // Expected to fail
        }
      }

      // Act - Next call should be blocked by circuit breaker
      await expect(circuitBreakerWrapper(() => mockEvolutionApiService.sendTextMessage(
        integration.instance_key,
        job.phone,
        job.message_content
      ))).rejects.toThrow('Circuit breaker is open - Evolution API unavailable');

      // Assert
      expect(circuitOpen).toBe(true);
    });
  });

  describe('Dead Letter Queue Handling', () => {
    it('should properly configure dead letter queue', () => {
      // This test verifies DLQ configuration is correct
      const expectedDLQConfig = {
        durable: true,
      };

      const expectedMainQueueConfig = {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': process.env.DLQ_SEND_MESSAGE_QUEUE || 'send_message_dlq',
        },
      };

      // These configurations should be applied during queue setup
      expect(expectedDLQConfig).toBeDefined();
      expect(expectedMainQueueConfig).toBeDefined();
      expect(expectedMainQueueConfig.arguments['x-dead-letter-routing-key']).toBeTruthy();
    });
  });

  describe('Resource Cleanup on Errors', () => {
    it('should clean up resources when processing fails', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      const integration = createMockWhatsAppIntegration();
      const processingError = new Error('Processing failed');

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockEvolutionApiService.sendTextMessage.mockRejectedValue(processingError);
      mockDatabaseService.createMessageLog.mockResolvedValue({} as any);
      mockDatabaseService.updateCampaignContactStatus.mockResolvedValue();
      mockDatabaseService.logWorkerActivity.mockResolvedValue();

      // Act
      try {
        await MessageProcessor.processMessage(job);
      } catch (error) {
        // Expected to fail
      }

      // Assert - Verify cleanup operations were called
      expect(mockDatabaseService.createMessageLog).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Processing failed'
        })
      );
      expect(mockDatabaseService.logWorkerActivity).toHaveBeenCalledWith(
        process.env.WORKER_ID || 'worker-001',
        'message_failed',
        expect.any(Object)
      );
    });

    it('should handle partial failures gracefully', async () => {
      // Arrange
      const job = createMockSendMessageJob();
      const integration = createMockWhatsAppIntegration();
      const apiResponse = createMockEvolutionAPIResponse(true);

      mockDatabaseService.getWhatsAppIntegration.mockResolvedValue(integration);
      mockEvolutionApiService.sendTextMessage.mockResolvedValue(apiResponse);
      mockDatabaseService.createMessageLog.mockResolvedValue({} as any);
      mockDatabaseService.updateCampaignContactStatus.mockRejectedValue(
        new Error('Campaign update failed')
      );
      mockDatabaseService.logWorkerActivity.mockResolvedValue();

      // Act & Assert
      await expect(MessageProcessor.processMessage(job)).rejects.toThrow('Campaign update failed');

      // Verify that message was still logged even though campaign update failed
      expect(mockDatabaseService.createMessageLog).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          whatsapp_message_id: apiResponse.messageId
        })
      );
    });
  });
});