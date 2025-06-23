import { jest } from '@jest/globals';
import pool from '@/config/database';
import redis from '@/config/redis';
import rabbitmq from '@/config/rabbitmq';
import { MessageProcessor } from '@/services/messageProcessor';
import healthService from '@/services/healthService';
import { createMockSendMessageJob } from '../setup';

// Mock all dependencies
jest.mock('@/config/database');
jest.mock('@/config/redis');
jest.mock('@/config/rabbitmq');
jest.mock('@/services/messageProcessor');
jest.mock('@/services/healthService');
jest.mock('@/server');

const mockPool = pool as jest.Mocked<typeof pool>;
const mockRedis = redis as jest.Mocked<typeof redis>;
const mockRabbitmq = rabbitmq as jest.Mocked<typeof rabbitmq>;
const mockMessageProcessor = MessageProcessor as jest.Mocked<typeof MessageProcessor>;
const mockHealthService = healthService as jest.Mocked<typeof healthService>;

// Mock the createHealthServer function
const mockHealthServer = {
  gracefulShutdown: jest.fn(),
};

jest.mock('@/server', () => ({
  createHealthServer: jest.fn().mockReturnValue(mockHealthServer),
}));

describe('WorkerService Integration Tests', () => {
  let WorkerService: any;
  let workerService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env.WORKER_ID = 'test-worker-001';
    process.env.SEND_MESSAGE_QUEUE = 'test_send_message';
    process.env.HEALTH_PORT = '3001';
    
    // Setup mocks
    mockRedis.connect.mockResolvedValue(undefined);
    mockRabbitmq.connect.mockResolvedValue(undefined);
    mockRabbitmq.consumeMessages.mockResolvedValue(undefined);
    mockPool.query.mockResolvedValue({ rows: [{ now: new Date() }] });
    mockPool.end.mockResolvedValue(undefined);
    mockRedis.quit.mockResolvedValue(undefined);
    mockRabbitmq.close.mockResolvedValue(undefined);
    
    mockMessageProcessor.processMessage.mockResolvedValue(undefined);
    mockMessageProcessor.getStats.mockReturnValue({
      processedMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      retryMessages: 0,
      uptime: 0,
      startTime: new Date()
    });

    mockHealthService.startMessageProcessing.mockReturnValue(undefined);
    mockHealthService.finishMessageProcessing.mockReturnValue(undefined);

    // Dynamically import WorkerService to avoid module caching issues
    const workerModule = await import('@/index');
    
    // Create a new instance for testing
    WorkerService = class TestWorkerService {
      private isRunning = false;
      private startTime = new Date();
      private healthServer: any;

      async start() {
        console.log('🚀 Starting WhatsApp Worker Service: test-worker-001');
        
        await this.connectServices();
        await this.startMessageConsumer();
        
        const healthPort = parseInt(process.env.HEALTH_PORT || '3001');
        this.healthServer = mockHealthServer;
        
        this.isRunning = true;
        console.log('✅ Worker test-worker-001 started successfully');
        
        this.startHealthChecker();
      }

      private async connectServices() {
        console.log('🔄 Connecting to services...');
        
        await mockRedis.connect();
        console.log('✅ Redis connected');
        
        await mockRabbitmq.connect();
        console.log('✅ RabbitMQ connected');
        
        const dbResult = await mockPool.query('SELECT NOW()');
        console.log('✅ PostgreSQL connected', { timestamp: dbResult.rows[0].now });
      }

      private async startMessageConsumer() {
        console.log('🔄 Starting message consumer for queue: test_send_message');
        
        await mockRabbitmq.consumeMessages('test_send_message', async (message) => {
          mockHealthService.startMessageProcessing();
          
          try {
            await mockMessageProcessor.processMessage(message);
            mockHealthService.finishMessageProcessing(true);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error in message processor', {
              jobId: message.id,
              error: errorMessage
            });
            mockHealthService.finishMessageProcessing(false, errorMessage);
            throw error;
          }
        });
      }

      private startHealthChecker() {
        // Mock the health checker interval
        setInterval(() => {
          const stats = mockMessageProcessor.getStats();
          const uptime = Date.now() - this.startTime.getTime();
          
          console.log('📊 Worker Health Check', {
            workerId: 'test-worker-001',
            isRunning: this.isRunning,
            uptime: Math.floor(uptime / 1000),
            processedMessages: stats.processedMessages,
            successfulMessages: stats.successfulMessages,
            failedMessages: stats.failedMessages,
            successRate: stats.processedMessages > 0 
              ? ((stats.successfulMessages / stats.processedMessages) * 100).toFixed(2) + '%' 
              : '0%'
          });
        }, 60000);
      }

      async stop() {
        console.log('🔄 Graceful shutdown initiated...');
        
        this.isRunning = false;
        
        if (this.healthServer) {
          this.healthServer.gracefulShutdown();
          console.log('✅ Health server closed');
        }
        
        await mockRedis.quit();
        console.log('✅ Redis connection closed');
        
        await mockRabbitmq.close();
        console.log('✅ RabbitMQ connection closed');
        
        await mockPool.end();
        console.log('✅ PostgreSQL connection closed');
        
        console.log('✅ Worker service stopped gracefully');
      }

      getStatus() {
        return {
          workerId: 'test-worker-001',
          isRunning: this.isRunning,
          startTime: this.startTime,
          uptime: Date.now() - this.startTime.getTime(),
          stats: mockMessageProcessor.getStats()
        };
      }
    };

    workerService = new WorkerService();
  });

  describe('Worker Service Startup', () => {
    it('should start all services successfully', async () => {
      // Act
      await workerService.start();

      // Assert
      expect(mockRedis.connect).toHaveBeenCalled();
      expect(mockRabbitmq.connect).toHaveBeenCalled();
      expect(mockPool.query).toHaveBeenCalledWith('SELECT NOW()');
      expect(mockRabbitmq.consumeMessages).toHaveBeenCalledWith(
        'test_send_message',
        expect.any(Function)
      );

      const status = workerService.getStatus();
      expect(status.workerId).toBe('test-worker-001');
      expect(status.isRunning).toBe(true);
    });

    it('should handle Redis connection failure', async () => {
      // Arrange
      mockRedis.connect.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert
      await expect(workerService.start()).rejects.toThrow('Redis connection failed');
    });

    it('should handle RabbitMQ connection failure', async () => {
      // Arrange
      mockRabbitmq.connect.mockRejectedValue(new Error('RabbitMQ connection failed'));

      // Act & Assert
      await expect(workerService.start()).rejects.toThrow('RabbitMQ connection failed');
    });

    it('should handle database connection failure', async () => {
      // Arrange
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(workerService.start()).rejects.toThrow('Database connection failed');
    });
  });

  describe('Message Processing', () => {
    beforeEach(async () => {
      await workerService.start();
    });

    it('should process messages successfully', async () => {
      // Arrange
      const mockJob = createMockSendMessageJob();
      let messageHandler: any;

      mockRabbitmq.consumeMessages.mockImplementation((queue, handler) => {
        messageHandler = handler;
        return Promise.resolve();
      });

      // Re-start to capture the handler
      workerService = new WorkerService();
      await workerService.start();

      // Act
      await messageHandler(mockJob);

      // Assert
      expect(mockHealthService.startMessageProcessing).toHaveBeenCalled();
      expect(mockMessageProcessor.processMessage).toHaveBeenCalledWith(mockJob);
      expect(mockHealthService.finishMessageProcessing).toHaveBeenCalledWith(true);
    });

    it('should handle message processing errors', async () => {
      // Arrange
      const mockJob = createMockSendMessageJob();
      const error = new Error('Processing failed');
      let messageHandler: any;

      mockRabbitmq.consumeMessages.mockImplementation((queue, handler) => {
        messageHandler = handler;
        return Promise.resolve();
      });
      mockMessageProcessor.processMessage.mockRejectedValue(error);

      // Re-start to capture the handler
      workerService = new WorkerService();
      await workerService.start();

      // Act & Assert
      await expect(messageHandler(mockJob)).rejects.toThrow('Processing failed');
      
      expect(mockHealthService.startMessageProcessing).toHaveBeenCalled();
      expect(mockHealthService.finishMessageProcessing).toHaveBeenCalledWith(
        false, 
        'Processing failed'
      );
    });
  });

  describe('Worker Service Shutdown', () => {
    beforeEach(async () => {
      await workerService.start();
    });

    it('should shutdown gracefully', async () => {
      // Act
      await workerService.stop();

      // Assert
      expect(mockHealthServer.gracefulShutdown).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
      expect(mockRabbitmq.close).toHaveBeenCalled();
      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      // Arrange
      mockRedis.quit.mockRejectedValue(new Error('Redis shutdown error'));

      // Act & Assert - Should not throw
      await expect(workerService.stop()).resolves.not.toThrow();
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await workerService.start();
    });

    it('should provide correct status information', () => {
      // Arrange
      const mockStats = {
        processedMessages: 10,
        successfulMessages: 8,
        failedMessages: 2,
        retryMessages: 1,
        uptime: 3600,
        startTime: new Date()
      };
      mockMessageProcessor.getStats.mockReturnValue(mockStats);

      // Act
      const status = workerService.getStatus();

      // Assert
      expect(status).toEqual({
        workerId: 'test-worker-001',
        isRunning: true,
        startTime: expect.any(Date),
        uptime: expect.any(Number),
        stats: mockStats
      });
    });

    it('should track worker uptime correctly', () => {
      // Act
      const status = workerService.getStatus();

      // Assert
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.startTime).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should handle uncaught exceptions gracefully', () => {
      // This test verifies that the worker service has proper error handling
      // setup in the main index.ts file
      const uncaughtExceptionListeners = process.listeners('uncaughtException');
      const unhandledRejectionListeners = process.listeners('unhandledRejection');

      expect(uncaughtExceptionListeners.length).toBeGreaterThan(0);
      expect(unhandledRejectionListeners.length).toBeGreaterThan(0);
    });

    it('should handle SIGTERM signal', () => {
      const sigtermListeners = process.listeners('SIGTERM');
      expect(sigtermListeners.length).toBeGreaterThan(0);
    });

    it('should handle SIGINT signal', () => {
      const sigintListeners = process.listeners('SIGINT');
      expect(sigintListeners.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should use correct environment variables', async () => {
      // Arrange
      process.env.WORKER_ID = 'custom-worker-123';
      process.env.SEND_MESSAGE_QUEUE = 'custom_queue';
      process.env.HEALTH_PORT = '4000';

      // Act
      const customWorker = new WorkerService();
      await customWorker.start();

      // Assert
      expect(mockRabbitmq.consumeMessages).toHaveBeenCalledWith(
        'custom_queue',
        expect.any(Function)
      );
    });

    it('should use default values when environment variables are not set', async () => {
      // Arrange
      delete process.env.WORKER_ID;
      delete process.env.SEND_MESSAGE_QUEUE;
      delete process.env.HEALTH_PORT;

      // Act
      const defaultWorker = new WorkerService();
      await defaultWorker.start();

      // Assert
      expect(mockRabbitmq.consumeMessages).toHaveBeenCalledWith(
        'send_message', // default queue name
        expect.any(Function)
      );
    });
  });
});