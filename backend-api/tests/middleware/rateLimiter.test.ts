import { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from '@/middleware/rateLimiter';
import { mockUser, mockCompany, mockRedisSuccess } from '../setup';

describe('Rate Limiter Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      ip: '192.168.1.100',
      user: mockUser,
      company: mockCompany,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
    mockRedisSuccess();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000, // 1 minute
        max: 100, // 100 requests per minute
        keyGenerator: (req) => req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('5'); // Current count
      mockRedis.incr.mockResolvedValue(6);
      mockRedis.expire.mockResolvedValue(1);

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 94);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should block requests when rate limit exceeded', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 10,
        keyGenerator: (req) => req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('10'); // At limit
      mockRedis.incr.mockResolvedValue(11); // Exceeds limit

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many requests, please try again later',
        error: 'RATE_LIMIT_EXCEEDED'
      });
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });

    it('should handle first request for new key', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 50,
        keyGenerator: (req) => req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue(null); // No existing count
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 49);
      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.stringContaining(mockReq.ip!),
        60 // seconds
      );
    });
  });

  describe('Key Generation Strategies', () => {
    it('should use IP-based rate limiting', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (req) => req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('1');
      mockRedis.incr.mockResolvedValue(2);

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRedis.get).toHaveBeenCalledWith(`rate_limit:${mockReq.ip}`);
      expect(mockRedis.incr).toHaveBeenCalledWith(`rate_limit:${mockReq.ip}`);
    });

    it('should use user-based rate limiting', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 1000,
        keyGenerator: (req) => req.user?.id || req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('5');
      mockRedis.incr.mockResolvedValue(6);

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRedis.get).toHaveBeenCalledWith(`rate_limit:${mockUser.id}`);
      expect(mockRedis.incr).toHaveBeenCalledWith(`rate_limit:${mockUser.id}`);
    });

    it('should use company-based rate limiting', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 5000,
        keyGenerator: (req) => `company:${req.company?.id}` || req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('50');
      mockRedis.incr.mockResolvedValue(51);

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRedis.get).toHaveBeenCalledWith(`rate_limit:company:${mockCompany.id}`);
      expect(mockRedis.incr).toHaveBeenCalledWith(`rate_limit:company:${mockCompany.id}`);
    });

    it('should fall back to IP when user/company not available', async () => {
      // Arrange
      mockReq.user = undefined;
      mockReq.company = undefined;

      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (req) => req.user?.id || req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('1');
      mockRedis.incr.mockResolvedValue(2);

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRedis.get).toHaveBeenCalledWith(`rate_limit:${mockReq.ip}`);
    });
  });

  describe('Dynamic Rate Limits', () => {
    it('should apply higher limits for premium plans', async () => {
      // Arrange
      const premiumCompany = { ...mockCompany, plan: 'premium' };
      mockReq.company = premiumCompany;

      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: (req) => {
          const plan = req.company?.plan;
          switch (plan) {
            case 'premium': return 10000;
            case 'pro': return 5000;
            case 'basic': return 1000;
            default: return 100;
          }
        },
        keyGenerator: (req) => `company:${req.company?.id}` || req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('500');
      mockRedis.incr.mockResolvedValue(501);

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10000);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9499);
    });

    it('should apply lower limits for basic plans', async () => {
      // Arrange
      const basicCompany = { ...mockCompany, plan: 'basic' };
      mockReq.company = basicCompany;

      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: (req) => {
          const plan = req.company?.plan;
          switch (plan) {
            case 'premium': return 10000;
            case 'pro': return 5000;
            case 'basic': return 1000;
            default: return 100;
          }
        },
        keyGenerator: (req) => `company:${req.company?.id}` || req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('1000'); // At limit
      mockRedis.incr.mockResolvedValue(1001); // Exceeds limit

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 1000);
    });
  });

  describe('Skip Conditions', () => {
    it('should skip rate limiting for whitelisted IPs', async () => {
      // Arrange
      const whitelistedIP = '127.0.0.1';
      mockReq.ip = whitelistedIP;

      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 10,
        skip: (req) => {
          const whitelistedIPs = ['127.0.0.1', '::1'];
          return whitelistedIPs.includes(req.ip!);
        },
        keyGenerator: (req) => req.ip
      });

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      const mockRedis = require('@/config/redis');
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it('should skip rate limiting for admin users', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      mockReq.user = adminUser;

      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 10,
        skip: (req) => req.user?.role === 'admin',
        keyGenerator: (req) => req.user?.id || req.ip
      });

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      const mockRedis = require('@/config/redis');
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should skip rate limiting for specific routes', async () => {
      // Arrange
      mockReq.path = '/health';

      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 10,
        skip: (req) => {
          const skipPaths = ['/health', '/metrics'];
          return skipPaths.includes(req.path!);
        },
        keyGenerator: (req) => req.ip
      });

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      const mockRedis = require('@/config/redis');
      expect(mockRedis.get).not.toHaveBeenCalled();
    });
  });

  describe('Custom Message Handler', () => {
    it('should use custom message for rate limit exceeded', async () => {
      // Arrange
      const customMessage = 'API quota exceeded. Upgrade your plan for higher limits.';
      
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        keyGenerator: (req) => req.ip,
        message: customMessage
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('1');
      mockRedis.incr.mockResolvedValue(2);

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: customMessage,
        error: 'RATE_LIMIT_EXCEEDED'
      });
    });

    it('should use dynamic message based on plan', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        keyGenerator: (req) => req.ip,
        message: (req) => {
          const plan = req.company?.plan || 'free';
          return `Rate limit exceeded for ${plan} plan. Consider upgrading for higher limits.`;
        }
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('1');
      mockRedis.incr.mockResolvedValue(2);

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: `Rate limit exceeded for ${mockCompany.plan} plan. Consider upgrading for higher limits.`,
        error: 'RATE_LIMIT_EXCEEDED'
      });
    });
  });

  describe('Redis Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (req) => req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert - Should allow request when Redis is down
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle Redis increment errors', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (req) => req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('5');
      mockRedis.incr.mockRejectedValue(new Error('Redis increment failed'));

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert - Should allow request when Redis increment fails
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle Redis expire errors', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (req) => req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockRejectedValue(new Error('Redis expire failed'));

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert - Should still allow request
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Headers and Reset Time', () => {
    it('should set correct rate limit headers', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 300000, // 5 minutes
        max: 200,
        keyGenerator: (req) => req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('75');
      mockRedis.incr.mockResolvedValue(76);

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 200);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 124);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
      
      // Verify reset time is approximately 5 minutes from now
      const resetTime = (mockRes.setHeader as jest.Mock).mock.calls
        .find(call => call[0] === 'X-RateLimit-Reset')[1];
      const expectedResetTime = Math.ceil(Date.now() / 1000) + 300; // 5 minutes
      expect(resetTime).toBeCloseTo(expectedResetTime, -1); // Allow 10 second tolerance
    });

    it('should set Retry-After header when rate limited', async () => {
      // Arrange
      const rateLimiter = createRateLimiter({
        windowMs: 120000, // 2 minutes
        max: 5,
        keyGenerator: (req) => req.ip
      });

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('5');
      mockRedis.incr.mockResolvedValue(6);

      // Act
      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
      
      // Verify retry after is approximately 2 minutes
      const retryAfter = (mockRes.setHeader as jest.Mock).mock.calls
        .find(call => call[0] === 'Retry-After')[1];
      expect(retryAfter).toBeCloseTo(120, -1); // Allow 10 second tolerance
    });
  });
});