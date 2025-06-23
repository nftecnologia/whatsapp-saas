import { jest } from '@jest/globals';
import amqp from 'amqplib';
import rabbitmq from '@/config/rabbitmq';

// Mock amqplib
jest.mock('amqplib');
const mockAmqp = amqp as jest.Mocked<typeof amqp>;

describe('RabbitMQ Configuration', () => {
  let mockConnection: any;
  let mockChannel: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env.RABBITMQ_URL = 'amqp://test:test@localhost:5672';
    process.env.SEND_MESSAGE_QUEUE = 'test_send_message';
    process.env.DLQ_SEND_MESSAGE_QUEUE = 'test_send_message_dlq';
    process.env.MAX_CONCURRENT_JOBS = '5';
    process.env.MAX_RETRY_ATTEMPTS = '3';
    process.env.RETRY_DELAY_MS = '1000';

    // Mock channel
    mockChannel = {
      assertQueue: jest.fn(),
      prefetch: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      publish: jest.fn(),
      close: jest.fn(),
    };

    // Mock connection
    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn(),
      on: jest.fn(),
    };

    mockAmqp.connect.mockResolvedValue(mockConnection);
  });

  describe('connect', () => {
    it('should successfully connect to RabbitMQ', async () => {
      // Act
      await rabbitmq.connect();

      // Assert
      expect(mockAmqp.connect).toHaveBeenCalledWith('amqp://test:test@localhost:5672');
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertQueue).toHaveBeenCalledTimes(2); // DLQ and main queue
      expect(mockChannel.prefetch).toHaveBeenCalledWith(5);
      expect(rabbitmq.isReady()).toBe(true);
    });

    it('should setup queues correctly', async () => {
      // Act
      await rabbitmq.connect();

      // Assert
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('test_send_message_dlq', {
        durable: true,
      });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('test_send_message', {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': 'test_send_message_dlq',
        },
      });
    });

    it('should handle connection errors', async () => {
      // Arrange
      const error = new Error('Connection failed');
      mockAmqp.connect.mockRejectedValue(error);

      // Act & Assert
      await expect(rabbitmq.connect()).rejects.toThrow('Connection failed');
      expect(rabbitmq.isReady()).toBe(false);
    });

    it('should setup connection event handlers', async () => {
      // Act
      await rabbitmq.connect();

      // Assert
      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should use fallback connection URL when RABBITMQ_URL not set', async () => {
      // Arrange
      delete process.env.RABBITMQ_URL;
      process.env.RABBITMQ_USER = 'user';
      process.env.RABBITMQ_PASSWORD = 'pass';
      process.env.RABBITMQ_HOST = 'localhost';
      process.env.RABBITMQ_PORT = '5672';
      process.env.RABBITMQ_VHOST = '/test';

      // Act
      await rabbitmq.connect();

      // Assert
      expect(mockAmqp.connect).toHaveBeenCalledWith('amqp://user:pass@localhost:5672/test');
    });
  });

  describe('consumeMessages', () => {
    beforeEach(async () => {
      await rabbitmq.connect();
    });

    it('should consume messages successfully', async () => {
      // Arrange
      const queue = 'test_queue';
      const callback = jest.fn().mockResolvedValue(undefined);
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ id: 'test-123', data: 'test' })),
        properties: { headers: {} },
      };

      mockChannel.consume.mockImplementation((queueName, handler) => {
        // Simulate message received
        handler(mockMessage);
        return Promise.resolve();
      });

      // Act
      await rabbitmq.consumeMessages(queue, callback);

      // Assert
      expect(mockChannel.consume).toHaveBeenCalledWith(queue, expect.any(Function));
      expect(callback).toHaveBeenCalledWith({ id: 'test-123', data: 'test' });
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle callback errors with retry logic', async () => {
      // Arrange
      const queue = 'test_queue';
      const callback = jest.fn().mockRejectedValue(new Error('Processing failed'));
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ id: 'test-123' })),
        properties: { headers: {} },
      };

      mockChannel.consume.mockImplementation((queueName, handler) => {
        handler(mockMessage);
        return Promise.resolve();
      });

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return {} as any;
      });

      // Act
      await rabbitmq.consumeMessages(queue, callback);

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

    it('should send message to DLQ after max retries', async () => {
      // Arrange
      const queue = 'test_queue';
      const callback = jest.fn().mockRejectedValue(new Error('Processing failed'));
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ id: 'test-123' })),
        properties: { 
          headers: { 'x-retry-count': 3 } // Already at max retries
        },
      };

      mockChannel.consume.mockImplementation((queueName, handler) => {
        handler(mockMessage);
        return Promise.resolve();
      });

      // Act
      await rabbitmq.consumeMessages(queue, callback);

      // Assert
      expect(callback).toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
      expect(mockChannel.publish).not.toHaveBeenCalled();
    });

    it('should handle null messages', async () => {
      // Arrange
      const queue = 'test_queue';
      const callback = jest.fn();

      mockChannel.consume.mockImplementation((queueName, handler) => {
        handler(null); // Simulate null message
        return Promise.resolve();
      });

      // Act
      await rabbitmq.consumeMessages(queue, callback);

      // Assert
      expect(callback).not.toHaveBeenCalled();
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON messages', async () => {
      // Arrange
      const queue = 'test_queue';
      const callback = jest.fn();
      const mockMessage = {
        content: Buffer.from('invalid json'),
        properties: { headers: {} },
      };

      mockChannel.consume.mockImplementation((queueName, handler) => {
        handler(mockMessage);
        return Promise.resolve();
      });

      // Act
      await rabbitmq.consumeMessages(queue, callback);

      // Assert
      expect(callback).not.toHaveBeenCalled();
      // Should handle JSON parsing error and retry
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
    });

    it('should throw error if channel not initialized', async () => {
      // Arrange
      const queue = 'test_queue';
      const callback = jest.fn();
      
      // Reset connection state
      await rabbitmq.close();

      // Act & Assert
      await expect(rabbitmq.consumeMessages(queue, callback))
        .rejects.toThrow('RabbitMQ channel not initialized');
    });
  });

  describe('close', () => {
    it('should close channel and connection successfully', async () => {
      // Arrange
      await rabbitmq.connect();

      // Act
      await rabbitmq.close();

      // Assert
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
      expect(rabbitmq.isReady()).toBe(false);
    });

    it('should handle close errors gracefully', async () => {
      // Arrange
      await rabbitmq.connect();
      mockChannel.close.mockRejectedValue(new Error('Close error'));

      // Act & Assert - Should not throw
      await expect(rabbitmq.close()).resolves.not.toThrow();
    });

    it('should handle case when channel is null', async () => {
      // Arrange - Don't connect first
      
      // Act & Assert - Should not throw
      await expect(rabbitmq.close()).resolves.not.toThrow();
    });
  });

  describe('getChannel', () => {
    it('should return channel when connected', async () => {
      // Arrange
      await rabbitmq.connect();

      // Act
      const channel = rabbitmq.getChannel();

      // Assert
      expect(channel).toBe(mockChannel);
    });

    it('should return null when not connected', () => {
      // Act
      const channel = rabbitmq.getChannel();

      // Assert
      expect(channel).toBeNull();
    });
  });

  describe('isReady', () => {
    it('should return true when connected and channel exists', async () => {
      // Arrange
      await rabbitmq.connect();

      // Act & Assert
      expect(rabbitmq.isReady()).toBe(true);
    });

    it('should return false when not connected', () => {
      // Act & Assert
      expect(rabbitmq.isReady()).toBe(false);
    });

    it('should return false after connection error', async () => {
      // Arrange
      await rabbitmq.connect();
      
      // Simulate connection error
      const errorHandler = mockConnection.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      if (errorHandler) {
        errorHandler(new Error('Connection error'));
      }

      // Act & Assert
      expect(rabbitmq.isReady()).toBe(false);
    });
  });

  describe('connection event handlers', () => {
    beforeEach(async () => {
      await rabbitmq.connect();
    });

    it('should handle connection close event', () => {
      // Arrange
      const closeHandler = mockConnection.on.mock.calls.find(
        call => call[0] === 'close'
      )?.[1];

      // Act
      if (closeHandler) {
        closeHandler();
      }

      // Assert
      expect(rabbitmq.isReady()).toBe(false);
    });

    it('should handle connection error event', () => {
      // Arrange
      const errorHandler = mockConnection.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      // Act
      if (errorHandler) {
        errorHandler(new Error('Connection error'));
      }

      // Assert
      expect(rabbitmq.isReady()).toBe(false);
    });
  });
});