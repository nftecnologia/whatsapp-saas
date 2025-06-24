import request from 'supertest';
import express from 'express';
import { WhatsAppIntegrationController } from '@/controllers/whatsappIntegrationController';
import { WhatsAppInstanceModel } from '@/models/WhatsAppInstanceModel';
import { authenticateToken } from '@/middleware/auth';
import { errorHandler } from '@/middleware/errorHandler';

// Mock the dependencies
jest.mock('@/models/WhatsAppInstanceModel');
jest.mock('@/middleware/auth');
jest.mock('axios');

const mockWhatsAppInstanceModel = WhatsAppInstanceModel as jest.Mocked<typeof WhatsAppInstanceModel>;
const mockAuthenticateToken = authenticateToken as jest.MockedFunction<typeof authenticateToken>;

// Test app setup
const app = express();
app.use(express.json());

// Mock authentication middleware
mockAuthenticateToken.mockImplementation((req: any, res: any, next: any) => {
  req.user = {
    id: 'user-123',
    company_id: 'company-123',
    email: 'test@company.com'
  };
  next();
});

// Setup routes
app.get('/integrations/whatsapp', mockAuthenticateToken, WhatsAppIntegrationController.getAll);
app.get('/integrations/whatsapp/stats', mockAuthenticateToken, WhatsAppIntegrationController.getStats);
app.get('/integrations/whatsapp/:id', mockAuthenticateToken, WhatsAppIntegrationController.getById);
app.get('/integrations/whatsapp/:id/status', mockAuthenticateToken, WhatsAppIntegrationController.getStatus);
app.post('/integrations/whatsapp', mockAuthenticateToken, WhatsAppIntegrationController.create);
app.post('/integrations/whatsapp/:id/connect', mockAuthenticateToken, WhatsAppIntegrationController.connect);
app.put('/integrations/whatsapp/:id', mockAuthenticateToken, WhatsAppIntegrationController.update);
app.delete('/integrations/whatsapp/:id', mockAuthenticateToken, WhatsAppIntegrationController.delete);

app.use(errorHandler);

