import request from 'supertest';
import express from 'express';
import contactRoutes from '@/routes/contacts';
import { mockUser, mockCompany, mockContact, mockDbQuery, mockDbError } from '../setup';

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = mockUser;
  req.company = mockCompany;
  next();
});

app.use('/contacts', contactRoutes);

describe('ContactController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /contacts', () => {
    it('should return paginated contacts for company', async () => {
      // Arrange
      const mockContacts = [mockContact, { ...mockContact, id: 'contact2', name: 'Contact 2' }];
      const mockCountResult = { count: '2' };
      
      mockDbQuery(mockContacts);
      // Mock count query
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: mockContacts })
        .mockResolvedValueOnce({ rows: [mockCountResult] });

      // Act
      const response = await request(app)
        .get('/contacts')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Test Contact');
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter contacts by search term', async () => {
      // Arrange
      const filteredContacts = [mockContact];
      mockDbQuery(filteredContacts);

      // Act
      const response = await request(app)
        .get('/contacts?search=Test')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining([mockCompany.id, '%Test%'])
      );
    });

    it('should filter contacts by tags', async () => {
      // Arrange
      const filteredContacts = [mockContact];
      mockDbQuery(filteredContacts);

      // Act
      const response = await request(app)
        .get('/contacts?tags=customer,vip')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tags'),
        expect.arrayContaining([mockCompany.id, ['customer', 'vip']])
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      mockDbError(new Error('Database connection failed'));

      // Act
      const response = await request(app)
        .get('/contacts')
        .expect(500);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Database connection failed');
    });
  });

  describe('POST /contacts', () => {
    it('should create a new contact with valid data', async () => {
      // Arrange
      const newContactData = {
        name: 'New Contact',
        phone: '+5511999999999',
        email: 'new@example.com',
        tags: ['prospect'],
        custom_fields: { source: 'website' }
      };
      
      const createdContact = { ...mockContact, ...newContactData, id: 'new-contact-id' };
      mockDbQuery(createdContact);

      // Act
      const response = await request(app)
        .post('/contacts')
        .send(newContactData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Contact');
      expect(response.body.data.phone).toBe('+5511999999999');
      expect(response.body.data.company_id).toBe(mockCompany.id);
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidData = {
        email: 'invalid-email', // Missing name and phone
      };

      // Act
      const response = await request(app)
        .post('/contacts')
        .send(invalidData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should validate phone format', async () => {
      // Arrange
      const invalidData = {
        name: 'Test Contact',
        phone: 'invalid-phone',
        email: 'test@example.com'
      };

      // Act
      const response = await request(app)
        .post('/contacts')
        .send(invalidData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('phone');
    });

    it('should handle duplicate phone numbers', async () => {
      // Arrange
      const duplicateData = {
        name: 'Duplicate Contact',
        phone: mockContact.phone,
        email: 'duplicate@example.com'
      };
      
      const duplicateError = new Error('duplicate key value violates unique constraint');
      duplicateError.name = 'PostgresError';
      (duplicateError as any).code = '23505';
      
      mockDbError(duplicateError);

      // Act
      const response = await request(app)
        .post('/contacts')
        .send(duplicateData)
        .expect(409);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('PUT /contacts/:id', () => {
    it('should update contact with valid data', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Contact Name',
        email: 'updated@example.com',
        tags: ['customer', 'premium']
      };
      
      const updatedContact = { ...mockContact, ...updateData };
      mockDbQuery(updatedContact);

      // Act
      const response = await request(app)
        .put(`/contacts/${mockContact.id}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Contact Name');
      expect(response.body.data.email).toBe('updated@example.com');
    });

    it('should return 404 for non-existent contact', async () => {
      // Arrange
      mockDbQuery([]); // No rows returned

      // Act
      const response = await request(app)
        .put('/contacts/non-existent-id')
        .send({ name: 'Updated Name' })
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('DELETE /contacts/:id', () => {
    it('should delete contact successfully', async () => {
      // Arrange
      mockDbQuery({ id: mockContact.id }); // Simulate successful deletion

      // Act
      const response = await request(app)
        .delete(`/contacts/${mockContact.id}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 for non-existent contact', async () => {
      // Arrange
      mockDbQuery([]); // No rows affected

      // Act
      const response = await request(app)
        .delete('/contacts/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /contacts/bulk', () => {
    it('should create multiple contacts successfully', async () => {
      // Arrange
      const bulkData = {
        contacts: [
          { name: 'Contact 1', phone: '+5511111111111', email: 'contact1@example.com' },
          { name: 'Contact 2', phone: '+5511111111112', email: 'contact2@example.com' },
        ]
      };
      
      const createdContacts = bulkData.contacts.map((contact, index) => ({
        ...mockContact,
        ...contact,
        id: `bulk-contact-${index}`
      }));
      
      mockDbQuery(createdContacts);

      // Act
      const response = await request(app)
        .post('/contacts/bulk')
        .send(bulkData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Contact 1');
      expect(response.body.data[1].name).toBe('Contact 2');
    });

    it('should validate bulk contact data', async () => {
      // Arrange
      const invalidBulkData = {
        contacts: [
          { name: 'Valid Contact', phone: '+5511111111111' },
          { name: '', phone: 'invalid-phone' }, // Invalid data
        ]
      };

      // Act
      const response = await request(app)
        .post('/contacts/bulk')
        .send(invalidBulkData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should handle partial failures in bulk creation', async () => {
      // Arrange
      const bulkData = {
        contacts: [
          { name: 'Contact 1', phone: '+5511111111111' },
          { name: 'Contact 2', phone: mockContact.phone }, // Duplicate phone
        ]
      };
      
      const partialError = new Error('Some contacts failed to create');
      mockDbError(partialError);

      // Act
      const response = await request(app)
        .post('/contacts/bulk')
        .send(bulkData)
        .expect(207); // Partial success

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('partial');
    });
  });

  describe('GET /contacts/stats', () => {
    it('should return contact statistics', async () => {
      // Arrange
      const mockStats = {
        total: '150',
        active: '140',
        with_email: '120',
        with_tags: '80',
        recent: '25'
      };
      
      mockDbQuery([mockStats]);

      // Act
      const response = await request(app)
        .get('/contacts/stats')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(150);
      expect(response.body.data.active).toBe(140);
      expect(response.body.data.withEmail).toBe(120);
      expect(response.body.data.withTags).toBe(80);
      expect(response.body.data.recent).toBe(25);
    });
  });

  describe('GET /contacts/tags', () => {
    it('should return all unique tags used by company contacts', async () => {
      // Arrange
      const mockTags = [
        { tag: 'customer' },
        { tag: 'prospect' },
        { tag: 'vip' },
        { tag: 'inactive' }
      ];
      
      mockDbQuery(mockTags);

      // Act
      const response = await request(app)
        .get('/contacts/tags')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(4);
      expect(response.body.data).toContain('customer');
      expect(response.body.data).toContain('prospect');
      expect(response.body.data).toContain('vip');
      expect(response.body.data).toContain('inactive');
    });
  });
});