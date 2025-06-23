import authService from '@/services/authService';
import { mockUser, mockCompany, mockDbQuery, mockDbError, mockRedisSuccess } from '../setup';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      // Arrange
      const payload = {
        user_id: mockUser.id,
        company_id: mockCompany.id,
        role: mockUser.role
      };

      // Mock Redis for storing refresh token
      mockRedisSuccess();

      // Act
      const result = await authService.generateTokens(payload);

      // Assert
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.expires_in).toBe(3600); // 1 hour
      expect(result.token_type).toBe('Bearer');

      // Verify refresh token stored in Redis
      const mockRedis = require('@/config/redis');
      expect(mockRedis.set).toHaveBeenCalledWith(
        `refresh_token:${result.refresh_token}`,
        JSON.stringify(payload),
        'EX',
        expect.any(Number) // TTL
      );
    });

    it('should set correct expiration for tokens', async () => {
      // Arrange
      const payload = {
        user_id: mockUser.id,
        company_id: mockCompany.id,
        role: mockUser.role
      };

      mockRedisSuccess();

      // Act
      const result = await authService.generateTokens(payload);

      // Assert
      expect(result.expires_in).toBe(3600); // 1 hour for access token
      
      // Verify refresh token has longer TTL (7 days)
      const mockRedis = require('@/config/redis');
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        604800 // 7 days in seconds
      );
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const payload = {
        user_id: mockUser.id,
        company_id: mockCompany.id,
        role: mockUser.role
      };

      const mockRedis = require('@/config/redis');
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert
      await expect(authService.generateTokens(payload)).rejects.toThrow('Redis connection failed');
    });
  });

  describe('validateAccessToken', () => {
    it('should validate valid access token', async () => {
      // Arrange
      const payload = {
        user_id: mockUser.id,
        company_id: mockCompany.id,
        role: mockUser.role
      };

      mockRedisSuccess();
      const { access_token } = await authService.generateTokens(payload);

      // Mock user lookup
      mockDbQuery(mockUser);

      // Act
      const result = await authService.validateAccessToken(access_token);

      // Assert
      expect(result.user_id).toBe(mockUser.id);
      expect(result.company_id).toBe(mockCompany.id);
      expect(result.role).toBe(mockUser.role);
      expect(result.iat).toBeDefined();
      expect(result.exp).toBeDefined();
    });

    it('should reject expired access token', async () => {
      // Arrange
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        {
          user_id: mockUser.id,
          company_id: mockCompany.id,
          role: mockUser.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      // Act & Assert
      await expect(authService.validateAccessToken(expiredToken)).rejects.toThrow('Token expired');
    });

    it('should reject malformed token', async () => {
      // Arrange
      const malformedToken = 'invalid.token.format';

      // Act & Assert
      await expect(authService.validateAccessToken(malformedToken)).rejects.toThrow('Invalid token');
    });

    it('should reject token with invalid signature', async () => {
      // Arrange
      const jwt = require('jsonwebtoken');
      const invalidToken = jwt.sign(
        {
          user_id: mockUser.id,
          company_id: mockCompany.id,
          role: mockUser.role
        },
        'wrong-secret'
      );

      // Act & Assert
      await expect(authService.validateAccessToken(invalidToken)).rejects.toThrow('Invalid token');
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate valid refresh token', async () => {
      // Arrange
      const payload = {
        user_id: mockUser.id,
        company_id: mockCompany.id,
        role: mockUser.role
      };

      mockRedisSuccess();
      const { refresh_token } = await authService.generateTokens(payload);

      // Mock Redis lookup
      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue(JSON.stringify(payload));

      // Act
      const result = await authService.validateRefreshToken(refresh_token);

      // Assert
      expect(result.user_id).toBe(mockUser.id);
      expect(result.company_id).toBe(mockCompany.id);
      expect(result.role).toBe(mockUser.role);
    });

    it('should reject non-existent refresh token', async () => {
      // Arrange
      const nonExistentToken = 'non-existent-refresh-token';
      
      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.validateRefreshToken(nonExistentToken)).rejects.toThrow('Invalid refresh token');
    });

    it('should handle Redis errors during validation', async () => {
      // Arrange
      const refreshToken = 'some-refresh-token';
      
      const mockRedis = require('@/config/redis');
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert
      await expect(authService.validateRefreshToken(refreshToken)).rejects.toThrow('Redis connection failed');
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke refresh token successfully', async () => {
      // Arrange
      const payload = {
        user_id: mockUser.id,
        company_id: mockCompany.id,
        role: mockUser.role
      };

      mockRedisSuccess();
      const { refresh_token } = await authService.generateTokens(payload);

      // Act
      const result = await authService.revokeRefreshToken(refresh_token);

      // Assert
      expect(result).toBe(true);
      
      const mockRedis = require('@/config/redis');
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh_token:${refresh_token}`);
    });

    it('should handle non-existent token gracefully', async () => {
      // Arrange
      const nonExistentToken = 'non-existent-token';
      
      const mockRedis = require('@/config/redis');
      mockRedis.del.mockResolvedValue(0); // No keys deleted

      // Act
      const result = await authService.revokeRefreshToken(nonExistentToken);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      // Arrange
      const userId = mockUser.id;
      const mockTokenKeys = [
        `refresh_token:token1_${userId}`,
        `refresh_token:token2_${userId}`,
        `refresh_token:token3_${userId}`
      ];

      const mockRedis = require('@/config/redis');
      mockRedis.keys = jest.fn().mockResolvedValue(mockTokenKeys);
      mockRedis.del.mockResolvedValue(mockTokenKeys.length);

      // Act
      const result = await authService.revokeAllUserTokens(userId);

      // Assert
      expect(result).toBe(3);
      expect(mockRedis.keys).toHaveBeenCalledWith(`refresh_token:*${userId}*`);
      expect(mockRedis.del).toHaveBeenCalledWith(mockTokenKeys);
    });

    it('should handle case when user has no tokens', async () => {
      // Arrange
      const userId = mockUser.id;

      const mockRedis = require('@/config/redis');
      mockRedis.keys = jest.fn().mockResolvedValue([]);

      // Act
      const result = await authService.revokeAllUserTokens(userId);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('blacklistToken', () => {
    it('should add token to blacklist', async () => {
      // Arrange
      const token = 'token-to-blacklist';
      const expiresIn = 3600; // 1 hour

      const mockRedis = require('@/config/redis');
      mockRedis.set.mockResolvedValue('OK');

      // Act
      const result = await authService.blacklistToken(token, expiresIn);

      // Assert
      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `blacklist:${token}`,
        'true',
        'EX',
        expiresIn
      );
    });

    it('should handle Redis errors during blacklisting', async () => {
      // Arrange
      const token = 'token-to-blacklist';
      const expiresIn = 3600;

      const mockRedis = require('@/config/redis');
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert
      await expect(authService.blacklistToken(token, expiresIn)).rejects.toThrow('Redis connection failed');
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      // Arrange
      const blacklistedToken = 'blacklisted-token';

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('true');

      // Act
      const result = await authService.isTokenBlacklisted(blacklistedToken);

      // Assert
      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith(`blacklist:${blacklistedToken}`);
    });

    it('should return false for non-blacklisted token', async () => {
      // Arrange
      const validToken = 'valid-token';

      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await authService.isTokenBlacklisted(validToken);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getUserFromToken', () => {
    it('should return user from valid token', async () => {
      // Arrange
      const payload = {
        user_id: mockUser.id,
        company_id: mockCompany.id,
        role: mockUser.role
      };

      mockRedisSuccess();
      const { access_token } = await authService.generateTokens(payload);

      // Mock user lookup
      const userWithCompany = {
        ...mockUser,
        company_name: mockCompany.name,
        company_plan: mockCompany.plan
      };
      mockDbQuery(userWithCompany);

      // Act
      const result = await authService.getUserFromToken(access_token);

      // Assert
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.name).toBe(mockUser.name);
      expect(result.role).toBe(mockUser.role);
      expect(result.company_name).toBe(mockCompany.name);
      expect(result.company_plan).toBe(mockCompany.plan);
    });

    it('should throw error for blacklisted token', async () => {
      // Arrange
      const payload = {
        user_id: mockUser.id,
        company_id: mockCompany.id,
        role: mockUser.role
      };

      mockRedisSuccess();
      const { access_token } = await authService.generateTokens(payload);

      // Mock blacklisted token
      const mockRedis = require('@/config/redis');
      mockRedis.get.mockResolvedValue('true'); // Token is blacklisted

      // Act & Assert
      await expect(authService.getUserFromToken(access_token)).rejects.toThrow('Token has been revoked');
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const payload = {
        user_id: 'non-existent-user',
        company_id: mockCompany.id,
        role: 'user'
      };

      mockRedisSuccess();
      const { access_token } = await authService.generateTokens(payload);

      // Mock user not found
      mockDbQuery([]);

      // Act & Assert
      await expect(authService.getUserFromToken(access_token)).rejects.toThrow('User not found');
    });
  });

  describe('createSession', () => {
    it('should create new session record', async () => {
      // Arrange
      const sessionData = {
        user_id: mockUser.id,
        token: 'session-token',
        device: 'Chrome on Windows',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      const createdSession = {
        id: 'session-123',
        ...sessionData,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      };

      mockDbQuery(createdSession);

      // Act
      const result = await authService.createSession(sessionData);

      // Assert
      expect(result.id).toBe('session-123');
      expect(result.user_id).toBe(mockUser.id);
      expect(result.device).toBe('Chrome on Windows');
      expect(result.ip_address).toBe('192.168.1.100');
      expect(result.created_at).toBeDefined();
      expect(result.last_activity).toBeDefined();
    });

    it('should handle database errors during session creation', async () => {
      // Arrange
      const sessionData = {
        user_id: mockUser.id,
        token: 'session-token',
        device: 'Chrome on Windows',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      mockDbError(new Error('Database connection failed'));

      // Act & Assert
      await expect(authService.createSession(sessionData)).rejects.toThrow('Database connection failed');
    });
  });

  describe('updateSessionActivity', () => {
    it('should update session last activity', async () => {
      // Arrange
      const sessionId = 'session-123';
      const updatedSession = {
        id: sessionId,
        user_id: mockUser.id,
        last_activity: new Date().toISOString()
      };

      mockDbQuery(updatedSession);

      // Act
      const result = await authService.updateSessionActivity(sessionId);

      // Assert
      expect(result.id).toBe(sessionId);
      expect(result.last_activity).toBeDefined();
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      // Arrange
      const sessionId = 'session-to-revoke';
      
      mockDbQuery({ id: sessionId });

      // Act
      const result = await authService.revokeSession(sessionId, mockUser.id);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      // Arrange
      const sessionId = 'non-existent-session';
      
      mockDbQuery([]);

      // Act
      const result = await authService.revokeSession(sessionId, mockUser.id);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getUserSessions', () => {
    it('should return active sessions for user', async () => {
      // Arrange
      const mockSessions = [
        {
          id: 'session1',
          user_id: mockUser.id,
          device: 'Chrome on Windows',
          ip_address: '192.168.1.100',
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString()
        },
        {
          id: 'session2',
          user_id: mockUser.id,
          device: 'Safari on iPhone',
          ip_address: '192.168.1.101',
          created_at: new Date().toISOString(),
          last_activity: new Date(Date.now() - 3600000).toISOString()
        }
      ];

      mockDbQuery(mockSessions);

      // Act
      const result = await authService.getUserSessions(mockUser.id);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('session1');
      expect(result[0].device).toBe('Chrome on Windows');
      expect(result[1].id).toBe('session2');
      expect(result[1].device).toBe('Safari on iPhone');
    });

    it('should return empty array when user has no sessions', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await authService.getUserSessions(mockUser.id);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', async () => {
      // Arrange
      const deletedCount = 5;
      mockDbQuery({ deleted_count: deletedCount });

      // Act
      const result = await authService.cleanupExpiredSessions();

      // Assert
      expect(result).toBe(deletedCount);
    });

    it('should handle case when no sessions to clean', async () => {
      // Arrange
      mockDbQuery({ deleted_count: 0 });

      // Act
      const result = await authService.cleanupExpiredSessions();

      // Assert
      expect(result).toBe(0);
    });
  });
});