import rateLimit from 'express-rate-limit';
import redis from '@/config/redis';

const createRateLimiter = (windowMs: number, max: number, keyGenerator?: (req: any) => string) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: keyGenerator || ((req) => req.ip),
    standardHeaders: true,
    legacyHeaders: false,
    store: {
      async increment(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
        const multi = redis.multi();
        const resetTime = new Date(Date.now() + windowMs);
        
        multi.incr(key);
        multi.expire(key, Math.ceil(windowMs / 1000));
        
        const results = await multi.exec();
        const totalHits = results?.[0]?.[1] as number || 0;
        
        return { totalHits, resetTime };
      },
      
      async decrement(key: string): Promise<void> {
        await redis.decr(key);
      },
      
      async resetKey(key: string): Promise<void> {
        await redis.del(key);
      },
    },
    message: {
      success: false,
      message: 'Too many requests, please try again later.',
    },
  });
};

export const globalRateLimit = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
);

export const authRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  (req) => `auth:${req.ip}`
);

export const campaignSendRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  5, // 5 campaign sends per minute
  (req) => `campaign:${req.user?.company_id || req.ip}`
);

export const apiRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  30, // 30 requests per minute per user
  (req) => `api:${req.user?.id || req.ip}`
);