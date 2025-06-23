import request from 'supertest';
import express from 'express';
import userRoutes from '@/routes/users';
import { mockUser, mockCompany, mockDbQuery, mockDbError } from '../setup';

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = mockUser;
  req.company = mockCompany;
  next();
});

app.use('/users', userRoutes);

describe('UserController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users', () => {
    it('should return all users for admin', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      const mockUsers = [mockUser, { ...mockUser, id: 'user2', email: 'user2@example.com' }];
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(mockUsers);

      // Act
      const response = await request(app)
        .get('/users')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].email).toBe('test@example.com');
    });

    it('should deny access for non-admin users', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });

      // Act
      const response = await request(app)
        .get('/users')
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin access required');
    });

    it('should require authentication', async () => {
      // Arrange
      app.use((req, res, next) => {
        req.user = null;
        next();
      });

      // Act
      const response = await request(app)
        .get('/users')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });
  });

  describe('GET /users/:id', () => {
    it('should return user by id for admin', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      const targetUser = { ...mockUser, id: 'target-user-id' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(targetUser);

      // Act
      const response = await request(app)
        .get('/users/target-user-id')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('target-user-id');
    });

    it('should allow users to access their own data', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });
      
      mockDbQuery(regularUser);

      // Act
      const response = await request(app)
        .get(`/users/${mockUser.id}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockUser.id);
    });

    it('should deny access to other users data for non-admin', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });

      // Act
      const response = await request(app)
        .get('/users/other-user-id')
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });

    it('should return 404 for non-existent user', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(null);

      // Act
      const response = await request(app)
        .get('/users/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('User not found');
    });

    it('should return 404 for user from different company', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      const otherCompanyUser = { ...mockUser, company_id: 'other-company-id' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(otherCompanyUser);

      // Act
      const response = await request(app)
        .get('/users/other-company-user-id')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('User not found');
    });
  });

  describe('POST /users', () => {
    it('should create new user with valid data for admin', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      const newUserData = {
        email: 'newuser@example.com',
        name: 'New User',
        role: 'user',
        password: 'SecurePassword123!'
      };
      
      const createdUser = { 
        ...mockUser, 
        ...newUserData, 
        id: 'new-user-id',
        password: undefined // Password should not be returned
      };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(createdUser);

      // Act
      const response = await request(app)
        .post('/users')
        .send(newUserData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('newuser@example.com');
      expect(response.body.data.name).toBe('New User');
      expect(response.body.data.password).toBeUndefined();
      expect(response.body.data.company_id).toBe(mockCompany.id);
    });

    it('should deny user creation for non-admin', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });

      // Act
      const response = await request(app)
        .post('/users')
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          role: 'user',
          password: 'SecurePassword123!'
        })
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin access required');
    });

    it('should validate required fields', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });

      // Act
      const response = await request(app)
        .post('/users')
        .send({
          name: 'New User'
          // Missing email, password, role
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should validate email format', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });

      // Act
      const response = await request(app)
        .post('/users')
        .send({
          email: 'invalid-email',
          name: 'New User',
          role: 'user',
          password: 'SecurePassword123!'
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('email');
    });

    it('should validate password strength', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });

      // Act
      const response = await request(app)
        .post('/users')
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          role: 'user',
          password: 'weak'
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password');
    });

    it('should handle duplicate email', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      const duplicateError = new Error('duplicate key value violates unique constraint');
      duplicateError.name = 'PostgresError';
      (duplicateError as any).code = '23505';
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbError(duplicateError);

      // Act
      const response = await request(app)
        .post('/users')
        .send({
          email: mockUser.email,
          name: 'Duplicate User',
          role: 'user',
          password: 'SecurePassword123!'
        })
        .expect(409);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('PUT /users/:id', () => {
    it('should update user with valid data for admin', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      const updateData = {
        name: 'Updated User Name',
        email: 'updated@example.com',
        role: 'admin'
      };
      
      const updatedUser = { ...mockUser, ...updateData };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(updatedUser);

      // Act
      const response = await request(app)
        .put(`/users/${mockUser.id}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated User Name');
      expect(response.body.data.email).toBe('updated@example.com');
      expect(response.body.data.role).toBe('admin');
    });

    it('should allow users to update their own data (limited fields)', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
        // Role should be ignored for non-admin
      };
      
      const updatedUser = { ...mockUser, name: 'Updated Name', email: 'updated@example.com' };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });
      
      mockDbQuery(updatedUser);

      // Act
      const response = await request(app)
        .put(`/users/${mockUser.id}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.email).toBe('updated@example.com');
    });

    it('should deny updating other users for non-admin', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });

      // Act
      const response = await request(app)
        .put('/users/other-user-id')
        .send({ name: 'Updated Name' })
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });

    it('should return 404 for non-existent user', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(null);

      // Act
      const response = await request(app)
        .put('/users/non-existent-id')
        .send({ name: 'Updated Name' })
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('User not found');
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete user for admin', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery({ id: mockUser.id });

      // Act
      const response = await request(app)
        .delete(`/users/${mockUser.id}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should deny deletion for non-admin', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });

      // Act
      const response = await request(app)
        .delete(`/users/${mockUser.id}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin access required');
    });

    it('should prevent users from deleting themselves', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });

      // Act
      const response = await request(app)
        .delete(`/users/${adminUser.id}`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cannot delete yourself');
    });

    it('should return 404 for non-existent user', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery([]);

      // Act
      const response = await request(app)
        .delete('/users/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('User not found');
    });
  });

  describe('POST /users/:id/change-password', () => {
    it('should change password with valid current password', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      const passwordData = {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewPassword123!'
      };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });
      
      // Mock bcrypt compare to return true for valid current password
      const bcrypt = require('bcryptjs');
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      
      mockDbQuery({ ...mockUser, password: 'hashed-password' });

      // Act
      const response = await request(app)
        .post(`/users/${mockUser.id}/change-password`)
        .send(passwordData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password updated');
    });

    it('should reject invalid current password', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      const passwordData = {
        currentPassword: 'WrongPassword',
        newPassword: 'NewPassword123!'
      };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });
      
      // Mock bcrypt compare to return false for invalid current password
      const bcrypt = require('bcryptjs');
      bcrypt.compare = jest.fn().mockResolvedValue(false);
      
      mockDbQuery({ ...mockUser, password: 'hashed-password' });

      // Act
      const response = await request(app)
        .post(`/users/${mockUser.id}/change-password`)
        .send(passwordData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      const passwordData = {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'weak'
      };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });

      // Act
      const response = await request(app)
        .post(`/users/${mockUser.id}/change-password`)
        .send(passwordData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password');
    });
  });
});