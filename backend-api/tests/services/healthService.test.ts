import healthService from '@/services/healthService';
import { mockDbQuery, mockDbError, mockRedisSuccess, mockRabbitMQSuccess } from '../setup';

describe('HealthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealthCheck', () => {
    it('should return healthy status when all services are connected', async () => {
      // Arrange
      mockDbQuery({ current_time: new Date().toISOString() });
      mockRedisSuccess();
      mockRabbitMQSuccess();

      // Act
      const result = await healthService.getHealthCheck();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.services.database.status).toBe('connected');
      expect(result.services.redis.status).toBe('connected');
      expect(result.services.rabbitmq.status).toBe('connected');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.system).toBeDefined();
      expect(result.system.memory).toBeDefined();
      expect(result.system.cpu).toBeDefined();
    });

    it('should return degraded status when some services are down', async () => {
      // Arrange
      mockDbQuery({ current_time: new Date().toISOString() });
      mockDbError(new Error('Redis connection failed'));
      mockRabbitMQSuccess();

      const mockRedis = require('@/config/redis');
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));

      // Act
      const result = await healthService.getHealthCheck();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.services.database.status).toBe('connected');
      expect(result.services.redis.status).toBe('error');
      expect(result.services.redis.details).toContain('Redis connection failed');
      expect(result.services.rabbitmq.status).toBe('connected');
    });

    it('should return unhealthy status when all services are down', async () => {
      // Arrange
      mockDbError(new Error('Database connection failed'));
      
      const mockRedis = require('@/config/redis');
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));
      
      const mockRabbitMQ = require('@/config/rabbitmq');
      mockRabbitMQ.getChannel.mockReturnValue(null);

      // Act
      const result = await healthService.getHealthCheck();

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.services.database.status).toBe('error');
      expect(result.services.redis.status).toBe('error');
      expect(result.services.rabbitmq.status).toBe('disconnected');
    });

    it('should include response times for all services', async () => {
      // Arrange
      mockDbQuery({ current_time: new Date().toISOString() });
      mockRedisSuccess();
      mockRabbitMQSuccess();

      // Act
      const result = await healthService.getHealthCheck();

      // Assert
      expect(result.services.database.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.services.redis.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.services.rabbitmq.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include system metrics', async () => {
      // Arrange
      mockDbQuery({ current_time: new Date().toISOString() });
      mockRedisSuccess();
      mockRabbitMQSuccess();

      // Act
      const result = await healthService.getHealthCheck();

      // Assert
      expect(result.system).toBeDefined();
      expect(result.system.platform).toBeDefined();
      expect(result.system.arch).toBeDefined();
      expect(result.system.nodeVersion).toBeDefined();
      expect(result.system.memory).toBeDefined();
      expect(result.system.memory.used).toBeGreaterThanOrEqual(0);
      expect(result.system.memory.free).toBeGreaterThanOrEqual(0);
      expect(result.system.memory.total).toBeGreaterThanOrEqual(0);
      expect(result.system.memory.usagePercentage).toBeGreaterThanOrEqual(0);
      expect(result.system.memory.usagePercentage).toBeLessThanOrEqual(100);
      expect(result.system.cpu).toBeDefined();
      expect(Array.isArray(result.system.cpu.loadAverage)).toBe(true);
    });
  });

  describe('getLivenessCheck', () => {
    it('should return alive status', async () => {
      // Act
      const result = await healthService.getLivenessCheck();

      // Assert
      expect(result.status).toBe('alive');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('getReadinessCheck', () => {
    it('should return ready when services are healthy', async () => {
      // Arrange
      mockDbQuery({ current_time: new Date().toISOString() });
      mockRedisSuccess();
      mockRabbitMQSuccess();

      // Act
      const result = await healthService.getReadinessCheck();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.ready).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it('should return not ready when services are unhealthy', async () => {
      // Arrange
      mockDbError(new Error('Database connection failed'));
      
      const mockRedis = require('@/config/redis');
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));
      
      const mockRabbitMQ = require('@/config/rabbitmq');
      mockRabbitMQ.getChannel.mockReturnValue(null);

      // Act
      const result = await healthService.getReadinessCheck();

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.ready).toBe(false);
    });
  });

  describe('metrics tracking', () => {
    it('should track message processing metrics', () => {
      // Act
      healthService.incrementMessagesProcessed();
      healthService.incrementMessagesProcessed();
      
      const metrics = healthService.getMetrics();

      // Assert
      expect(metrics.messagesProcessed).toBe(2);
      expect(metrics.lastMessageProcessedAt).toBeDefined();
    });

    it('should track request metrics', () => {
      // Act
      healthService.incrementRequests();
      healthService.updateActiveConnections(5);
      healthService.updateErrorRate(2.5);
      healthService.updateAverageResponseTime(150);
      
      const metrics = healthService.getMetrics();

      // Assert
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.activeConnections).toBe(5);
      expect(metrics.errorRate).toBe(2.5);
      expect(metrics.averageResponseTime).toBe(150);
    });
  });
});