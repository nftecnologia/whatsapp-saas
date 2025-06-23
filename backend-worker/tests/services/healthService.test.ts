import { jest } from '@jest/globals';
import healthService, { WorkerHealthService } from '@/services/healthService';
import pool from '@/config/database';
import redis from '@/config/redis';
import rabbitmq from '@/config/rabbitmq';

// Mock dependencies
jest.mock('@/config/database');
jest.mock('@/config/redis');
jest.mock('@/config/rabbitmq');

const mockPool = pool as jest.Mocked<typeof pool>;
const mockRedis = redis as jest.Mocked<typeof redis>;
const mockRabbitmq = rabbitmq as jest.Mocked<typeof rabbitmq>;

describe('HealthService', () => {
  let healthServiceInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a fresh instance for each test
    healthServiceInstance = new (WorkerHealthService as any)();
    
    // Reset environment variables
    process.env.SEND_MESSAGE_QUEUE = 'test_send_message';
    process.env.npm_package_version = '1.0.0';
    process.env.NODE_ENV = 'test';
  });

  describe('Database Health Check', () => {
    it('should return healthy status when database is connected', async () => {
      // Arrange
      const mockResult = {
        rows: [{ current_time: new Date('2023-01-01T12:00:00Z') }]
      };
      mockPool.query.mockResolvedValue(mockResult);

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.services.database.status).toBe('connected');
      expect(health.services.database.responseTime).toBeGreaterThanOrEqual(0);
      expect(health.services.database.details).toContain('Connected at');
      expect(health.services.database.lastChecked).toBeTruthy();
    });

    it('should return error status when database connection fails', async () => {
      // Arrange
      const dbError = new Error('Connection refused');
      mockPool.query.mockRejectedValue(dbError);

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.services.database.status).toBe('error');
      expect(health.services.database.details).toBe('Connection refused');
      expect(health.services.database.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Redis Health Check', () => {
    it('should return healthy status when Redis is connected', async () => {
      // Arrange
      mockRedis.ping.mockResolvedValue('PONG');

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.services.redis.status).toBe('connected');
      expect(health.services.redis.details).toBe('Ping response: PONG');
      expect(health.services.redis.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return error status when Redis ping fails', async () => {
      // Arrange
      const redisError = new Error('Redis connection lost');
      mockRedis.ping.mockRejectedValue(redisError);

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.services.redis.status).toBe('error');
      expect(health.services.redis.details).toBe('Redis connection lost');
    });

    it('should return error status when Redis returns unexpected ping response', async () => {
      // Arrange
      mockRedis.ping.mockResolvedValue('UNEXPECTED');

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.services.redis.status).toBe('error');
      expect(health.services.redis.details).toBe('Ping response: UNEXPECTED');
    });
  });

  describe('RabbitMQ Health Check', () => {
    let mockChannel: any;

    beforeEach(() => {
      mockChannel = {
        checkQueue: jest.fn(),
      };
    });

    it('should return healthy status when RabbitMQ is connected and consuming', async () => {
      // Arrange
      mockRabbitmq.getChannel.mockReturnValue(mockChannel);
      mockChannel.checkQueue.mockResolvedValue({
        messageCount: 5,
        consumerCount: 1
      });

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.services.rabbitmq.status).toBe('connected');
      expect(health.services.rabbitmq.details).toBe('Channel available and consuming messages');
      expect(health.services.rabbitmq.queueStatus).toEqual({
        queueName: 'test_send_message',
        messageCount: 5,
        consumerCount: 1,
        isConsuming: true
      });
    });

    it('should return connected status even when queue check fails', async () => {
      // Arrange
      mockRabbitmq.getChannel.mockReturnValue(mockChannel);
      mockChannel.checkQueue.mockRejectedValue(new Error('Queue not found'));

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.services.rabbitmq.status).toBe('connected');
      expect(health.services.rabbitmq.queueStatus).toEqual({
        queueName: 'test_send_message',
        isConsuming: false
      });
    });

    it('should return disconnected status when no channel available', async () => {
      // Arrange
      mockRabbitmq.getChannel.mockReturnValue(null);

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.services.rabbitmq.status).toBe('disconnected');
      expect(health.services.rabbitmq.details).toBe('No active channel available');
    });

    it('should return error status when RabbitMQ check throws error', async () => {
      // Arrange
      mockRabbitmq.getChannel.mockImplementation(() => {
        throw new Error('RabbitMQ connection error');
      });

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.services.rabbitmq.status).toBe('error');
      expect(health.services.rabbitmq.details).toBe('RabbitMQ connection error');
    });
  });

  describe('Overall Health Status', () => {
    beforeEach(() => {
      // Setup default successful responses
      mockPool.query.mockResolvedValue({ rows: [{ current_time: new Date() }] });
      mockRedis.ping.mockResolvedValue('PONG');
      mockRabbitmq.getChannel.mockReturnValue({ checkQueue: jest.fn().mockResolvedValue({ messageCount: 0, consumerCount: 1 }) });
    });

    it('should return healthy status when all services are connected', async () => {
      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.status).toBe('healthy');
    });

    it('should return degraded status when some services are connected', async () => {
      // Arrange
      mockRedis.ping.mockRejectedValue(new Error('Redis error'));

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.status).toBe('degraded');
    });

    it('should return unhealthy status when no services are connected', async () => {
      // Arrange
      mockPool.query.mockRejectedValue(new Error('DB error'));
      mockRedis.ping.mockRejectedValue(new Error('Redis error'));
      mockRabbitmq.getChannel.mockReturnValue(null);

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('System Metrics', () => {
    it('should return system metrics', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({ rows: [{ current_time: new Date() }] });
      mockRedis.ping.mockResolvedValue('PONG');
      mockRabbitmq.getChannel.mockReturnValue({ checkQueue: jest.fn().mockResolvedValue({ messageCount: 0, consumerCount: 1 }) });

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.system).toEqual({
        platform: expect.any(String),
        arch: expect.any(String),
        nodeVersion: expect.any(String),
        memory: {
          used: expect.any(Number),
          free: expect.any(Number),
          total: expect.any(Number),
          usagePercentage: expect.any(Number)
        },
        cpu: {
          loadAverage: expect.any(Array)
        }
      });
    });
  });

  describe('Worker Metrics Tracking', () => {
    it('should track message processing correctly', () => {
      // Act
      healthServiceInstance.startMessageProcessing();
      healthServiceInstance.finishMessageProcessing(true);

      const metrics = healthServiceInstance.getMetrics();

      // Assert
      expect(metrics.messagesProcessed).toBe(1);
      expect(metrics.messagesSuccessful).toBe(1);
      expect(metrics.messagesFailed).toBe(0);
      expect(metrics.isProcessing).toBe(false);
      expect(metrics.lastMessageProcessedAt).toBeTruthy();
    });

    it('should track failed message processing', () => {
      // Act
      healthServiceInstance.startMessageProcessing();
      healthServiceInstance.finishMessageProcessing(false, 'Test error');

      const metrics = healthServiceInstance.getMetrics();

      // Assert
      expect(metrics.messagesProcessed).toBe(1);
      expect(metrics.messagesSuccessful).toBe(0);
      expect(metrics.messagesFailed).toBe(1);
      expect(metrics.lastError).toBe('Test error');
      expect(metrics.lastErrorAt).toBeTruthy();
    });

    it('should track processing times', () => {
      // Mock Date.now for consistent timing
      const originalDateNow = Date.now;
      let currentTime = 1000;
      Date.now = jest.fn(() => currentTime);

      // Act
      healthServiceInstance.startMessageProcessing();
      currentTime += 500; // Simulate 500ms processing time
      healthServiceInstance.finishMessageProcessing(true);

      const metrics = healthServiceInstance.getMetrics();

      // Assert
      expect(metrics.averageProcessingTime).toBe(500);

      // Cleanup
      Date.now = originalDateNow;
    });

    it('should limit processing times history to 1000 entries', () => {
      // Arrange
      const originalDateNow = Date.now;
      let currentTime = 1000;
      Date.now = jest.fn(() => currentTime);

      // Act - Process 1001 messages
      for (let i = 0; i < 1001; i++) {
        healthServiceInstance.startMessageProcessing();
        currentTime += 100;
        healthServiceInstance.finishMessageProcessing(true);
      }

      // Verify internal state (access via reflection)
      const processingTimes = (healthServiceInstance as any).processingTimes;
      expect(processingTimes.length).toBe(1000);

      // Cleanup
      Date.now = originalDateNow;
    });

    it('should track retry count', () => {
      // Act
      healthServiceInstance.incrementRetry();
      healthServiceInstance.incrementRetry();

      const metrics = healthServiceInstance.getMetrics();

      // Assert
      expect(metrics.messagesRetried).toBe(2);
    });

    it('should update queue backlog', () => {
      // Act
      healthServiceInstance.updateQueueBacklog(15);

      const metrics = healthServiceInstance.getMetrics();

      // Assert
      expect(metrics.queueBacklog).toBe(15);
    });

    it('should calculate processing rate correctly', async () => {
      // Arrange
      const originalDateNow = Date.now;
      let currentTime = 1000;
      Date.now = jest.fn(() => currentTime);

      // Reset start time
      (healthServiceInstance as any).startTime = currentTime;

      // Process some messages
      healthServiceInstance.finishMessageProcessing(true);
      healthServiceInstance.finishMessageProcessing(true);
      
      // Advance time by 1 minute
      currentTime += 60000;

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert - Should be 2 messages per minute
      expect(health.worker.processingRate).toBe(2);

      // Cleanup
      Date.now = originalDateNow;
    });
  });

  describe('Liveness and Readiness Checks', () => {
    it('should return alive status for liveness check', async () => {
      // Act
      const liveness = await healthServiceInstance.getLivenessCheck();

      // Assert
      expect(liveness.status).toBe('alive');
      expect(liveness.timestamp).toBeTruthy();
    });

    it('should return ready when healthy and consuming', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({ rows: [{ current_time: new Date() }] });
      mockRedis.ping.mockResolvedValue('PONG');
      mockRabbitmq.getChannel.mockReturnValue({ 
        checkQueue: jest.fn().mockResolvedValue({ 
          messageCount: 0, 
          consumerCount: 1 
        }) 
      });

      // Act
      const readiness = await healthServiceInstance.getReadinessCheck();

      // Assert
      expect(readiness.status).toBe('healthy');
      expect(readiness.ready).toBe(true);
    });

    it('should return not ready when not consuming messages', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({ rows: [{ current_time: new Date() }] });
      mockRedis.ping.mockResolvedValue('PONG');
      mockRabbitmq.getChannel.mockReturnValue({ 
        checkQueue: jest.fn().mockResolvedValue({ 
          messageCount: 5, 
          consumerCount: 0 // Not consuming
        }) 
      });

      // Act
      const readiness = await healthServiceInstance.getReadinessCheck();

      // Assert
      expect(readiness.ready).toBe(false);
    });
  });

  describe('Health Check Metadata', () => {
    it('should include correct metadata in health check', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({ rows: [{ current_time: new Date() }] });
      mockRedis.ping.mockResolvedValue('PONG');
      mockRabbitmq.getChannel.mockReturnValue({ 
        checkQueue: jest.fn().mockResolvedValue({ messageCount: 0, consumerCount: 1 }) 
      });

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.timestamp).toBeTruthy();
      expect(health.version).toBe('1.0.0');
      expect(health.environment).toBe('test');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should use default values for missing environment variables', async () => {
      // Arrange
      delete process.env.npm_package_version;
      delete process.env.NODE_ENV;
      
      mockPool.query.mockResolvedValue({ rows: [{ current_time: new Date() }] });
      mockRedis.ping.mockResolvedValue('PONG');
      mockRabbitmq.getChannel.mockReturnValue({ 
        checkQueue: jest.fn().mockResolvedValue({ messageCount: 0, consumerCount: 1 }) 
      });

      // Act
      const health = await healthServiceInstance.getHealthCheck();

      // Assert
      expect(health.version).toBe('1.0.0'); // default
      expect(health.environment).toBe('development'); // default
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      // Act
      const instance1 = (WorkerHealthService as any).getInstance();
      const instance2 = (WorkerHealthService as any).getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });
  });
});