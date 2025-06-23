import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '@/middleware/auth';
import { mockUser, mockCompany } from '../setup';

// Mock the auth service
jest.mock('@/services/authService');

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: undefined,
      company: undefined
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('Valid Authentication', () => {
    it('should authenticate user with valid Bearer token', async () => {
      // Arrange
      const validToken = 'valid-jwt-token';
      mockReq.headers = {
        authorization: `Bearer ${validToken}`
      };

      const userWithCompany = {
        ...mockUser,
        company_name: mockCompany.name,
        company_plan: mockCompany.plan
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockResolvedValue(userWithCompany);

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockAuthService.getUserFromToken).toHaveBeenCalledWith(validToken);
      expect(mockReq.user).toEqual(userWithCompany);
      expect(mockReq.company).toEqual({
        id: mockUser.company_id,
        name: mockCompany.name,
        plan: mockCompany.plan
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle different authorization header formats', async () => {
      // Test with token only (no Bearer prefix)
      const token = 'jwt-token-without-bearer';
      mockReq.headers = {
        authorization: token
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuthService.getUserFromToken).toHaveBeenCalledWith(token);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Invalid Authentication', () => {
    it('should reject request with no authorization header', async () => {
      // Arrange
      mockReq.headers = {};

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with empty authorization header', async () => {
      // Arrange
      mockReq.headers = {
        authorization: ''
      };

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'InvalidFormat'
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockRejectedValue(new Error('Invalid token format'));

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid authentication token',
        error: 'INVALID_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      // Arrange
      const expiredToken = 'expired-jwt-token';
      mockReq.headers = {
        authorization: `Bearer ${expiredToken}`
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockRejectedValue(new Error('Token expired'));

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired',
        error: 'TOKEN_EXPIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject blacklisted token', async () => {
      // Arrange
      const blacklistedToken = 'blacklisted-token';
      mockReq.headers = {
        authorization: `Bearer ${blacklistedToken}`
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockRejectedValue(new Error('Token has been revoked'));

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token has been revoked',
        error: 'TOKEN_REVOKED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      // Arrange
      const validToken = 'valid-token-user-not-found';
      mockReq.headers = {
        authorization: `Bearer ${validToken}`
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockRejectedValue(new Error('User not found'));

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Service Errors', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      const validToken = 'valid-token';
      mockReq.headers = {
        authorization: `Bearer ${validToken}`
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockRejectedValue(new Error('Database connection failed'));

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication service error',
        error: 'AUTHENTICATION_SERVICE_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle Redis connection errors', async () => {
      // Arrange
      const validToken = 'valid-token';
      mockReq.headers = {
        authorization: `Bearer ${validToken}`
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockRejectedValue(new Error('Redis connection failed'));

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication service error',
        error: 'AUTHENTICATION_SERVICE_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      const validToken = 'valid-token';
      mockReq.headers = {
        authorization: `Bearer ${validToken}`
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockRejectedValue(new Error('Unexpected error'));

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication service error',
        error: 'AUTHENTICATION_SERVICE_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Token Extraction', () => {
    it('should extract token from Bearer authorization header', async () => {
      // Arrange
      const token = 'jwt-token-123';
      mockReq.headers = {
        authorization: `Bearer ${token}`
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockAuthService.getUserFromToken).toHaveBeenCalledWith(token);
    });

    it('should extract token from authorization header without Bearer prefix', async () => {
      // Arrange
      const token = 'jwt-token-456';
      mockReq.headers = {
        authorization: token
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockAuthService.getUserFromToken).toHaveBeenCalledWith(token);
    });

    it('should handle authorization header with extra spaces', async () => {
      // Arrange
      const token = 'jwt-token-789';
      mockReq.headers = {
        authorization: `  Bearer   ${token}  `
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockAuthService.getUserFromToken).toHaveBeenCalledWith(token);
    });
  });

  describe('User and Company Data Population', () => {
    it('should populate user and company data correctly', async () => {
      // Arrange
      const token = 'valid-token';
      mockReq.headers = {
        authorization: `Bearer ${token}`
      };

      const userWithCompanyData = {
        ...mockUser,
        company_name: 'Test Company Name',
        company_plan: 'premium',
        company_email: 'company@test.com'
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockResolvedValue(userWithCompanyData);

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.user).toEqual(userWithCompanyData);
      expect(mockReq.company).toEqual({
        id: mockUser.company_id,
        name: 'Test Company Name',
        plan: 'premium',
        email: 'company@test.com'
      });
    });

    it('should handle user without company data', async () => {
      // Arrange
      const token = 'valid-token';
      mockReq.headers = {
        authorization: `Bearer ${token}`
      };

      const userWithoutCompany = {
        ...mockUser,
        company_name: null,
        company_plan: null
      };

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockResolvedValue(userWithoutCompany);

      // Act
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.user).toEqual(userWithoutCompany);
      expect(mockReq.company).toEqual({
        id: mockUser.company_id,
        name: null,
        plan: null
      });
    });
  });

  describe('Case Sensitivity', () => {
    it('should handle Bearer with different cases', async () => {
      // Arrange
      const token = 'case-sensitive-token';
      
      const testCases = [
        `bearer ${token}`,
        `BEARER ${token}`,
        `Bearer ${token}`,
        `BeArEr ${token}`
      ];

      const mockAuthService = require('@/services/authService');
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      for (const authHeader of testCases) {
        mockReq.headers = { authorization: authHeader };
        jest.clearAllMocks();

        // Act
        await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        // Assert
        expect(mockAuthService.getUserFromToken).toHaveBeenCalledWith(token);
        expect(mockNext).toHaveBeenCalled();
      }
    });
  });
});