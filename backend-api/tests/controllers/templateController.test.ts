import request from 'supertest';
import express from 'express';
import templateRoutes from '@/routes/templates';
import { mockUser, mockCompany, mockTemplate, mockDbQuery, mockDbError } from '../setup';

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = mockUser;
  req.company = mockCompany;
  next();
});

app.use('/templates', templateRoutes);

describe('TemplateController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /templates', () => {
    it('should return paginated templates for company', async () => {
      // Arrange
      const mockTemplates = [
        mockTemplate,
        { ...mockTemplate, id: 'template2', name: 'Template 2', category: 'support' }
      ];
      const mockCountResult = { count: '2' };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: mockTemplates })
        .mockResolvedValueOnce({ rows: [mockCountResult] });

      // Act
      const response = await request(app)
        .get('/templates')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Test Template');
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter templates by search term', async () => {
      // Arrange
      const filteredTemplates = [mockTemplate];
      mockDbQuery(filteredTemplates);

      // Act
      const response = await request(app)
        .get('/templates?search=Test')
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

    it('should filter templates by category', async () => {
      // Arrange
      const filteredTemplates = [mockTemplate];
      mockDbQuery(filteredTemplates);

      // Act
      const response = await request(app)
        .get('/templates?category=marketing')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('category'),
        expect.arrayContaining([mockCompany.id, 'marketing'])
      );
    });

    it('should require authentication', async () => {
      // Arrange
      app.use((req, res, next) => {
        req.user = null;
        next();
      });

      // Act
      const response = await request(app)
        .get('/templates')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });

    it('should handle database errors', async () => {
      // Arrange
      mockDbError(new Error('Database connection failed'));

      // Act
      const response = await request(app)
        .get('/templates')
        .expect(500);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Database connection failed');
    });
  });

  describe('GET /templates/:id', () => {
    it('should return template by id', async () => {
      // Arrange
      mockDbQuery(mockTemplate);

      // Act
      const response = await request(app)
        .get(`/templates/${mockTemplate.id}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockTemplate.id);
      expect(response.body.data.name).toBe(mockTemplate.name);
      expect(response.body.data.content).toBe(mockTemplate.content);
    });

    it('should return 404 for non-existent template', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const response = await request(app)
        .get('/templates/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Template not found');
    });

    it('should return 404 for template from different company', async () => {
      // Arrange
      const otherCompanyTemplate = { ...mockTemplate, company_id: 'other-company-id' };
      mockDbQuery(otherCompanyTemplate);

      // Act
      const response = await request(app)
        .get(`/templates/${mockTemplate.id}`)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Template not found');
    });
  });

  describe('POST /templates', () => {
    it('should create new template with valid data', async () => {
      // Arrange
      const newTemplateData = {
        name: 'New Template',
        content: 'Hello {{name}}, welcome to our service!',
        category: 'welcome'
      };
      
      const createdTemplate = { 
        ...mockTemplate, 
        ...newTemplateData, 
        id: 'new-template-id' 
      };
      
      mockDbQuery(createdTemplate);

      // Act
      const response = await request(app)
        .post('/templates')
        .send(newTemplateData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Template');
      expect(response.body.data.content).toBe('Hello {{name}}, welcome to our service!');
      expect(response.body.data.category).toBe('welcome');
      expect(response.body.data.company_id).toBe(mockCompany.id);
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidData = {
        content: 'Hello world!' // Missing name
      };

      // Act
      const response = await request(app)
        .post('/templates')
        .send(invalidData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should validate template content has placeholders', async () => {
      // Arrange
      const invalidData = {
        name: 'Test Template',
        content: 'This template has no variables', // No {{}} placeholders
        category: 'marketing'
      };

      // Act
      const response = await request(app)
        .post('/templates')
        .send(invalidData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('placeholder');
    });

    it('should validate category enum', async () => {
      // Arrange
      const invalidData = {
        name: 'Test Template',
        content: 'Hello {{name}}!',
        category: 'invalid_category'
      };

      // Act
      const response = await request(app)
        .post('/templates')
        .send(invalidData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('category');
    });

    it('should handle duplicate template names', async () => {
      // Arrange
      const duplicateData = {
        name: mockTemplate.name,
        content: 'Different content {{name}}',
        category: 'marketing'
      };
      
      const duplicateError = new Error('duplicate key value violates unique constraint');
      duplicateError.name = 'PostgresError';
      (duplicateError as any).code = '23505';
      
      mockDbError(duplicateError);

      // Act
      const response = await request(app)
        .post('/templates')
        .send(duplicateData)
        .expect(409);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('PUT /templates/:id', () => {
    it('should update template with valid data', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Template Name',
        content: 'Updated content with {{name}} and {{product}}',
        category: 'support'
      };
      
      const updatedTemplate = { ...mockTemplate, ...updateData };
      mockDbQuery(updatedTemplate);

      // Act
      const response = await request(app)
        .put(`/templates/${mockTemplate.id}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Template Name');
      expect(response.body.data.content).toBe('Updated content with {{name}} and {{product}}');
      expect(response.body.data.category).toBe('support');
    });

    it('should return 404 for non-existent template', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const response = await request(app)
        .put('/templates/non-existent-id')
        .send({ name: 'Updated Name' })
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Template not found');
    });

    it('should validate updated content has placeholders', async () => {
      // Arrange
      const updateData = {
        content: 'This content has no placeholders'
      };

      // Act
      const response = await request(app)
        .put(`/templates/${mockTemplate.id}`)
        .send(updateData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('placeholder');
    });
  });

  describe('DELETE /templates/:id', () => {
    it('should delete template successfully', async () => {
      // Arrange
      mockDbQuery({ id: mockTemplate.id });

      // Act
      const response = await request(app)
        .delete(`/templates/${mockTemplate.id}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 for non-existent template', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const response = await request(app)
        .delete('/templates/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Template not found');
    });

    it('should prevent deletion of template in use by campaigns', async () => {
      // Arrange
      const inUseError = new Error('Template is being used by active campaigns');
      inUseError.name = 'ForeignKeyConstraintError';
      
      mockDbError(inUseError);

      // Act
      const response = await request(app)
        .delete(`/templates/${mockTemplate.id}`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('being used by active campaigns');
    });
  });

  describe('GET /templates/categories', () => {
    it('should return all template categories', async () => {
      // Arrange
      const mockCategories = [
        { category: 'marketing' },
        { category: 'support' },
        { category: 'welcome' },
        { category: 'notification' }
      ];
      
      mockDbQuery(mockCategories);

      // Act
      const response = await request(app)
        .get('/templates/categories')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(4);
      expect(response.body.data).toContain('marketing');
      expect(response.body.data).toContain('support');
      expect(response.body.data).toContain('welcome');
      expect(response.body.data).toContain('notification');
    });
  });

  describe('GET /templates/stats', () => {
    it('should return template statistics', async () => {
      // Arrange
      const mockStats = {
        total: '12',
        by_category: {
          marketing: '5',
          support: '3',
          welcome: '2',
          notification: '2'
        },
        most_used: {
          template_id: mockTemplate.id,
          template_name: mockTemplate.name,
          usage_count: '25'
        },
        recent: '3'
      };
      
      mockDbQuery([mockStats]);

      // Act
      const response = await request(app)
        .get('/templates/stats')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(12);
      expect(response.body.data.byCategory.marketing).toBe(5);
      expect(response.body.data.byCategory.support).toBe(3);
      expect(response.body.data.mostUsed.templateName).toBe(mockTemplate.name);
      expect(response.body.data.mostUsed.usageCount).toBe(25);
      expect(response.body.data.recent).toBe(3);
    });
  });

  describe('POST /templates/:id/preview', () => {
    it('should generate template preview with variables', async () => {
      // Arrange
      const previewData = {
        variables: {
          name: 'John Doe',
          product: 'WhatsApp SaaS'
        }
      };
      
      mockDbQuery(mockTemplate);

      // Act
      const response = await request(app)
        .post(`/templates/${mockTemplate.id}/preview`)
        .send(previewData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.original_content).toBe(mockTemplate.content);
      expect(response.body.data.rendered_content).toBe('Hello John Doe, this is a test message!');
      expect(response.body.data.variables_used).toEqual(['name']);
      expect(response.body.data.missing_variables).toEqual([]);
    });

    it('should identify missing variables in preview', async () => {
      // Arrange
      const templateWithMultipleVars = {
        ...mockTemplate,
        content: 'Hello {{name}}, your order {{order_id}} for {{product}} is ready!'
      };
      
      const previewData = {
        variables: {
          name: 'John Doe'
          // Missing order_id and product
        }
      };
      
      mockDbQuery(templateWithMultipleVars);

      // Act
      const response = await request(app)
        .post(`/templates/${mockTemplate.id}/preview`)
        .send(previewData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.variables_used).toEqual(['name', 'order_id', 'product']);
      expect(response.body.data.missing_variables).toEqual(['order_id', 'product']);
      expect(response.body.data.rendered_content).toContain('{{order_id}}'); // Unrendered
      expect(response.body.data.rendered_content).toContain('{{product}}'); // Unrendered
    });

    it('should return 404 for non-existent template', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const response = await request(app)
        .post('/templates/non-existent-id/preview')
        .send({ variables: {} })
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Template not found');
    });
  });

  describe('POST /templates/bulk', () => {
    it('should create multiple templates successfully', async () => {
      // Arrange
      const bulkData = {
        templates: [
          {
            name: 'Bulk Template 1',
            content: 'Hello {{name}}, welcome!',
            category: 'welcome'
          },
          {
            name: 'Bulk Template 2',
            content: 'Hi {{name}}, your order {{order_id}} is ready!',
            category: 'notification'
          }
        ]
      };
      
      const createdTemplates = bulkData.templates.map((template, index) => ({
        ...mockTemplate,
        ...template,
        id: `bulk-template-${index}`
      }));
      
      mockDbQuery(createdTemplates);

      // Act
      const response = await request(app)
        .post('/templates/bulk')
        .send(bulkData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Bulk Template 1');
      expect(response.body.data[1].name).toBe('Bulk Template 2');
    });

    it('should validate bulk template data', async () => {
      // Arrange
      const invalidBulkData = {
        templates: [
          {
            name: 'Valid Template',
            content: 'Hello {{name}}!',
            category: 'welcome'
          },
          {
            name: '', // Invalid - empty name
            content: 'Invalid content', // Invalid - no placeholders
            category: 'marketing'
          }
        ]
      };

      // Act
      const response = await request(app)
        .post('/templates/bulk')
        .send(invalidBulkData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });
  });
});