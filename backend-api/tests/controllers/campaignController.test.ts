import request from 'supertest';
import express from 'express';
import campaignRoutes from '@/routes/campaigns';
import { mockUser, mockCompany, mockCampaign, mockTemplate, mockContact, mockDbQuery, mockDbError, mockRabbitMQSuccess } from '../setup';

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = mockUser;
  req.company = mockCompany;
  next();
});

app.use('/campaigns', campaignRoutes);

describe('CampaignController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /campaigns', () => {
    it('should return paginated campaigns for company', async () => {
      // Arrange
      const mockCampaigns = [
        mockCampaign,
        { ...mockCampaign, id: 'campaign2', name: 'Campaign 2', status: 'running' }
      ];
      const mockCountResult = { count: '2' };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: mockCampaigns })
        .mockResolvedValueOnce({ rows: [mockCountResult] });

      // Act
      const response = await request(app)
        .get('/campaigns')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Test Campaign');
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter campaigns by status', async () => {
      // Arrange
      const runningCampaigns = [{ ...mockCampaign, status: 'running' }];
      mockDbQuery(runningCampaigns);

      // Act
      const response = await request(app)
        .get('/campaigns?status=running')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining([mockCompany.id, 'running'])
      );
    });

    it('should filter campaigns by search term', async () => {
      // Arrange
      const filteredCampaigns = [mockCampaign];
      mockDbQuery(filteredCampaigns);

      // Act
      const response = await request(app)
        .get('/campaigns?search=Test')
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

    it('should require authentication', async () => {
      // Arrange
      app.use((req, res, next) => {
        req.user = null;
        next();
      });

      // Act
      const response = await request(app)
        .get('/campaigns')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });
  });

  describe('GET /campaigns/:id', () => {
    it('should return campaign by id with template details', async () => {
      // Arrange
      const campaignWithTemplate = {
        ...mockCampaign,
        template_name: mockTemplate.name,
        template_content: mockTemplate.content,
        template_category: mockTemplate.category
      };
      
      mockDbQuery(campaignWithTemplate);

      // Act
      const response = await request(app)
        .get(`/campaigns/${mockCampaign.id}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockCampaign.id);
      expect(response.body.data.name).toBe(mockCampaign.name);
      expect(response.body.data.template_name).toBe(mockTemplate.name);
    });

    it('should return 404 for non-existent campaign', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const response = await request(app)
        .get('/campaigns/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Campaign not found');
    });

    it('should return 404 for campaign from different company', async () => {
      // Arrange
      const otherCompanyCampaign = { ...mockCampaign, company_id: 'other-company-id' };
      mockDbQuery(otherCompanyCampaign);

      // Act
      const response = await request(app)
        .get(`/campaigns/${mockCampaign.id}`)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Campaign not found');
    });
  });

  describe('POST /campaigns', () => {
    it('should create new campaign with valid data', async () => {
      // Arrange
      const newCampaignData = {
        name: 'New Campaign',
        template_id: mockTemplate.id,
        contact_ids: [mockContact.id],
        variables: { product: 'WhatsApp SaaS' },
        scheduled_at: null
      };
      
      const createdCampaign = { 
        ...mockCampaign, 
        ...newCampaignData, 
        id: 'new-campaign-id',
        total_contacts: 1
      };
      
      // Mock template validation
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockTemplate] }) // Template exists
        .mockResolvedValueOnce({ rows: [mockContact] }) // Contact exists
        .mockResolvedValueOnce({ rows: [createdCampaign] }); // Campaign created

      // Act
      const response = await request(app)
        .post('/campaigns')
        .send(newCampaignData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Campaign');
      expect(response.body.data.template_id).toBe(mockTemplate.id);
      expect(response.body.data.total_contacts).toBe(1);
      expect(response.body.data.company_id).toBe(mockCompany.id);
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidData = {
        template_id: mockTemplate.id
        // Missing name and contact_ids
      };

      // Act
      const response = await request(app)
        .post('/campaigns')
        .send(invalidData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should validate template exists and belongs to company', async () => {
      // Arrange
      const invalidData = {
        name: 'Test Campaign',
        template_id: 'non-existent-template',
        contact_ids: [mockContact.id]
      };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Template not found

      // Act
      const response = await request(app)
        .post('/campaigns')
        .send(invalidData)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Template not found');
    });

    it('should validate contacts exist and belong to company', async () => {
      // Arrange
      const invalidData = {
        name: 'Test Campaign',
        template_id: mockTemplate.id,
        contact_ids: ['non-existent-contact']
      };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockTemplate] }) // Template exists
        .mockResolvedValueOnce({ rows: [] }); // Contacts not found

      // Act
      const response = await request(app)
        .post('/campaigns')
        .send(invalidData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid contacts');
    });

    it('should validate scheduled_at is in the future', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const invalidData = {
        name: 'Test Campaign',
        template_id: mockTemplate.id,
        contact_ids: [mockContact.id],
        scheduled_at: pastDate
      };

      // Act
      const response = await request(app)
        .post('/campaigns')
        .send(invalidData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('future');
    });

    it('should handle duplicate campaign names', async () => {
      // Arrange
      const duplicateData = {
        name: mockCampaign.name,
        template_id: mockTemplate.id,
        contact_ids: [mockContact.id]
      };
      
      const duplicateError = new Error('duplicate key value violates unique constraint');
      duplicateError.name = 'PostgresError';
      (duplicateError as any).code = '23505';
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockTemplate] })
        .mockResolvedValueOnce({ rows: [mockContact] })
        .mockRejectedValueOnce(duplicateError);

      // Act
      const response = await request(app)
        .post('/campaigns')
        .send(duplicateData)
        .expect(409);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('PUT /campaigns/:id', () => {
    it('should update campaign with valid data', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Campaign Name',
        variables: { product: 'Updated Product' },
        scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      const updatedCampaign = { ...mockCampaign, ...updateData };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] }) // Check if exists
        .mockResolvedValueOnce({ rows: [updatedCampaign] }); // Update

      // Act
      const response = await request(app)
        .put(`/campaigns/${mockCampaign.id}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Campaign Name');
      expect(response.body.data.variables.product).toBe('Updated Product');
    });

    it('should prevent updating campaign in running status', async () => {
      // Arrange
      const runningCampaign = { ...mockCampaign, status: 'running' };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [runningCampaign] });

      // Act
      const response = await request(app)
        .put(`/campaigns/${mockCampaign.id}`)
        .send({ name: 'Updated Name' })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cannot be updated');
    });

    it('should return 404 for non-existent campaign', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Act
      const response = await request(app)
        .put('/campaigns/non-existent-id')
        .send({ name: 'Updated Name' })
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Campaign not found');
    });
  });

  describe('DELETE /campaigns/:id', () => {
    it('should delete draft campaign successfully', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] }) // Check if exists
        .mockResolvedValueOnce({ rows: [{ id: mockCampaign.id }] }); // Delete

      // Act
      const response = await request(app)
        .delete(`/campaigns/${mockCampaign.id}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should prevent deletion of running campaign', async () => {
      // Arrange
      const runningCampaign = { ...mockCampaign, status: 'running' };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [runningCampaign] });

      // Act
      const response = await request(app)
        .delete(`/campaigns/${mockCampaign.id}`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cannot be deleted');
    });

    it('should return 404 for non-existent campaign', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Act
      const response = await request(app)
        .delete('/campaigns/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Campaign not found');
    });
  });

  describe('POST /campaigns/:id/send', () => {
    it('should send campaign successfully', async () => {
      // Arrange
      const { mockRabbitMQ } = mockRabbitMQSuccess();
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] }) // Check if exists
        .mockResolvedValueOnce({ rows: [mockContact] }) // Get contacts
        .mockResolvedValueOnce({ rows: [{ ...mockCampaign, status: 'running' }] }); // Update status

      // Act
      const response = await request(app)
        .post(`/campaigns/${mockCampaign.id}/send`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Campaign started');
      expect(mockRabbitMQ.publishToQueue).toHaveBeenCalledWith(
        'send_messages',
        expect.objectContaining({
          campaign_id: mockCampaign.id,
          company_id: mockCompany.id
        })
      );
    });

    it('should prevent sending non-draft campaign', async () => {
      // Arrange
      const runningCampaign = { ...mockCampaign, status: 'running' };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [runningCampaign] });

      // Act
      const response = await request(app)
        .post(`/campaigns/${mockCampaign.id}/send`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only draft campaigns can be sent');
    });

    it('should prevent sending campaign with no contacts', async () => {
      // Arrange
      const emptyContactsCampaign = { ...mockCampaign, total_contacts: 0 };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [emptyContactsCampaign] })
        .mockResolvedValueOnce({ rows: [] }); // No contacts

      // Act
      const response = await request(app)
        .post(`/campaigns/${mockCampaign.id}/send`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No contacts found');
    });

    it('should handle RabbitMQ publishing errors', async () => {
      // Arrange
      const mockRabbitMQ = require('@/config/rabbitmq');
      mockRabbitMQ.publishToQueue.mockRejectedValue(new Error('RabbitMQ connection failed'));
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] })
        .mockResolvedValueOnce({ rows: [mockContact] });

      // Act
      const response = await request(app)
        .post(`/campaigns/${mockCampaign.id}/send`)
        .expect(500);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('RabbitMQ connection failed');
    });
  });

  describe('POST /campaigns/:id/pause', () => {
    it('should pause running campaign successfully', async () => {
      // Arrange
      const runningCampaign = { ...mockCampaign, status: 'running' };
      const pausedCampaign = { ...mockCampaign, status: 'paused' };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [runningCampaign] })
        .mockResolvedValueOnce({ rows: [pausedCampaign] });

      // Act
      const response = await request(app)
        .post(`/campaigns/${mockCampaign.id}/pause`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Campaign paused');
      expect(response.body.data.status).toBe('paused');
    });

    it('should prevent pausing non-running campaign', async () => {
      // Arrange
      const draftCampaign = { ...mockCampaign, status: 'draft' };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [draftCampaign] });

      // Act
      const response = await request(app)
        .post(`/campaigns/${mockCampaign.id}/pause`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only running campaigns can be paused');
    });
  });

  describe('POST /campaigns/:id/resume', () => {
    it('should resume paused campaign successfully', async () => {
      // Arrange
      const pausedCampaign = { ...mockCampaign, status: 'paused' };
      const runningCampaign = { ...mockCampaign, status: 'running' };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [pausedCampaign] })
        .mockResolvedValueOnce({ rows: [runningCampaign] });

      // Act
      const response = await request(app)
        .post(`/campaigns/${mockCampaign.id}/resume`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Campaign resumed');
      expect(response.body.data.status).toBe('running');
    });

    it('should prevent resuming non-paused campaign', async () => {
      // Arrange
      const runningCampaign = { ...mockCampaign, status: 'running' };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [runningCampaign] });

      // Act
      const response = await request(app)
        .post(`/campaigns/${mockCampaign.id}/resume`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only paused campaigns can be resumed');
    });
  });

  describe('GET /campaigns/stats', () => {
    it('should return campaign statistics', async () => {
      // Arrange
      const mockStats = {
        total: '25',
        by_status: {
          draft: '8',
          scheduled: '3',
          running: '2',
          completed: '10',
          paused: '1',
          cancelled: '1'
        },
        total_messages_sent: '15000',
        average_success_rate: '96.5',
        this_month: '5',
        recent_activity: [
          {
            campaign_id: mockCampaign.id,
            campaign_name: mockCampaign.name,
            action: 'completed',
            timestamp: new Date().toISOString()
          }
        ]
      };
      
      mockDbQuery([mockStats]);

      // Act
      const response = await request(app)
        .get('/campaigns/stats')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(25);
      expect(response.body.data.byStatus.draft).toBe(8);
      expect(response.body.data.byStatus.running).toBe(2);
      expect(response.body.data.totalMessagesSent).toBe(15000);
      expect(response.body.data.averageSuccessRate).toBe(96.5);
      expect(response.body.data.thisMonth).toBe(5);
      expect(response.body.data.recentActivity).toHaveLength(1);
    });
  });

  describe('POST /campaigns/:id/duplicate', () => {
    it('should duplicate campaign successfully', async () => {
      // Arrange
      const duplicatedCampaign = {
        ...mockCampaign,
        id: 'duplicated-campaign-id',
        name: `${mockCampaign.name} (Copy)`,
        status: 'draft',
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] }) // Original campaign
        .mockResolvedValueOnce({ rows: [duplicatedCampaign] }); // Duplicated campaign

      // Act
      const response = await request(app)
        .post(`/campaigns/${mockCampaign.id}/duplicate`)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(`${mockCampaign.name} (Copy)`);
      expect(response.body.data.status).toBe('draft');
      expect(response.body.data.sent_count).toBe(0);
      expect(response.body.data.id).not.toBe(mockCampaign.id);
    });

    it('should return 404 for non-existent campaign', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Act
      const response = await request(app)
        .post('/campaigns/non-existent-id/duplicate')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Campaign not found');
    });
  });
});