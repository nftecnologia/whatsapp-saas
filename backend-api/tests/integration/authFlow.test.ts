import request from 'supertest';
import express from 'express';
import authRoutes from '@/routes/auth';
import userRoutes from '@/routes/users';
import companyRoutes from '@/routes/companies';
import { mockUser, mockCompany, mockDbQuery, mockDbError, mockRedisSuccess } from '../setup';

const app = express();
app.use(express.json());

// Setup routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/companies', companyRoutes);

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisSuccess();
  });

  describe('Complete User Registration and Login Flow', () => {
    it('should complete full user registration and authentication flow', async () => {
      // Step 1: Mock Stack Auth user registration
      const newStackUser = {
        id: 'new-stack-user-id',
        primaryEmail: 'newuser@company.com',
        displayName: 'New User',
        clientMetadata: {
          company_id: mockCompany.id,
          role: 'user'
        }
      };

      const newUser = {
        id: 'new-user-id',
        email: 'newuser@company.com',
        name: 'New User',
        company_id: mockCompany.id,
        role: 'user',
        stack_auth_id: 'new-stack-user-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const userWithCompany = {
        ...newUser,
        company_name: mockCompany.name,
        company_plan: mockCompany.plan
      };

      // Mock Stack Auth and database responses
      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.getUser.mockResolvedValue(newStackUser);

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // User doesn't exist yet
        .mockResolvedValueOnce({ rows: [mockCompany] }) // Company exists
        .mockResolvedValueOnce({ rows: [newUser] }) // User created
        .mockResolvedValueOnce({ rows: [userWithCompany] }); // User with company details

      // Step 2: Login (which creates the user)
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          stack_auth_token: 'valid-new-user-token'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.user.email).toBe('newuser@company.com');
      expect(loginResponse.body.data.user.name).toBe('New User');
      expect(loginResponse.body.data.token).toBeDefined();
      expect(loginResponse.body.data.company).toBeDefined();

      // Step 3: Use the token to access protected resources
      const token = loginResponse.body.data.token;

      // Mock middleware to validate token
      app.use((req, res, next) => {
        if (req.headers.authorization === `Bearer ${token}`) {
          req.user = newUser;
          req.company = mockCompany;
        }
        next();
      });

      // Mock user profile fetch
      mockPool.query.mockResolvedValueOnce({ rows: [userWithCompany] });

      const profileResponse = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.email).toBe('newuser@company.com');
      expect(profileResponse.body.data.company_name).toBe(mockCompany.name);

      // Step 4: Update user profile
      const updateData = {
        name: 'Updated User Name'
      };

      const updatedUser = { ...newUser, name: 'Updated User Name' };
      mockPool.query.mockResolvedValueOnce({ rows: [updatedUser] });

      const updateResponse = await request(app)
        .put(`/users/${newUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.name).toBe('Updated User Name');

      // Step 5: Logout
      const logoutResponse = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ token })
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);
      expect(logoutResponse.body.message).toContain('Logged out successfully');
    });

    it('should handle existing user login flow', async () => {
      // Existing user login
      const existingStackUser = {
        id: mockUser.stack_auth_id || 'existing-stack-id',
        primaryEmail: mockUser.email,
        displayName: mockUser.name,
        clientMetadata: {
          company_id: mockCompany.id,
          role: mockUser.role
        }
      };

      const userWithCompany = {
        ...mockUser,
        company_name: mockCompany.name,
        company_plan: mockCompany.plan
      };

      // Mock Stack Auth and database responses
      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.getUser.mockResolvedValue(existingStackUser);

      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [userWithCompany] }); // User exists

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          stack_auth_token: 'valid-existing-user-token'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.user.id).toBe(mockUser.id);
      expect(loginResponse.body.data.user.email).toBe(mockUser.email);
      expect(loginResponse.body.data.token).toBeDefined();
    });
  });

  describe('Token Refresh Flow', () => {
    it('should refresh expired access token using refresh token', async () => {
      // Step 1: Initial login
      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.getUser.mockResolvedValue({
        id: mockUser.stack_auth_id,
        primaryEmail: mockUser.email,
        displayName: mockUser.name,
        clientMetadata: {
          company_id: mockCompany.id,
          role: mockUser.role
        }
      });

      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          stack_auth_token: 'valid-token'
        })
        .expect(200);

      const { refresh_token } = loginResponse.body.data;

      // Step 2: Mock auth service for token refresh
      const mockAuthService = require('@/services/authService');
      mockAuthService.validateRefreshToken = jest.fn().mockResolvedValue({
        user_id: mockUser.id,
        company_id: mockCompany.id,
        role: mockUser.role
      });
      mockAuthService.generateTokens = jest.fn().mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      });

      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] }); // User lookup for refresh

      // Step 3: Refresh the token
      const refreshResponse = await request(app)
        .post('/auth/refresh')
        .send({
          refresh_token
        })
        .expect(200);

      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.access_token).toBe('new-access-token');
      expect(refreshResponse.body.data.refresh_token).toBe('new-refresh-token');
      expect(refreshResponse.body.data.expires_in).toBe(3600);
    });

    it('should reject invalid refresh token', async () => {
      const mockAuthService = require('@/services/authService');
      mockAuthService.validateRefreshToken = jest.fn().mockRejectedValue(new Error('Invalid refresh token'));

      const refreshResponse = await request(app)
        .post('/auth/refresh')
        .send({
          refresh_token: 'invalid-refresh-token'
        })
        .expect(401);

      expect(refreshResponse.body.success).toBe(false);
      expect(refreshResponse.body.message).toContain('Invalid refresh token');
    });
  });

  describe('Password Management Flow', () => {
    it('should complete password change flow', async () => {
      // Mock authenticated user
      app.use((req, res, next) => {
        if (req.headers.authorization) {
          req.user = mockUser;
          req.company = mockCompany;
        }
        next();
      });

      // Mock password validation and update
      const bcrypt = require('bcryptjs');
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      bcrypt.hash = jest.fn().mockResolvedValue('new-hashed-password');

      const userWithPassword = { ...mockUser, password: 'current-hashed-password' };
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [userWithPassword] }) // Get user with password
        .mockResolvedValueOnce({ rows: [{ ...mockUser, password: undefined }] }); // Update password

      const changePasswordResponse = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          current_password: 'CurrentPassword123!',
          new_password: 'NewPassword123!'
        })
        .expect(200);

      expect(changePasswordResponse.body.success).toBe(true);
      expect(changePasswordResponse.body.message).toContain('Password updated successfully');
      expect(bcrypt.compare).toHaveBeenCalledWith('CurrentPassword123!', 'current-hashed-password');
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
    });

    it('should complete forgot password flow', async () => {
      // Step 1: Initiate password reset
      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.sendPasswordResetEmail = jest.fn().mockResolvedValue({
        success: true,
        reset_token: 'reset-token-123'
      });

      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] }); // User exists

      const forgotPasswordResponse = await request(app)
        .post('/auth/forgot-password')
        .send({
          email: mockUser.email
        })
        .expect(200);

      expect(forgotPasswordResponse.body.success).toBe(true);
      expect(forgotPasswordResponse.body.message).toContain('Password reset email sent');
      expect(mockStackAuth.stackAuth.sendPasswordResetEmail).toHaveBeenCalledWith(mockUser.email);

      // Step 2: Reset password with token
      mockStackAuth.stackAuth.validatePasswordResetToken = jest.fn().mockResolvedValue({
        valid: true,
        user_id: 'stack-user-id',
        email: mockUser.email
      });
      mockStackAuth.stackAuth.resetPassword = jest.fn().mockResolvedValue({
        success: true
      });

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // Find user by Stack Auth ID
        .mockResolvedValueOnce({ rows: [mockUser] }); // Update user

      const resetPasswordResponse = await request(app)
        .post('/auth/reset-password')
        .send({
          reset_token: 'reset-token-123',
          new_password: 'NewSecurePassword123!'
        })
        .expect(200);

      expect(resetPasswordResponse.body.success).toBe(true);
      expect(resetPasswordResponse.body.message).toContain('Password reset successfully');
      expect(mockStackAuth.stackAuth.validatePasswordResetToken).toHaveBeenCalledWith('reset-token-123');
      expect(mockStackAuth.stackAuth.resetPassword).toHaveBeenCalledWith('reset-token-123', 'NewSecurePassword123!');
    });
  });

  describe('Session Management Flow', () => {
    it('should manage user sessions across multiple devices', async () => {
      // Mock authenticated user
      app.use((req, res, next) => {
        if (req.headers.authorization) {
          req.user = mockUser;
          req.company = mockCompany;
        }
        next();
      });

      // Mock multiple active sessions
      const mockSessions = [
        {
          id: 'session1',
          user_id: mockUser.id,
          device: 'Chrome on Windows',
          ip_address: '192.168.1.100',
          location: 'São Paulo, Brazil',
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          current: true
        },
        {
          id: 'session2',
          user_id: mockUser.id,
          device: 'Safari on iPhone',
          ip_address: '192.168.1.101',
          location: 'São Paulo, Brazil',
          created_at: new Date().toISOString(),
          last_activity: new Date(Date.now() - 3600000).toISOString(),
          current: false
        }
      ];

      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: mockSessions });

      // Get all sessions
      const sessionsResponse = await request(app)
        .get('/auth/sessions')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(sessionsResponse.body.success).toBe(true);
      expect(sessionsResponse.body.data).toHaveLength(2);
      expect(sessionsResponse.body.data[0].current).toBe(true);
      expect(sessionsResponse.body.data[1].current).toBe(false);

      // Revoke a specific session
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'session2' }] });

      const revokeResponse = await request(app)
        .delete('/auth/sessions/session2')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(revokeResponse.body.success).toBe(true);
      expect(revokeResponse.body.message).toContain('Session revoked successfully');
    });
  });

  describe('Role-Based Access Control Flow', () => {
    it('should enforce proper access control based on user roles', async () => {
      // Test admin access
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        if (req.headers.authorization === 'Bearer admin-token') {
          req.user = adminUser;
          req.company = mockCompany;
        } else if (req.headers.authorization === 'Bearer user-token') {
          req.user = mockUser; // Regular user
          req.company = mockCompany;
        }
        next();
      });

      // Admin should access user management
      const mockUsers = [mockUser, { ...mockUser, id: 'user2', email: 'user2@example.com' }];
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: mockUsers });

      const adminAccessResponse = await request(app)
        .get('/users')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(adminAccessResponse.body.success).toBe(true);
      expect(adminAccessResponse.body.data).toHaveLength(2);

      // Regular user should be denied access to user management
      const userAccessResponse = await request(app)
        .get('/users')
        .set('Authorization', 'Bearer user-token')
        .expect(403);

      expect(userAccessResponse.body.success).toBe(false);
      expect(userAccessResponse.body.message).toContain('Admin access required');

      // Regular user should access their own profile
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const profileAccessResponse = await request(app)
        .get(`/users/${mockUser.id}`)
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(profileAccessResponse.body.success).toBe(true);
      expect(profileAccessResponse.body.data.id).toBe(mockUser.id);

      // Regular user should be denied access to other user profiles
      const otherProfileResponse = await request(app)
        .get('/users/other-user-id')
        .set('Authorization', 'Bearer user-token')
        .expect(403);

      expect(otherProfileResponse.body.success).toBe(false);
      expect(otherProfileResponse.body.message).toContain('Access denied');
    });
  });

  describe('Authentication Error Handling Flow', () => {
    it('should handle various authentication errors gracefully', async () => {
      // Invalid Stack Auth token
      const mockStackAuth = require('@stack-auth/node');
      mockStackAuth.stackAuth.getUser.mockRejectedValue(new Error('Invalid token'));

      const invalidTokenResponse = await request(app)
        .post('/auth/login')
        .send({
          stack_auth_token: 'invalid-token'
        })
        .expect(401);

      expect(invalidTokenResponse.body.success).toBe(false);
      expect(invalidTokenResponse.body.message).toContain('Invalid authentication token');

      // Database error during user creation
      mockStackAuth.stackAuth.getUser.mockResolvedValue({
        id: 'new-user-id',
        primaryEmail: 'newuser@example.com',
        displayName: 'New User',
        clientMetadata: {
          company_id: mockCompany.id,
          role: 'user'
        }
      });

      const mockPool = require('@/config/database');
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const dbErrorResponse = await request(app)
        .post('/auth/login')
        .send({
          stack_auth_token: 'valid-token'
        })
        .expect(500);

      expect(dbErrorResponse.body.success).toBe(false);
      expect(dbErrorResponse.body.message).toContain('Database connection failed');

      // Missing authentication
      const noAuthResponse = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(noAuthResponse.body.success).toBe(false);
      expect(noAuthResponse.body.message).toContain('Authentication required');
    });
  });
});