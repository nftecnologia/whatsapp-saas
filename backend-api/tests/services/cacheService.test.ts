import cacheService from '@/services/cacheService';
import { mockRedisSuccess } from '../setup';

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('set', () => {
    it('should set value with default TTL', async () => {
      // Arrange
      mockRedisSuccess();
      const key = 'test-key';
      const value = { data: 'test-value' };

      // Act
      const result = await cacheService.set(key, value);

      // Assert
      expect(result).toBe(true);
      const mockRedis = require('@/config/redis');
      expect(mockRedis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(value),
        'EX',
        3600 // Default 1 hour TTL
      );
    });

    it('should set value with custom TTL', async () => {
      // Arrange
      mockRedisSuccess();
      const key = 'test-key';
      const value = { data: 'test-value' };
      const ttl = 7200; // 2 hours

      // Act
      const result = await cacheService.set(key, value, ttl);

      // Assert
      expect(result).toBe(true);
      const mockRedis = require('@/config/redis');
      expect(mockRedis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(value),
        'EX',
        ttl
      );
    });

    it('should handle primitive values', async () => {
      // Arrange
      mockRedisSuccess();
      const key = 'test-key';
      const value = 'string-value';

      // Act
      const result = await cacheService.set(key, value);

      // Assert
      expect(result).toBe(true);
      const mockRedis = require('@/config/redis');
      expect(mockRedis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(value),
        'EX',
        3600
      );
    });

    it('should handle Redis errors', async () => {
      // Arrange
      const mockRedis = require('@/config/redis');
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert
      await expect(cacheService.set('test-key', 'test-value'))
        .rejects.toThrow('Redis connection failed');
    });
  });

  describe('get', () => {
    it('should get and parse cached value', async () => {
      // Arrange
      const key = 'test-key';
      const cachedValue = { data: 'test-value', timestamp: Date.now() };
      
      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedValue));

      // Act
      const result = await cacheService.get(key);

      // Assert
      expect(result).toEqual(cachedValue);
      expect(mockRedis.get).toHaveBeenCalledWith(key);
    });

    it('should return null for non-existent key', async () => {
      // Arrange
      const key = 'non-existent-key';
      
      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await cacheService.get(key);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      // Arrange
      const key = 'test-key';
      
      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('invalid-json{');

      // Act
      const result = await cacheService.get(key);

      // Assert
      expect(result).toBe('invalid-json{'); // Return raw value if not valid JSON
    });

    it('should handle Redis errors', async () => {
      // Arrange
      const mockRedis = require('@/config/redis');
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert
      await expect(cacheService.get('test-key'))
        .rejects.toThrow('Redis connection failed');
    });
  });

  describe('del', () => {
    it('should delete single key', async () => {
      // Arrange
      const key = 'test-key';
      
      const mockRedis = require('@/config/redis');
      mockRedis.del.mockResolvedValue(1);

      // Act
      const result = await cacheService.del(key);

      // Assert
      expect(result).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith(key);
    });

    it('should delete multiple keys', async () => {
      // Arrange
      const keys = ['key1', 'key2', 'key3'];
      
      const mockRedis = require('@/config/redis');
      mockRedis.del.mockResolvedValue(3);

      // Act
      const result = await cacheService.del(...keys);

      // Assert
      expect(result).toBe(3);
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });

    it('should return 0 for non-existent keys', async () => {
      // Arrange
      const key = 'non-existent-key';
      
      const mockRedis = require('@/config/redis');
      mockRedis.del.mockResolvedValue(0);

      // Act
      const result = await cacheService.del(key);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      // Arrange
      const key = 'existing-key';
      
      const mockRedis = require('@/config/redis');
      mockRedis.exists = jest.fn().mockResolvedValue(1);

      // Act
      const result = await cacheService.exists(key);

      // Assert
      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith(key);
    });

    it('should return false for non-existent key', async () => {
      // Arrange
      const key = 'non-existent-key';
      
      const mockRedis = require('@/config/redis');
      mockRedis.exists = jest.fn().mockResolvedValue(0);

      // Act
      const result = await cacheService.exists(key);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('expire', () => {
    it('should set expiration for existing key', async () => {
      // Arrange
      const key = 'test-key';
      const ttl = 3600;
      
      const mockRedis = require('@/config/redis');
      mockRedis.expire = jest.fn().mockResolvedValue(1);

      // Act
      const result = await cacheService.expire(key, ttl);

      // Assert
      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledWith(key, ttl);
    });

    it('should return false for non-existent key', async () => {
      // Arrange
      const key = 'non-existent-key';
      const ttl = 3600;
      
      const mockRedis = require('@/config/redis');
      mockRedis.expire = jest.fn().mockResolvedValue(0);

      // Act
      const result = await cacheService.expire(key, ttl);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('ttl', () => {
    it('should return TTL for key with expiration', async () => {
      // Arrange
      const key = 'test-key';
      
      const mockRedis = require('@/config/redis');
      mockRedis.ttl = jest.fn().mockResolvedValue(1800); // 30 minutes

      // Act
      const result = await cacheService.ttl(key);

      // Assert
      expect(result).toBe(1800);
      expect(mockRedis.ttl).toHaveBeenCalledWith(key);
    });

    it('should return -1 for key without expiration', async () => {
      // Arrange
      const key = 'persistent-key';
      
      const mockRedis = require('@/config/redis');
      mockRedis.ttl = jest.fn().mockResolvedValue(-1);

      // Act
      const result = await cacheService.ttl(key);

      // Assert
      expect(result).toBe(-1);
    });

    it('should return -2 for non-existent key', async () => {
      // Arrange
      const key = 'non-existent-key';
      
      const mockRedis = require('@/config/redis');
      mockRedis.ttl = jest.fn().mockResolvedValue(-2);

      // Act
      const result = await cacheService.ttl(key);

      // Assert
      expect(result).toBe(-2);
    });
  });

  describe('keys', () => {
    it('should return matching keys', async () => {
      // Arrange
      const pattern = 'user:*';
      const matchingKeys = ['user:123', 'user:456', 'user:789'];
      
      const mockRedis = require('@/config/redis');
      mockRedis.keys = jest.fn().mockResolvedValue(matchingKeys);

      // Act
      const result = await cacheService.keys(pattern);

      // Assert
      expect(result).toEqual(matchingKeys);
      expect(mockRedis.keys).toHaveBeenCalledWith(pattern);
    });

    it('should return empty array for no matches', async () => {
      // Arrange
      const pattern = 'nonexistent:*';
      
      const mockRedis = require('@/config/redis');
      mockRedis.keys = jest.fn().mockResolvedValue([]);

      // Act
      const result = await cacheService.keys(pattern);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('flushPattern', () => {
    it('should delete all keys matching pattern', async () => {
      // Arrange
      const pattern = 'session:*';
      const matchingKeys = ['session:123', 'session:456'];
      
      const mockRedis = require('@/config/redis');
      mockRedis.keys = jest.fn().mockResolvedValue(matchingKeys);
      mockRedis.del.mockResolvedValue(matchingKeys.length);

      // Act
      const result = await cacheService.flushPattern(pattern);

      // Assert
      expect(result).toBe(2);
      expect(mockRedis.keys).toHaveBeenCalledWith(pattern);
      expect(mockRedis.del).toHaveBeenCalledWith(...matchingKeys);
    });

    it('should return 0 when no keys match pattern', async () => {
      // Arrange
      const pattern = 'nonexistent:*';
      
      const mockRedis = require('@/config/redis');
      mockRedis.keys = jest.fn().mockResolvedValue([]);

      // Act
      const result = await cacheService.flushPattern(pattern);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('increment', () => {
    it('should increment numeric value', async () => {
      // Arrange
      const key = 'counter';
      
      const mockRedis = require('@/config/redis');
      mockRedis.incr = jest.fn().mockResolvedValue(5);

      // Act
      const result = await cacheService.increment(key);

      // Assert
      expect(result).toBe(5);
      expect(mockRedis.incr).toHaveBeenCalledWith(key);
    });

    it('should increment by custom amount', async () => {
      // Arrange
      const key = 'counter';
      const amount = 10;
      
      const mockRedis = require('@/config/redis');
      mockRedis.incrby = jest.fn().mockResolvedValue(15);

      // Act
      const result = await cacheService.increment(key, amount);

      // Assert
      expect(result).toBe(15);
      expect(mockRedis.incrby).toHaveBeenCalledWith(key, amount);
    });
  });

  describe('decrement', () => {
    it('should decrement numeric value', async () => {
      // Arrange
      const key = 'counter';
      
      const mockRedis = require('@/config/redis');
      mockRedis.decr = jest.fn().mockResolvedValue(3);

      // Act
      const result = await cacheService.decrement(key);

      // Assert
      expect(result).toBe(3);
      expect(mockRedis.decr).toHaveBeenCalledWith(key);
    });

    it('should decrement by custom amount', async () => {
      // Arrange
      const key = 'counter';
      const amount = 5;
      
      const mockRedis = require('@/config/redis');
      mockRedis.decrby = jest.fn().mockResolvedValue(-2);

      // Act
      const result = await cacheService.decrement(key, amount);

      // Assert
      expect(result).toBe(-2);
      expect(mockRedis.decrby).toHaveBeenCalledWith(key, amount);
    });
  });

  describe('setAdd', () => {
    it('should add members to set', async () => {
      // Arrange
      const key = 'myset';
      const members = ['member1', 'member2', 'member3'];
      
      const mockRedis = require('@/config/redis');
      mockRedis.sadd = jest.fn().mockResolvedValue(3);

      // Act
      const result = await cacheService.setAdd(key, ...members);

      // Assert
      expect(result).toBe(3);
      expect(mockRedis.sadd).toHaveBeenCalledWith(key, ...members);
    });
  });

  describe('setMembers', () => {
    it('should return all set members', async () => {
      // Arrange
      const key = 'myset';
      const members = ['member1', 'member2', 'member3'];
      
      const mockRedis = require('@/config/redis');
      mockRedis.smembers = jest.fn().mockResolvedValue(members);

      // Act
      const result = await cacheService.setMembers(key);

      // Assert
      expect(result).toEqual(members);
      expect(mockRedis.smembers).toHaveBeenCalledWith(key);
    });
  });

  describe('setRemove', () => {
    it('should remove members from set', async () => {
      // Arrange
      const key = 'myset';
      const members = ['member1', 'member2'];
      
      const mockRedis = require('@/config/redis');
      mockRedis.srem = jest.fn().mockResolvedValue(2);

      // Act
      const result = await cacheService.setRemove(key, ...members);

      // Assert
      expect(result).toBe(2);
      expect(mockRedis.srem).toHaveBeenCalledWith(key, ...members);
    });
  });

  describe('setExists', () => {
    it('should return true if member exists in set', async () => {
      // Arrange
      const key = 'myset';
      const member = 'member1';
      
      const mockRedis = require('@/config/redis');
      mockRedis.sismember = jest.fn().mockResolvedValue(1);

      // Act
      const result = await cacheService.setExists(key, member);

      // Assert
      expect(result).toBe(true);
      expect(mockRedis.sismember).toHaveBeenCalledWith(key, member);
    });

    it('should return false if member does not exist in set', async () => {
      // Arrange
      const key = 'myset';
      const member = 'nonexistent';
      
      const mockRedis = require('@/config/redis');
      mockRedis.sismember = jest.fn().mockResolvedValue(0);

      // Act
      const result = await cacheService.setExists(key, member);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('hashSet', () => {
    it('should set hash field', async () => {
      // Arrange
      const key = 'myhash';
      const field = 'field1';
      const value = 'value1';
      
      const mockRedis = require('@/config/redis');
      mockRedis.hset = jest.fn().mockResolvedValue(1);

      // Act
      const result = await cacheService.hashSet(key, field, value);

      // Assert
      expect(result).toBe(1);
      expect(mockRedis.hset).toHaveBeenCalledWith(key, field, JSON.stringify(value));
    });
  });

  describe('hashGet', () => {
    it('should get hash field value', async () => {
      // Arrange
      const key = 'myhash';
      const field = 'field1';
      const value = { data: 'test' };
      
      const mockRedis = require('@/config/redis');
      mockRedis.hget = jest.fn().mockResolvedValue(JSON.stringify(value));

      // Act
      const result = await cacheService.hashGet(key, field);

      // Assert
      expect(result).toEqual(value);
      expect(mockRedis.hget).toHaveBeenCalledWith(key, field);
    });

    it('should return null for non-existent field', async () => {
      // Arrange
      const key = 'myhash';
      const field = 'nonexistent';
      
      const mockRedis = require('@/config/redis');
      mockRedis.hget = jest.fn().mockResolvedValue(null);

      // Act
      const result = await cacheService.hashGet(key, field);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('hashDelete', () => {
    it('should delete hash field', async () => {
      // Arrange
      const key = 'myhash';
      const field = 'field1';
      
      const mockRedis = require('@/config/redis');
      mockRedis.hdel = jest.fn().mockResolvedValue(1);

      // Act
      const result = await cacheService.hashDelete(key, field);

      // Assert
      expect(result).toBe(1);
      expect(mockRedis.hdel).toHaveBeenCalledWith(key, field);
    });
  });

  describe('hashGetAll', () => {
    it('should get all hash fields and values', async () => {
      // Arrange
      const key = 'myhash';
      const hashData = {
        field1: JSON.stringify('value1'),
        field2: JSON.stringify({ data: 'value2' })
      };
      
      const mockRedis = require('@/config/redis');
      mockRedis.hgetall = jest.fn().mockResolvedValue(hashData);

      // Act
      const result = await cacheService.hashGetAll(key);

      // Assert
      expect(result).toEqual({
        field1: 'value1',
        field2: { data: 'value2' }
      });
      expect(mockRedis.hgetall).toHaveBeenCalledWith(key);
    });

    it('should return empty object for non-existent hash', async () => {
      // Arrange
      const key = 'nonexistent-hash';
      
      const mockRedis = require('@/config/redis');
      mockRedis.hgetall = jest.fn().mockResolvedValue({});

      // Act
      const result = await cacheService.hashGetAll(key);

      // Assert
      expect(result).toEqual({});
    });
  });
});