describe('WhatsAppIntegrationController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockInstance = {
    id: 'instance-123',
    company_id: 'company-123',
    instance_name: 'Test Instance',
    integration_type: 'WHATSAPP-BUSINESS' as const,
    meta_access_token: 'test-token-12345678',
    meta_phone_number_id: 'phone-123',
    meta_business_id: 'business-123',
    status: 'disconnected' as const,
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockInstanceResponse = {
    ...mockInstance,
    meta_access_token: 'test****5678'
  };

  describe('POST /integrations/whatsapp', () => {
    it('should create a new WhatsApp integration', async () => {
      mockWhatsAppInstanceModel.create.mockResolvedValue(mockInstance);

      const response = await request(app)
        .post('/integrations/whatsapp')
        .send({
          instance_name: 'Test Instance',
          meta_access_token: 'test-access-token-12345678',
          meta_phone_number_id: 'phone-123',
          meta_business_id: 'business-123'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('WhatsApp integration created successfully');
      expect(response.body.data.instance_name).toBe('Test Instance');
      expect(response.body.data.meta_access_token).toBe('test****5678');
      expect(mockWhatsAppInstanceModel.create).toHaveBeenCalledWith({
        company_id: 'company-123',
        instance_name: 'Test Instance',
        integration_type: 'WHATSAPP-BUSINESS',
        meta_access_token: 'test-access-token-12345678',
        meta_phone_number_id: 'phone-123',
        meta_business_id: 'business-123',
        status: 'disconnected'
      });
    });

    it('should return 400 for invalid Meta token format', async () => {
      const response = await request(app)
        .post('/integrations/whatsapp')
        .send({
          instance_name: 'Test Instance',
          meta_access_token: 'short', // Too short
          meta_phone_number_id: 'phone-123',
          meta_business_id: 'business-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid Meta access token format');
    });

    it('should return 400 when instance name already exists', async () => {
      mockWhatsAppInstanceModel.create.mockRejectedValue(
        new Error('Instance name already exists for this company')
      );

      const response = await request(app)
        .post('/integrations/whatsapp')
        .send({
          instance_name: 'Existing Instance',
          meta_access_token: 'test-access-token-12345678',
          meta_phone_number_id: 'phone-123',
          meta_business_id: 'business-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Instance name already exists for this company');
    });
  });

  describe('GET /integrations/whatsapp', () => {
    it('should list company WhatsApp integrations', async () => {
      mockWhatsAppInstanceModel.findByCompanyId.mockResolvedValue({
        instances: [mockInstanceResponse],
        total: 1
      });

      const response = await request(app)
        .get('/integrations/whatsapp')
        .query({ page: '1', limit: '20' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
      expect(response.body.data[0].meta_access_token).toBe('test****5678');
      expect(mockWhatsAppInstanceModel.findByCompanyId).toHaveBeenCalledWith(
        'company-123',
        { limit: 20, offset: 0 }
      );
    });

    it('should filter by status', async () => {
      mockWhatsAppInstanceModel.findByCompanyId.mockResolvedValue({
        instances: [],
        total: 0
      });

      const response = await request(app)
        .get('/integrations/whatsapp')
        .query({ status: 'connected' });

      expect(response.status).toBe(200);
      expect(mockWhatsAppInstanceModel.findByCompanyId).toHaveBeenCalledWith(
        'company-123',
        { limit: 20, offset: 0, status: 'connected' }
      );
    });

    it('should return 400 for invalid status filter', async () => {
      const response = await request(app)
        .get('/integrations/whatsapp')
        .query({ status: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid status filter');
    });
  });

  describe('GET /integrations/whatsapp/:id', () => {
    it('should get specific WhatsApp integration', async () => {
      mockWhatsAppInstanceModel.findById.mockResolvedValue(mockInstance);

      const response = await request(app)
        .get('/integrations/whatsapp/instance-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('instance-123');
      expect(response.body.data.meta_access_token).toBe('test****5678');
      expect(mockWhatsAppInstanceModel.findById).toHaveBeenCalledWith(
        'instance-123',
        'company-123'
      );
    });

    it('should return 404 for non-existent integration', async () => {
      mockWhatsAppInstanceModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/integrations/whatsapp/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('WhatsApp integration not found');
    });
  });

  describe('PUT /integrations/whatsapp/:id', () => {
    it('should update WhatsApp integration', async () => {
      const updatedInstance = {
        ...mockInstance,
        instance_name: 'Updated Instance'
      };
      mockWhatsAppInstanceModel.update.mockResolvedValue(updatedInstance);

      const response = await request(app)
        .put('/integrations/whatsapp/instance-123')
        .send({
          instance_name: 'Updated Instance'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('WhatsApp integration updated successfully');
      expect(response.body.data.instance_name).toBe('Updated Instance');
      expect(mockWhatsAppInstanceModel.update).toHaveBeenCalledWith(
        'instance-123',
        'company-123',
        { instance_name: 'Updated Instance' }
      );
    });

    it('should return 404 for non-existent integration', async () => {
      mockWhatsAppInstanceModel.update.mockResolvedValue(null);

      const response = await request(app)
        .put('/integrations/whatsapp/non-existent')
        .send({
          instance_name: 'Updated Instance'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('WhatsApp integration not found');
    });
  });

  describe('DELETE /integrations/whatsapp/:id', () => {
    it('should delete WhatsApp integration', async () => {
      mockWhatsAppInstanceModel.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete('/integrations/whatsapp/instance-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('WhatsApp integration deleted successfully');
      expect(mockWhatsAppInstanceModel.delete).toHaveBeenCalledWith(
        'instance-123',
        'company-123'
      );
    });

    it('should return 404 for non-existent integration', async () => {
      mockWhatsAppInstanceModel.delete.mockResolvedValue(false);

      const response = await request(app)
        .delete('/integrations/whatsapp/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('WhatsApp integration not found');
    });
  });

  describe('POST /integrations/whatsapp/:id/connect', () => {
    it('should connect integration to Evolution API', async () => {
      mockWhatsAppInstanceModel.findById.mockResolvedValue(mockInstance);
      mockWhatsAppInstanceModel.updateStatus.mockResolvedValue(true);

      const response = await request(app)
        .post('/integrations/whatsapp/instance-123/connect');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('WhatsApp integration connected successfully');
      expect(response.body.data.status).toBe('connected');
      expect(mockWhatsAppInstanceModel.updateStatus).toHaveBeenCalledWith(
        'instance-123',
        'company-123',
        'connected'
      );
    });

    it('should return 404 for non-existent integration', async () => {
      mockWhatsAppInstanceModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/integrations/whatsapp/non-existent/connect');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('WhatsApp integration not found');
    });
  });

  describe('GET /integrations/whatsapp/:id/status', () => {
    it('should get real-time connection status', async () => {
      mockWhatsAppInstanceModel.findById.mockResolvedValue(mockInstance);
      mockWhatsAppInstanceModel.updateStatus.mockResolvedValue(true);

      const response = await request(app)
        .get('/integrations/whatsapp/instance-123/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('instance-123');
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.last_checked).toBeDefined();
    });

    it('should return 404 for non-existent integration', async () => {
      mockWhatsAppInstanceModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/integrations/whatsapp/non-existent/status');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('WhatsApp integration not found');
    });
  });

  describe('GET /integrations/whatsapp/stats', () => {
    it('should get integration statistics', async () => {
      const mockStats = {
        total: 5,
        connected: 3,
        disconnected: 1,
        error: 1
      };
      mockWhatsAppInstanceModel.getStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/integrations/whatsapp/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockWhatsAppInstanceModel.getStats).toHaveBeenCalledWith('company-123');
    });
  });

  describe('Authentication', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req: any, res: any, next: any) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/integrations/whatsapp');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });
  });
});