import { UserModel } from '@/models/User';
import { mockUser, mockCompany, mockDbQuery, mockDbError } from '../setup';

describe('UserModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      // Arrange
      mockDbQuery(mockUser);

      // Act
      const result = await UserModel.findById(mockUser.id);

      // Assert
      expect(result).toEqual(mockUser);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE id = $1'),
        [mockUser.id]
      );
    });

    it('should return null for non-existent user', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await UserModel.findById('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      mockDbError(new Error('Database connection failed'));

      // Act & Assert
      await expect(UserModel.findById(mockUser.id))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      // Arrange
      mockDbQuery(mockUser);

      // Act
      const result = await UserModel.findByEmail(mockUser.email);

      // Assert
      expect(result).toEqual(mockUser);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE email = $1'),
        [mockUser.email]
      );
    });

    it('should return null for non-existent email', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await UserModel.findByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle case-insensitive email lookup', async () => {
      // Arrange
      mockDbQuery(mockUser);

      // Act
      const result = await UserModel.findByEmail(mockUser.email.toUpperCase());

      // Assert
      expect(result).toEqual(mockUser);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(email) = LOWER($1)'),
        [mockUser.email.toUpperCase()]
      );
    });
  });

  describe('findByCompanyId', () => {
    it('should find all users in a company', async () => {
      // Arrange
      const companyUsers = [
        mockUser,
        { ...mockUser, id: 'user2', email: 'user2@example.com' },
        { ...mockUser, id: 'user3', email: 'user3@example.com' }
      ];
      mockDbQuery(companyUsers);

      // Act
      const result = await UserModel.findByCompanyId(mockCompany.id);

      // Assert
      expect(result).toEqual(companyUsers);
      expect(result).toHaveLength(3);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE company_id = $1'),
        [mockCompany.id]
      );
    });

    it('should return empty array for company with no users', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await UserModel.findByCompanyId('empty-company-id');

      // Assert
      expect(result).toEqual([]);
    });

    it('should order users by created_at', async () => {
      // Arrange
      const companyUsers = [mockUser];
      mockDbQuery(companyUsers);

      // Act
      await UserModel.findByCompanyId(mockCompany.id);

      // Assert
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [mockCompany.id]
      );
    });
  });

  describe('create', () => {
    it('should create new user with valid data', async () => {
      // Arrange
      const userData = {
        email: 'newuser@example.com',
        name: 'New User',
        company_id: mockCompany.id,
        role: 'user' as const,
        stack_auth_id: 'stack-auth-123'
      };

      const createdUser = {
        id: 'new-user-id',
        ...userData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockDbQuery(createdUser);

      // Act
      const result = await UserModel.create(userData);

      // Assert
      expect(result).toEqual(createdUser);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          userData.email,
          userData.name,
          userData.company_id,
          userData.role,
          userData.stack_auth_id
        ])
      );
    });

    it('should hash password when provided', async () => {
      // Arrange
      const userData = {
        email: 'newuser@example.com',
        name: 'New User',
        company_id: mockCompany.id,
        role: 'user' as const,
        password: 'PlainTextPassword123!'
      };

      const bcrypt = require('bcryptjs');
      bcrypt.hash = jest.fn().mockResolvedValue('hashed-password');

      const createdUser = {
        id: 'new-user-id',
        ...userData,
        password: 'hashed-password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockDbQuery(createdUser);

      // Act
      const result = await UserModel.create(userData);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith('PlainTextPassword123!', 12);
      expect(result.password).toBeUndefined(); // Password should not be returned
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining(['hashed-password'])
      );
    });

    it('should handle duplicate email constraint', async () => {
      // Arrange
      const userData = {
        email: mockUser.email,
        name: 'Duplicate User',
        company_id: mockCompany.id,
        role: 'user' as const
      };

      const duplicateError = new Error('duplicate key value violates unique constraint');
      duplicateError.name = 'PostgresError';
      (duplicateError as any).code = '23505';
      
      mockDbError(duplicateError);

      // Act & Assert
      await expect(UserModel.create(userData))
        .rejects.toThrow('Email already exists');
    });

    it('should validate email format', async () => {
      // Arrange
      const userData = {
        email: 'invalid-email',
        name: 'Test User',
        company_id: mockCompany.id,
        role: 'user' as const
      };

      // Act & Assert
      await expect(UserModel.create(userData))
        .rejects.toThrow('Invalid email format');
    });

    it('should validate role enum', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        company_id: mockCompany.id,
        role: 'invalid_role' as any
      };

      // Act & Assert
      await expect(UserModel.create(userData))
        .rejects.toThrow('Invalid role');
    });
  });

  describe('update', () => {
    it('should update user with valid data', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      const updatedUser = {
        ...mockUser,
        ...updateData,
        updated_at: new Date().toISOString()
      };

      mockDbQuery(updatedUser);

      // Act
      const result = await UserModel.update(mockUser.id, updateData);

      // Assert
      expect(result).toEqual(updatedUser);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining([updateData.name, updateData.email, mockUser.id])
      );
    });

    it('should hash new password when updating', async () => {
      // Arrange
      const updateData = {
        password: 'NewPassword123!'
      };

      const bcrypt = require('bcryptjs');
      bcrypt.hash = jest.fn().mockResolvedValue('new-hashed-password');

      const updatedUser = {
        ...mockUser,
        password: undefined, // Should not return password
        updated_at: new Date().toISOString()
      };

      mockDbQuery(updatedUser);

      // Act
      const result = await UserModel.update(mockUser.id, updateData);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
      expect(result.password).toBeUndefined();
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['new-hashed-password', mockUser.id])
      );
    });

    it('should return null for non-existent user', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await UserModel.update('non-existent-id', { name: 'Test' });

      // Assert
      expect(result).toBeNull();
    });

    it('should validate email format on update', async () => {
      // Arrange
      const updateData = {
        email: 'invalid-email-format'
      };

      // Act & Assert
      await expect(UserModel.update(mockUser.id, updateData))
        .rejects.toThrow('Invalid email format');
    });

    it('should prevent updating company_id', async () => {
      // Arrange
      const updateData = {
        company_id: 'different-company-id'
      };

      // Act & Assert
      await expect(UserModel.update(mockUser.id, updateData))
        .rejects.toThrow('Company ID cannot be changed');
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      // Arrange
      mockDbQuery({ id: mockUser.id });

      // Act
      const result = await UserModel.delete(mockUser.id);

      // Assert
      expect(result).toBe(true);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users WHERE id = $1'),
        [mockUser.id]
      );
    });

    it('should return false for non-existent user', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await UserModel.delete('non-existent-id');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle foreign key constraint errors', async () => {
      // Arrange
      const constraintError = new Error('Cannot delete user with active campaigns');
      constraintError.name = 'PostgresError';
      (constraintError as any).code = '23503';
      
      mockDbError(constraintError);

      // Act & Assert
      await expect(UserModel.delete(mockUser.id))
        .rejects.toThrow('Cannot delete user with existing data');
    });
  });

  describe('validatePassword', () => {
    it('should validate correct password', async () => {
      // Arrange
      const userWithPassword = {
        ...mockUser,
        password: 'hashed-password'
      };

      mockDbQuery(userWithPassword);

      const bcrypt = require('bcryptjs');
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      // Act
      const result = await UserModel.validatePassword(mockUser.id, 'correct-password');

      // Assert
      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', 'hashed-password');
    });

    it('should reject incorrect password', async () => {
      // Arrange
      const userWithPassword = {
        ...mockUser,
        password: 'hashed-password'
      };

      mockDbQuery(userWithPassword);

      const bcrypt = require('bcryptjs');
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      // Act
      const result = await UserModel.validatePassword(mockUser.id, 'wrong-password');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle user not found', async () => {
      // Arrange
      mockDbQuery([]);

      // Act & Assert
      await expect(UserModel.validatePassword('non-existent-id', 'password'))
        .rejects.toThrow('User not found');
    });

    it('should handle user without password', async () => {
      // Arrange
      const userWithoutPassword = {
        ...mockUser,
        password: null
      };

      mockDbQuery(userWithoutPassword);

      // Act & Assert
      await expect(UserModel.validatePassword(mockUser.id, 'password'))
        .rejects.toThrow('User has no password set');
    });
  });

  describe('findByStackAuthId', () => {
    it('should find user by Stack Auth ID', async () => {
      // Arrange
      const stackAuthId = 'stack-auth-123';
      const userWithStackAuth = {
        ...mockUser,
        stack_auth_id: stackAuthId
      };

      mockDbQuery(userWithStackAuth);

      // Act
      const result = await UserModel.findByStackAuthId(stackAuthId);

      // Assert
      expect(result).toEqual(userWithStackAuth);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE stack_auth_id = $1'),
        [stackAuthId]
      );
    });

    it('should return null for non-existent Stack Auth ID', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await UserModel.findByStackAuthId('non-existent-stack-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return user statistics for company', async () => {
      // Arrange
      const mockStats = {
        total: '15',
        by_role: {
          admin: '2',
          user: '13'
        },
        active_today: '8',
        active_this_week: '12',
        recent_signups: '3'
      };

      mockDbQuery([mockStats]);

      // Act
      const result = await UserModel.getStats(mockCompany.id);

      // Assert
      expect(result.total).toBe(15);
      expect(result.byRole.admin).toBe(2);
      expect(result.byRole.user).toBe(13);
      expect(result.activeToday).toBe(8);
      expect(result.activeThisWeek).toBe(12);
      expect(result.recentSignups).toBe(3);

      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [mockCompany.id]
      );
    });

    it('should handle company with no users', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await UserModel.getStats('empty-company-id');

      // Assert
      expect(result.total).toBe(0);
      expect(result.byRole.admin).toBe(0);
      expect(result.byRole.user).toBe(0);
    });
  });

  describe('sanitizeUser', () => {
    it('should remove sensitive fields from user object', () => {
      // Arrange
      const userWithSensitiveData = {
        ...mockUser,
        password: 'hashed-password',
        stack_auth_id: 'stack-auth-123'
      };

      // Act
      const sanitized = UserModel.sanitizeUser(userWithSensitiveData);

      // Assert
      expect(sanitized.password).toBeUndefined();
      expect(sanitized.stack_auth_id).toBeUndefined();
      expect(sanitized.id).toBe(mockUser.id);
      expect(sanitized.email).toBe(mockUser.email);
      expect(sanitized.name).toBe(mockUser.name);
    });

    it('should handle null user', () => {
      // Act
      const result = UserModel.sanitizeUser(null);

      // Assert
      expect(result).toBeNull();
    });
  });
});