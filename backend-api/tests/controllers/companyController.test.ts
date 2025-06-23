import request from 'supertest';
import express from 'express';
import companyRoutes from '@/routes/companies';
import { mockUser, mockCompany, mockDbQuery, mockDbError } from '../setup';

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = mockUser;
  req.company = mockCompany;
  next();
});

app.use('/companies', companyRoutes);

describe('CompanyController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /companies', () => {
    it('should return current company information', async () => {
      // Arrange
      mockDbQuery(mockCompany);

      // Act
      const response = await request(app)
        .get('/companies')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockCompany.id);
      expect(response.body.data.name).toBe(mockCompany.name);
      expect(response.body.data.plan).toBe(mockCompany.plan);
    });

    it('should require authentication', async () => {
      // Arrange
      app.use((req, res, next) => {
        req.user = null;
        next();
      });

      // Act
      const response = await request(app)
        .get('/companies')
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
        .get('/companies')
        .expect(500);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Database connection failed');
    });
  });

  describe('PUT /companies', () => {
    it('should update company information for admin', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      const updateData = {
        name: 'Updated Company Name',
        email: 'updated@company.com',
        phone: '+5511888888888'
      };
      
      const updatedCompany = { ...mockCompany, ...updateData };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(updatedCompany);

      // Act
      const response = await request(app)
        .put('/companies')
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Company Name');
      expect(response.body.data.email).toBe('updated@company.com');
      expect(response.body.data.phone).toBe('+5511888888888');
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
        .put('/companies')
        .send({
          name: 'Updated Company Name'
        })
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin access required');
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
        .put('/companies')
        .send({
          name: 'Valid Company Name',
          email: 'invalid-email-format'
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('email');
    });

    it('should validate phone format', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });

      // Act
      const response = await request(app)
        .put('/companies')
        .send({
          name: 'Valid Company Name',
          phone: 'invalid-phone'
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('phone');
    });
  });

  describe('GET /companies/settings', () => {
    it('should return company settings', async () => {
      // Arrange
      const mockSettings = {
        id: mockCompany.id,
        whatsapp_api_url: 'https://api.evolutionapi.com',
        whatsapp_api_key: 'encrypted-api-key',
        default_message_template: 'Hello {{name}}!',
        business_hours: {
          enabled: true,
          timezone: 'America/Sao_Paulo',
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
        },
        auto_reply_enabled: true,
        auto_reply_message: 'Thanks for your message. We will get back to you soon.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      mockDbQuery(mockSettings);

      // Act
      const response = await request(app)
        .get('/companies/settings')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.whatsapp_api_url).toBe('https://api.evolutionapi.com');
      expect(response.body.data.business_hours.enabled).toBe(true);
      expect(response.body.data.auto_reply_enabled).toBe(true);
    });

    it('should require authentication', async () => {
      // Arrange
      app.use((req, res, next) => {
        req.user = null;
        next();
      });

      // Act
      const response = await request(app)
        .get('/companies/settings')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });
  });

  describe('PUT /companies/settings', () => {
    it('should update company settings for admin', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      const settingsUpdate = {
        whatsapp_api_url: 'https://api.evolutionapi.com/v2',
        whatsapp_api_key: 'new-encrypted-api-key',
        business_hours: {
          enabled: false,
          timezone: 'America/New_York'
        },
        auto_reply_enabled: false,
        auto_reply_message: 'Updated auto reply message'
      };
      
      const updatedSettings = {
        id: mockCompany.id,
        ...settingsUpdate,
        updated_at: new Date().toISOString()
      };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(updatedSettings);

      // Act
      const response = await request(app)
        .put('/companies/settings')
        .send(settingsUpdate)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.whatsapp_api_url).toBe('https://api.evolutionapi.com/v2');
      expect(response.body.data.business_hours.enabled).toBe(false);
      expect(response.body.data.auto_reply_enabled).toBe(false);
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
        .put('/companies/settings')
        .send({
          auto_reply_enabled: false
        })
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin access required');
    });

    it('should validate WhatsApp API URL format', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });

      // Act
      const response = await request(app)
        .put('/companies/settings')
        .send({
          whatsapp_api_url: 'invalid-url'
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('URL');
    });
  });

  describe('GET /companies/plan', () => {
    it('should return current plan information', async () => {
      // Arrange
      const mockPlanInfo = {
        plan: 'basic',
        limits: {
          contacts: 1000,
          templates: 10,
          campaigns_per_month: 50,
          messages_per_month: 5000
        },
        usage: {
          contacts: 150,
          templates: 3,
          campaigns_this_month: 8,
          messages_this_month: 1250
        },
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      mockDbQuery(mockPlanInfo);

      // Act
      const response = await request(app)
        .get('/companies/plan')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('basic');
      expect(response.body.data.limits.contacts).toBe(1000);
      expect(response.body.data.usage.contacts).toBe(150);
      expect(response.body.data.expires_at).toBeDefined();
    });

    it('should include percentage usage calculations', async () => {
      // Arrange
      const mockPlanInfo = {
        plan: 'basic',
        limits: {
          contacts: 1000,
          templates: 10,
          campaigns_per_month: 50,
          messages_per_month: 5000
        },
        usage: {
          contacts: 500,
          templates: 5,
          campaigns_this_month: 25,
          messages_this_month: 2500
        }
      };
      
      mockDbQuery(mockPlanInfo);

      // Act
      const response = await request(app)
        .get('/companies/plan')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.usage_percentage.contacts).toBe(50);
      expect(response.body.data.usage_percentage.templates).toBe(50);
      expect(response.body.data.usage_percentage.campaigns_this_month).toBe(50);
      expect(response.body.data.usage_percentage.messages_this_month).toBe(50);
    });
  });

  describe('POST /companies/plan/upgrade', () => {
    it('should initiate plan upgrade for admin', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      const upgradeData = {
        new_plan: 'premium',
        payment_method: 'stripe',
        billing_cycle: 'monthly'
      };
      
      const upgradeResponse = {
        success: true,
        payment_url: 'https://checkout.stripe.com/pay/cs_test_123',
        upgrade_id: 'upgrade_123'
      };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(upgradeResponse);

      // Act
      const response = await request(app)
        .post('/companies/plan/upgrade')
        .send(upgradeData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.payment_url).toBeDefined();
      expect(response.body.data.upgrade_id).toBeDefined();
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
        .post('/companies/plan/upgrade')
        .send({
          new_plan: 'premium'
        })
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin access required');
    });

    it('should validate plan selection', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });

      // Act
      const response = await request(app)
        .post('/companies/plan/upgrade')
        .send({
          new_plan: 'invalid_plan'
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid plan');
    });
  });

  describe('GET /companies/stats', () => {
    it('should return company statistics', async () => {
      // Arrange
      const mockStats = {
        total_users: '5',
        total_contacts: '1250',
        total_templates: '8',
        total_campaigns: '15',
        total_messages_sent: '12500',
        messages_this_month: '2500',
        campaigns_this_month: '3',
        success_rate: '98.5',
        created_at: mockCompany.created_at
      };
      
      mockDbQuery([mockStats]);

      // Act
      const response = await request(app)
        .get('/companies/stats')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalUsers).toBe(5);
      expect(response.body.data.totalContacts).toBe(1250);
      expect(response.body.data.totalTemplates).toBe(8);
      expect(response.body.data.totalCampaigns).toBe(15);
      expect(response.body.data.totalMessagesSent).toBe(12500);
      expect(response.body.data.messagesThisMonth).toBe(2500);
      expect(response.body.data.campaignsThisMonth).toBe(3);
      expect(response.body.data.successRate).toBe(98.5);
    });

    it('should require admin access', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });

      // Act
      const response = await request(app)
        .get('/companies/stats')
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin access required');
    });
  });

  describe('POST /companies/whatsapp/test-connection', () => {
    it('should test WhatsApp API connection', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      const connectionTest = {
        api_url: 'https://api.evolutionapi.com',
        api_key: 'test-api-key'
      };
      
      const testResult = {
        success: true,
        status: 'connected',
        instance_name: 'company-whatsapp',
        qr_code: null,
        phone_number: '+5511999999999'
      };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(testResult);

      // Act
      const response = await request(app)
        .post('/companies/whatsapp/test-connection')
        .send(connectionTest)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('connected');
      expect(response.body.data.instance_name).toBe('company-whatsapp');
    });

    it('should handle connection failures', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' };
      const connectionTest = {
        api_url: 'https://invalid-api.com',
        api_key: 'invalid-key'
      };
      
      const testResult = {
        success: false,
        status: 'error',
        error: 'Invalid API credentials'
      };
      
      app.use((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      mockDbQuery(testResult);

      // Act
      const response = await request(app)
        .post('/companies/whatsapp/test-connection')
        .send(connectionTest)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('error');
      expect(response.body.data.error).toContain('Invalid API credentials');
    });

    it('should require admin access', async () => {
      // Arrange
      const regularUser = { ...mockUser, role: 'user' };
      
      app.use((req, res, next) => {
        req.user = regularUser;
        next();
      });

      // Act
      const response = await request(app)
        .post('/companies/whatsapp/test-connection')
        .send({
          api_url: 'https://api.evolutionapi.com',
          api_key: 'test-key'
        })
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin access required');
    });
  });
});