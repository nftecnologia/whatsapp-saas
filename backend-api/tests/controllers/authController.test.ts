import request from 'supertest';
import express from 'express';
import authRoutes from '@/routes/auth';
import { mockUser, mockCompany, mockDbQuery, mockDbError } from '../setup';

const app = express();
app.use(express.json());

// Mock authentication middleware for protected routes
const mockAuthMiddleware = (req: any, res: any, next: any) => {
  if (req.headers.authorization) {
    req.user = mockUser;
    req.company = mockCompany;
  }
  next();
};

app.use(mockAuthMiddleware);
app.use('/auth', authRoutes);

describe('AuthController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid Stack Auth token', async () => {
      // Arrange
      const loginData = {
        stack_auth_token: 'valid-stack-auth-token'
      };

      // Mock Stack Auth validation
      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.getUser.mockResolvedValue({
        id: 'stack-user-id',
        primaryEmail: mockUser.email,
        displayName: mockUser.name,
        clientMetadata: {
          company_id: mockCompany.id,
          role: mockUser.role
        }
      });

      // Mock database user lookup
      mockDbQuery(mockUser);

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(mockUser.id);
      expect(response.body.data.user.email).toBe(mockUser.email);
      expect(response.body.data.user.name).toBe(mockUser.name);
      expect(response.body.data.user.role).toBe(mockUser.role);
      expect(response.body.data.company).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(mockStackAuth.stackAuth.getUser).toHaveBeenCalledWith('valid-stack-auth-token');
    });

    it('should create new user if not exists in database', async () => {
      // Arrange
      const loginData = {
        stack_auth_token: 'valid-stack-auth-token'
      };

      const stackUser = {
        id: 'new-stack-user-id',
        primaryEmail: 'newuser@example.com',
        displayName: 'New User',
        clientMetadata: {
          company_id: mockCompany.id,
          role: 'user'
        }
      };

      const newUser = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        company_id: mockCompany.id,
        role: 'user',
        stack_auth_id: 'new-stack-user-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Mock Stack Auth validation
      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.getUser.mockResolvedValue(stackUser);

      // Mock database responses
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // User not found
        .mockResolvedValueOnce({ rows: [mockCompany] }) // Company exists
        .mockResolvedValueOnce({ rows: [newUser] }); // User created

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('newuser@example.com');
      expect(response.body.data.user.name).toBe('New User');
      expect(response.body.data.token).toBeDefined();
    });

    it('should reject invalid Stack Auth token', async () => {
      // Arrange
      const loginData = {
        stack_auth_token: 'invalid-token'
      };

      // Mock Stack Auth rejection
      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.getUser.mockRejectedValue(new Error('Invalid token'));

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid authentication token');
    });

    it('should validate required fields', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({})
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Stack Auth token is required');
    });

    it('should handle database errors during user creation', async () => {
      // Arrange
      const loginData = {
        stack_auth_token: 'valid-stack-auth-token'
      };

      const stackUser = {
        id: 'stack-user-id',
        primaryEmail: mockUser.email,
        displayName: mockUser.name,
        clientMetadata: {
          company_id: mockCompany.id,
          role: mockUser.role
        }
      };

      // Mock Stack Auth validation
      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.getUser.mockResolvedValue(stackUser);

      // Mock database error
      mockDbError(new Error('Database connection failed'));

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(500);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Database connection failed');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      // Arrange
      const logoutData = {
        token: 'valid-jwt-token'
      };

      // Mock token invalidation in cache/database
      const mockCacheService = require('@/services/cacheService');
      mockCacheService.set = jest.fn().mockResolvedValue(true);

      // Act
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(logoutData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logged out successfully');
    });

    it('should require authentication', async () => {
      // Act
      const response = await request(app)
        .post('/auth/logout')
        .send({})
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token successfully', async () => {
      // Arrange
      const refreshData = {
        refresh_token: 'valid-refresh-token'
      };

      // Mock token validation and refresh
      const mockAuthService = require('@/services/authService');
      mockAuthService.validateRefreshToken = jest.fn().mockResolvedValue({
        user_id: mockUser.id,
        company_id: mockCompany.id
      });
      mockAuthService.generateTokens = jest.fn().mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      });

      // Mock user lookup
      mockDbQuery(mockUser);

      // Act
      const response = await request(app)
        .post('/auth/refresh')
        .send(refreshData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.access_token).toBe('new-access-token');
      expect(response.body.data.refresh_token).toBe('new-refresh-token');
      expect(response.body.data.expires_in).toBe(3600);
      expect(mockAuthService.validateRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should reject invalid refresh token', async () => {
      // Arrange
      const refreshData = {
        refresh_token: 'invalid-refresh-token'
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.validateRefreshToken = jest.fn().mockRejectedValue(new Error('Invalid refresh token'));

      // Act
      const response = await request(app)
        .post('/auth/refresh')
        .send(refreshData)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid refresh token');
    });

    it('should validate required fields', async () => {
      // Act
      const response = await request(app)
        .post('/auth/refresh')
        .send({})
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Refresh token is required');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user information', async () => {
      // Arrange
      const userWithCompany = {
        ...mockUser,
        company_name: mockCompany.name,
        company_plan: mockCompany.plan
      };
      
      mockDbQuery(userWithCompany);

      // Act
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockUser.id);
      expect(response.body.data.email).toBe(mockUser.email);
      expect(response.body.data.name).toBe(mockUser.name);
      expect(response.body.data.role).toBe(mockUser.role);
      expect(response.body.data.company_name).toBe(mockCompany.name);
      expect(response.body.data.company_plan).toBe(mockCompany.plan);
    });

    it('should require authentication', async () => {
      // Act
      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });

    it('should handle user not found', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('User not found');
    });
  });

  describe('POST /auth/change-password', () => {
    it('should change password successfully', async () => {
      // Arrange
      const passwordData = {
        current_password: 'CurrentPassword123!',
        new_password: 'NewPassword123!'
      };

      // Mock password validation
      const bcrypt = require('bcryptjs');
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      bcrypt.hash = jest.fn().mockResolvedValue('hashed-new-password');

      // Mock database update
      const userWithPassword = { ...mockUser, password: 'hashed-current-password' };
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [userWithPassword] }) // Get current user with password
        .mockResolvedValueOnce({ rows: [{ ...mockUser, password: undefined }] }); // Update password

      // Act
      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(passwordData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password updated successfully');
      expect(bcrypt.compare).toHaveBeenCalledWith('CurrentPassword123!', 'hashed-current-password');
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
    });

    it('should reject incorrect current password', async () => {
      // Arrange
      const passwordData = {
        current_password: 'WrongPassword',
        new_password: 'NewPassword123!'
      };

      const bcrypt = require('bcryptjs');
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      const userWithPassword = { ...mockUser, password: 'hashed-current-password' };
      mockDbQuery(userWithPassword);

      // Act
      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(passwordData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Current password is incorrect');
    });

    it('should validate password strength', async () => {
      // Arrange
      const passwordData = {
        current_password: 'CurrentPassword123!',
        new_password: 'weak'
      };

      // Act
      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(passwordData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    it('should require authentication', async () => {
      // Act
      const response = await request(app)
        .post('/auth/change-password')
        .send({
          current_password: 'CurrentPassword123!',
          new_password: 'NewPassword123!'
        })
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should initiate password reset successfully', async () => {
      // Arrange
      const resetData = {
        email: mockUser.email
      };

      // Mock user lookup
      mockDbQuery(mockUser);

      // Mock Stack Auth password reset
      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.sendPasswordResetEmail = jest.fn().mockResolvedValue({
        success: true,
        reset_token: 'reset-token-123'
      });

      // Act
      const response = await request(app)
        .post('/auth/forgot-password')
        .send(resetData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password reset email sent');
      expect(mockStackAuth.stackAuth.sendPasswordResetEmail).toHaveBeenCalledWith(mockUser.email);
    });

    it('should handle non-existent email gracefully', async () => {
      // Arrange
      const resetData = {
        email: 'nonexistent@example.com'
      };

      mockDbQuery([]);

      // Act - Should still return success for security
      const response = await request(app)
        .post('/auth/forgot-password')
        .send(resetData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password reset email sent');
    });

    it('should validate email format', async () => {
      // Arrange
      const resetData = {
        email: 'invalid-email'
      };

      // Act
      const response = await request(app)
        .post('/auth/forgot-password')
        .send(resetData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Valid email is required');
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reset password successfully with valid token', async () => {
      // Arrange
      const resetData = {
        reset_token: 'valid-reset-token',
        new_password: 'NewSecurePassword123!'
      };

      // Mock Stack Auth token validation
      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.validatePasswordResetToken = jest.fn().mockResolvedValue({
        valid: true,
        user_id: 'stack-user-id',
        email: mockUser.email
      });
      mockStackAuth.stackAuth.resetPassword = jest.fn().mockResolvedValue({
        success: true
      });

      // Mock user lookup and update
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // Find user by Stack Auth ID
        .mockResolvedValueOnce({ rows: [mockUser] }); // Update user

      // Act
      const response = await request(app)
        .post('/auth/reset-password')
        .send(resetData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password reset successfully');
      expect(mockStackAuth.stackAuth.validatePasswordResetToken).toHaveBeenCalledWith('valid-reset-token');
      expect(mockStackAuth.stackAuth.resetPassword).toHaveBeenCalledWith('valid-reset-token', 'NewSecurePassword123!');
    });

    it('should reject invalid reset token', async () => {
      // Arrange
      const resetData = {
        reset_token: 'invalid-reset-token',
        new_password: 'NewSecurePassword123!'
      };

      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.validatePasswordResetToken = jest.fn().mockResolvedValue({
        valid: false,
        error: 'Token expired'
      });

      // Act
      const response = await request(app)
        .post('/auth/reset-password')
        .send(resetData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or expired reset token');
    });

    it('should validate password strength', async () => {
      // Arrange
      const resetData = {
        reset_token: 'valid-reset-token',
        new_password: 'weak'
      };

      // Act
      const response = await request(app)
        .post('/auth/reset-password')
        .send(resetData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    it('should validate required fields', async () => {
      // Act
      const response = await request(app)
        .post('/auth/reset-password')
        .send({})
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Reset token and new password are required');
    });
  });

  describe('GET /auth/sessions', () => {
    it('should return active sessions for user', async () => {
      // Arrange
      const mockSessions = [
        {
          id: 'session1',
          device: 'Chrome on Windows',
          ip_address: '192.168.1.100',
          location: 'São Paulo, Brazil',
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          current: true
        },
        {
          id: 'session2',
          device: 'Safari on iPhone',
          ip_address: '192.168.1.101',
          location: 'São Paulo, Brazil',
          created_at: new Date().toISOString(),
          last_activity: new Date(Date.now() - 3600000).toISOString(),
          current: false
        }
      ];
      
      mockDbQuery(mockSessions);

      // Act
      const response = await request(app)
        .get('/auth/sessions')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].current).toBe(true);
      expect(response.body.data[1].current).toBe(false);
    });

    it('should require authentication', async () => {
      // Act
      const response = await request(app)
        .get('/auth/sessions')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });
  });

  describe('DELETE /auth/sessions/:sessionId', () => {
    it('should revoke specific session successfully', async () => {
      // Arrange
      const sessionId = 'session-to-revoke';
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: sessionId }] });

      // Act
      const response = await request(app)
        .delete(`/auth/sessions/${sessionId}`)
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Session revoked successfully');
    });

    it('should prevent revoking current session', async () => {
      // Arrange
      const currentSessionId = 'current-session-id';
      
      // Act
      const response = await request(app)
        .delete(`/auth/sessions/${currentSessionId}`)
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot revoke current session');
    });

    it('should return 404 for non-existent session', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Act
      const response = await request(app)
        .delete('/auth/sessions/non-existent-session')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Session not found');
    });
  });
});