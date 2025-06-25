import redis from '@/config/redis';
import logger from '@/utils/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
  compress?: boolean;
  tags?: string[];
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

class CacheService {
  private static instance: CacheService;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  private defaultTTL = 3600; // 1 hour
  private maxKeyLength = 250;
  private defaultNamespace = 'whatsapp_saas';

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private buildKey(key: string, namespace?: string): string {
    const ns = namespace || this.defaultNamespace;
    const fullKey = `${ns}:${key}`;
    
    if (fullKey.length > this.maxKeyLength) {
      // Use hash for very long keys
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(fullKey).digest('hex');
      return `${ns}:hash:${hash}`;
    }
    
    return fullKey;
  }

  private async executeWithLogging<T>(
    operation: string,
    key: string,
    execution: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await execution();
      const duration = Date.now() - startTime;
      
      logger.logRedisOperation(operation, key, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.stats.errors++;
      logger.logRedisOperation(operation, key, duration, error as Error);
      throw error;
    }
  }

  // Basic cache operations
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.namespace);
    
    return this.executeWithLogging('GET', fullKey, async () => {
      const value = await redis.get(fullKey);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      
      try {
        return JSON.parse(value);
      } catch (error) {
        logger.error('Cache deserialization error', { key: fullKey, error });
        await this.delete(key, options); // Remove corrupted data
        return null;
      }
    });
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.namespace);
    const ttl = options.ttl || this.defaultTTL;
    
    return this.executeWithLogging('SET', fullKey, async () => {
      const serialized = JSON.stringify(value);
      
      if (ttl > 0) {
        await redis.setEx(fullKey, ttl, serialized);
      } else {
        await redis.set(fullKey, serialized);
      }
      
      // Handle tags for cache invalidation
      if (options.tags && options.tags.length > 0) {
        await this.addToTags(fullKey, options.tags, options.namespace);
      }
      
      this.stats.sets++;
    });
  }

  async delete(key: string, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.namespace);
    
    return this.executeWithLogging('DEL', fullKey, async () => {
      await redis.del(fullKey);
      this.stats.deletes++;
    });
  }

  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key, options.namespace);
    
    return this.executeWithLogging('EXISTS', fullKey, async () => {
      const result = await redis.exists(fullKey);
      return result === 1;
    });
  }

  // Advanced cache operations
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    
    if (cached !== null) {
      return cached;
    }
    
    const value = await factory();
    await this.set(key, value, options);
    
    return value;
  }

  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    const fullKeys = keys.map(key => this.buildKey(key, options.namespace));
    
    return this.executeWithLogging('MGET', fullKeys.join(','), async () => {
      const values = await redis.mGet(fullKeys);
      
      return values.map((value: string | null, index: number) => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        
        this.stats.hits++;
        
        try {
          return JSON.parse(value);
        } catch (error) {
          logger.error('Cache deserialization error', { key: fullKeys[index], error });
          return null;
        }
      });
    });
  }

  async mset(data: Record<string, any>, options: CacheOptions = {}): Promise<void> {
    const pipeline = redis.multi();
    const ttl = options.ttl || this.defaultTTL;
    
    for (const [key, value] of Object.entries(data)) {
      const fullKey = this.buildKey(key, options.namespace);
      const serialized = JSON.stringify(value);
      
      if (ttl > 0) {
        pipeline.setEx(fullKey, ttl, serialized);
      } else {
        pipeline.set(fullKey, serialized);
      }
    }
    
    await pipeline.exec();
    this.stats.sets += Object.keys(data).length;
  }

  // Tag-based cache invalidation
  private async addToTags(key: string, tags: string[], namespace?: string): Promise<void> {
    const pipeline = redis.multi();
    
    for (const tag of tags) {
      const tagKey = this.buildKey(`tag:${tag}`, namespace);
      pipeline.sAdd(tagKey, key);
      pipeline.expire(tagKey, this.defaultTTL * 2); // Tags live longer than data
    }
    
    await pipeline.exec();
  }

  async invalidateByTag(tag: string, options: CacheOptions = {}): Promise<number> {
    const tagKey = this.buildKey(`tag:${tag}`, options.namespace);
    
    return this.executeWithLogging('INVALIDATE_TAG', tagKey, async () => {
      const keys = await redis.sMembers(tagKey);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const pipeline = redis.multi();
      
      // Delete all keys associated with the tag
      for (const key of keys) {
        pipeline.del(key);
      }
      
      // Delete the tag itself
      pipeline.del(tagKey);
      
      await pipeline.exec();
      
      this.stats.deletes += keys.length;
      return keys.length;
    });
  }

  // Pattern-based operations
  async deletePattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    const fullPattern = this.buildKey(pattern, options.namespace);
    
    return this.executeWithLogging('DELETE_PATTERN', fullPattern, async () => {
      const keys = await redis.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      await redis.del(keys);
      this.stats.deletes += keys.length;
      
      return keys.length;
    });
  }

  // TTL management
  async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    const fullKey = this.buildKey(key, options.namespace);
    return redis.ttl(fullKey);
  }

  async expire(key: string, seconds: number, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.namespace);
    await redis.expire(fullKey, seconds);
  }

  // Cache warming
  async warm<T>(
    keys: string[],
    factory: (key: string) => Promise<T>,
    options: CacheOptions = {}
  ): Promise<void> {
    const promises = keys.map(async (key) => {
      const exists = await this.exists(key, options);
      if (!exists) {
        try {
          const value = await factory(key);
          await this.set(key, value, options);
        } catch (error) {
          logger.error('Cache warming failed', { key, error });
        }
      }
    });
    
    await Promise.all(promises);
  }

  // Statistics and monitoring
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: parseFloat(hitRate.toFixed(2)),
    };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  // Health check
  async healthCheck(): Promise<{ status: string; latency: number }> {
    const startTime = Date.now();
    
    try {
      await redis.ping();
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
      };
    }
  }

  // Cleanup operations
  async cleanup(): Promise<{ deletedKeys: number }> {
    logger.info('Starting cache cleanup');
    
    const deletedKeys = await this.deletePattern('*:expired:*');
    
    logger.info('Cache cleanup completed', { deletedKeys });
    
    return { deletedKeys };
  }

  // Domain-specific cache methods
  async getUserCache(userId: string): Promise<any> {
    return this.get(`user:${userId}`, { ttl: 1800, tags: ['users'] });
  }

  async setUserCache(userId: string, data: any): Promise<void> {
    return this.set(`user:${userId}`, data, { ttl: 1800, tags: ['users'] });
  }

  async getCompanyCache(companyId: string): Promise<any> {
    return this.get(`company:${companyId}`, { ttl: 3600, tags: ['companies'] });
  }

  async setCompanyCache(companyId: string, data: any): Promise<void> {
    return this.set(`company:${companyId}`, data, { ttl: 3600, tags: ['companies'] });
  }

  async getContactsCache(companyId: string, params: string): Promise<any> {
    const key = `contacts:${companyId}:${params}`;
    return this.get(key, { ttl: 600, tags: ['contacts', `company:${companyId}`] });
  }

  async setContactsCache(companyId: string, params: string, data: any): Promise<void> {
    const key = `contacts:${companyId}:${params}`;
    return this.set(key, data, { ttl: 600, tags: ['contacts', `company:${companyId}`] });
  }

  async getTemplatesCache(companyId: string, params: string): Promise<any> {
    const key = `templates:${companyId}:${params}`;
    return this.get(key, { ttl: 1800, tags: ['templates', `company:${companyId}`] });
  }

  async setTemplatesCache(companyId: string, params: string, data: any): Promise<void> {
    const key = `templates:${companyId}:${params}`;
    return this.set(key, data, { ttl: 1800, tags: ['templates', `company:${companyId}`] });
  }

  async getCampaignsCache(companyId: string, params: string): Promise<any> {
    const key = `campaigns:${companyId}:${params}`;
    return this.get(key, { ttl: 300, tags: ['campaigns', `company:${companyId}`] });
  }

  async setCampaignsCache(companyId: string, params: string, data: any): Promise<void> {
    const key = `campaigns:${companyId}:${params}`;
    return this.set(key, data, { ttl: 300, tags: ['campaigns', `company:${companyId}`] });
  }

  async getStatsCache(type: string, companyId: string): Promise<any> {
    const key = `stats:${type}:${companyId}`;
    return this.get(key, { ttl: 600, tags: ['stats', `company:${companyId}`] });
  }

  async setStatsCache(type: string, companyId: string, data: any): Promise<void> {
    const key = `stats:${type}:${companyId}`;
    return this.set(key, data, { ttl: 600, tags: ['stats', `company:${companyId}`] });
  }

  // Cache invalidation helpers
  async invalidateUserCache(userId: string): Promise<void> {
    await this.delete(`user:${userId}`);
  }

  async invalidateCompanyCache(companyId: string): Promise<void> {
    await this.invalidateByTag(`company:${companyId}`);
  }

  async invalidateContactsCache(companyId: string): Promise<void> {
    await this.invalidateByTag('contacts');
    await this.invalidateByTag(`company:${companyId}`);
  }

  async invalidateTemplatesCache(companyId: string): Promise<void> {
    await this.invalidateByTag('templates');
    await this.invalidateByTag(`company:${companyId}`);
  }

  async invalidateCampaignsCache(companyId: string): Promise<void> {
    await this.invalidateByTag('campaigns');
    await this.invalidateByTag(`company:${companyId}`);
  }

  async invalidateStatsCache(companyId: string): Promise<void> {
    await this.invalidateByTag('stats');
    await this.invalidateByTag(`company:${companyId}`);
  }
}

export default CacheService.getInstance();