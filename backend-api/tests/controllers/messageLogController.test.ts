import request from 'supertest';
import express from 'express';
import messageLogRoutes from '@/routes/messageLogs';
import { mockUser, mockCompany, mockMessageLog, mockCampaign, mockContact, mockDbQuery, mockDbError } from '../setup';

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = mockUser;
  req.company = mockCompany;
  next();
});

app.use('/message-logs', messageLogRoutes);

describe('MessageLogController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /message-logs', () => {
    it('should return paginated message logs for company', async () => {
      // Arrange
      const mockLogs = [
        mockMessageLog,
        { 
          ...mockMessageLog, 
          id: 'log2', 
          status: 'delivered',
          delivered_at: new Date().toISOString() 
        }
      ];
      const mockCountResult = { count: '2' };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: mockLogs })
        .mockResolvedValueOnce({ rows: [mockCountResult] });

      // Act
      const response = await request(app)
        .get('/message-logs')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].status).toBe('sent');
      expect(response.body.data[1].status).toBe('delivered');
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter logs by campaign_id', async () => {
      // Arrange
      const campaignLogs = [mockMessageLog];
      mockDbQuery(campaignLogs);

      // Act
      const response = await request(app)
        .get(`/message-logs?campaign_id=${mockCampaign.id}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('campaign_id'),
        expect.arrayContaining([mockCompany.id, mockCampaign.id])
      );
    });

    it('should filter logs by status', async () => {
      // Arrange
      const sentLogs = [mockMessageLog];
      mockDbQuery(sentLogs);

      // Act
      const response = await request(app)
        .get('/message-logs?status=sent')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining([mockCompany.id, 'sent'])
      );
    });

    it('should filter logs by phone number', async () => {
      // Arrange
      const phoneLogs = [mockMessageLog];
      mockDbQuery(phoneLogs);

      // Act
      const response = await request(app)
        .get('/message-logs?phone=+1234567890')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('phone'),
        expect.arrayContaining([mockCompany.id, '+1234567890'])
      );
    });

    it('should filter logs by date range', async () => {
      // Arrange
      const dateLogs = [mockMessageLog];
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      mockDbQuery(dateLogs);

      // Act
      const response = await request(app)
        .get(`/message-logs?start_date=${startDate}&end_date=${endDate}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at'),
        expect.arrayContaining([mockCompany.id, startDate, endDate])
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
        .get('/message-logs')
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
        .get('/message-logs')
        .expect(500);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Database connection failed');
    });
  });

  describe('GET /message-logs/:id', () => {
    it('should return message log by id', async () => {
      // Arrange
      const logWithDetails = {
        ...mockMessageLog,
        campaign_name: mockCampaign.name,
        contact_name: mockContact.name,
        template_name: 'Test Template'
      };
      
      mockDbQuery(logWithDetails);

      // Act
      const response = await request(app)
        .get(`/message-logs/${mockMessageLog.id}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockMessageLog.id);
      expect(response.body.data.campaign_name).toBe(mockCampaign.name);
      expect(response.body.data.contact_name).toBe(mockContact.name);
    });

    it('should return 404 for non-existent log', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const response = await request(app)
        .get('/message-logs/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Message log not found');
    });

    it('should return 404 for log from different company', async () => {
      // Arrange
      const otherCompanyLog = {
        ...mockMessageLog,
        campaign_id: 'other-campaign-id'
      };
      
      const logWithCampaign = {
        ...otherCompanyLog,
        campaign_company_id: 'other-company-id'
      };
      
      mockDbQuery(logWithCampaign);

      // Act
      const response = await request(app)
        .get(`/message-logs/${mockMessageLog.id}`)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Message log not found');
    });
  });

  describe('GET /message-logs/campaign/:campaignId', () => {
    it('should return all logs for a specific campaign', async () => {
      // Arrange
      const campaignLogs = [
        mockMessageLog,
        { ...mockMessageLog, id: 'log2', status: 'delivered' },
        { ...mockMessageLog, id: 'log3', status: 'failed', error_message: 'Invalid phone number' }
      ];
      
      const mockCountResult = { count: '3' };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] }) // Verify campaign exists
        .mockResolvedValueOnce({ rows: campaignLogs })
        .mockResolvedValueOnce({ rows: [mockCountResult] });

      // Act
      const response = await request(app)
        .get(`/message-logs/campaign/${mockCampaign.id}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].status).toBe('sent');
      expect(response.body.data[1].status).toBe('delivered');
      expect(response.body.data[2].status).toBe('failed');
      expect(response.body.pagination.total).toBe(3);
    });

    it('should return 404 for non-existent campaign', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Campaign not found

      // Act
      const response = await request(app)
        .get('/message-logs/campaign/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Campaign not found');
    });

    it('should return 404 for campaign from different company', async () => {
      // Arrange
      const otherCompanyCampaign = { ...mockCampaign, company_id: 'other-company-id' };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [otherCompanyCampaign] });

      // Act
      const response = await request(app)
        .get(`/message-logs/campaign/${mockCampaign.id}`)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Campaign not found');
    });
  });

  describe('GET /message-logs/stats', () => {
    it('should return message log statistics', async () => {
      // Arrange
      const mockStats = {
        total: '10000',
        by_status: {
          sent: '8500',
          delivered: '8200',
          read: '6500',
          failed: '300'
        },
        success_rate: '97.0',
        delivery_rate: '96.5',
        read_rate: '79.3',
        today: '150',
        this_week: '1200',
        this_month: '5500',
        average_delivery_time: '45', // seconds
        peak_hours: [
          { hour: '09', count: '450' },
          { hour: '14', count: '380' },
          { hour: '16', count: '320' }
        ],
        failure_reasons: [
          { reason: 'Invalid phone number', count: '150' },
          { reason: 'Number not on WhatsApp', count: '100' },
          { reason: 'Rate limit exceeded', count: '50' }
        ]
      };
      
      mockDbQuery([mockStats]);

      // Act
      const response = await request(app)
        .get('/message-logs/stats')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(10000);
      expect(response.body.data.byStatus.sent).toBe(8500);
      expect(response.body.data.byStatus.delivered).toBe(8200);
      expect(response.body.data.byStatus.read).toBe(6500);
      expect(response.body.data.byStatus.failed).toBe(300);
      expect(response.body.data.successRate).toBe(97.0);
      expect(response.body.data.deliveryRate).toBe(96.5);
      expect(response.body.data.readRate).toBe(79.3);
      expect(response.body.data.today).toBe(150);
      expect(response.body.data.thisWeek).toBe(1200);
      expect(response.body.data.thisMonth).toBe(5500);
      expect(response.body.data.averageDeliveryTime).toBe(45);
      expect(response.body.data.peakHours).toHaveLength(3);
      expect(response.body.data.failureReasons).toHaveLength(3);
    });

    it('should filter stats by date range', async () => {
      // Arrange
      const filteredStats = {
        total: '500',
        by_status: {
          sent: '450',
          delivered: '420',
          read: '380',
          failed: '30'
        },
        success_rate: '94.0'
      };
      
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      mockDbQuery([filteredStats]);

      // Act
      const response = await request(app)
        .get(`/message-logs/stats?start_date=${startDate}&end_date=${endDate}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(500);
      expect(response.body.data.successRate).toBe(94.0);
      
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at'),
        expect.arrayContaining([mockCompany.id, startDate, endDate])
      );
    });
  });

  describe('GET /message-logs/analytics/delivery-timeline', () => {
    it('should return delivery timeline analytics', async () => {
      // Arrange
      const mockTimeline = [
        {
          date: '2024-01-01',
          sent: '150',
          delivered: '145',
          read: '120',
          failed: '5'
        },
        {
          date: '2024-01-02',
          sent: '180',
          delivered: '175',
          read: '140',
          failed: '5'
        },
        {
          date: '2024-01-03',
          sent: '200',
          delivered: '195',
          read: '160',
          failed: '5'
        }
      ];
      
      mockDbQuery(mockTimeline);

      // Act
      const response = await request(app)
        .get('/message-logs/analytics/delivery-timeline?days=7')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].date).toBe('2024-01-01');
      expect(response.body.data[0].sent).toBe(150);
      expect(response.body.data[0].delivered).toBe(145);
      expect(response.body.data[0].read).toBe(120);
      expect(response.body.data[0].failed).toBe(5);
    });

    it('should validate days parameter', async () => {
      // Act
      const response = await request(app)
        .get('/message-logs/analytics/delivery-timeline?days=invalid')
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid days parameter');
    });

    it('should limit days parameter to maximum value', async () => {
      // Act
      const response = await request(app)
        .get('/message-logs/analytics/delivery-timeline?days=400')
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Maximum 365 days allowed');
    });
  });

  describe('GET /message-logs/analytics/performance', () => {
    it('should return performance analytics', async () => {
      // Arrange
      const mockPerformance = {
        overall_metrics: {
          total_sent: '50000',
          success_rate: '96.8',
          delivery_rate: '95.2',
          read_rate: '78.5',
          avg_delivery_time: '42'
        },
        hourly_performance: [
          { hour: '08', success_rate: '98.1', volume: '150' },
          { hour: '09', success_rate: '97.5', volume: '320' },
          { hour: '10', success_rate: '96.8', volume: '280' }
        ],
        campaign_performance: [
          {
            campaign_id: mockCampaign.id,
            campaign_name: mockCampaign.name,
            success_rate: '98.2',
            total_sent: '1500',
            avg_delivery_time: '38'
          }
        ],
        template_performance: [
          {
            template_id: 'template1',
            template_name: 'Welcome Message',
            success_rate: '97.8',
            usage_count: '2500'
          }
        ]
      };
      
      mockDbQuery([mockPerformance]);

      // Act
      const response = await request(app)
        .get('/message-logs/analytics/performance')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.overallMetrics.totalSent).toBe(50000);
      expect(response.body.data.overallMetrics.successRate).toBe(96.8);
      expect(response.body.data.overallMetrics.deliveryRate).toBe(95.2);
      expect(response.body.data.overallMetrics.readRate).toBe(78.5);
      expect(response.body.data.overallMetrics.avgDeliveryTime).toBe(42);
      expect(response.body.data.hourlyPerformance).toHaveLength(3);
      expect(response.body.data.campaignPerformance).toHaveLength(1);
      expect(response.body.data.templatePerformance).toHaveLength(1);
    });
  });

  describe('POST /message-logs/:id/retry', () => {
    it('should retry failed message successfully', async () => {
      // Arrange
      const failedLog = { 
        ...mockMessageLog, 
        status: 'failed',
        error_message: 'Rate limit exceeded'
      };
      
      const retriedLog = {
        ...failedLog,
        status: 'sent',
        error_message: null,
        sent_at: new Date().toISOString()
      };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [failedLog] }) // Check if exists and failed
        .mockResolvedValueOnce({ rows: [retriedLog] }); // Update status

      // Mock RabbitMQ publishing
      const mockRabbitMQ = require('@/config/rabbitmq');
      mockRabbitMQ.publishToQueue.mockResolvedValue(true);

      // Act
      const response = await request(app)
        .post(`/message-logs/${mockMessageLog.id}/retry`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Message retry initiated');
      expect(mockRabbitMQ.publishToQueue).toHaveBeenCalledWith(
        'retry_message',
        expect.objectContaining({
          message_log_id: mockMessageLog.id
        })
      );
    });

    it('should prevent retrying non-failed messages', async () => {
      // Arrange
      const successfulLog = { ...mockMessageLog, status: 'delivered' };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [successfulLog] });

      // Act
      const response = await request(app)
        .post(`/message-logs/${mockMessageLog.id}/retry`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only failed messages can be retried');
    });

    it('should return 404 for non-existent message log', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Act
      const response = await request(app)
        .post('/message-logs/non-existent-id/retry')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Message log not found');
    });
  });

  describe('POST /message-logs/export', () => {
    it('should export message logs as CSV', async () => {
      // Arrange
      const exportLogs = [
        mockMessageLog,
        { ...mockMessageLog, id: 'log2', status: 'delivered' }
      ];
      
      const exportData = {
        format: 'csv',
        filters: {
          campaign_id: mockCampaign.id,
          status: 'sent'
        }
      };
      
      mockDbQuery(exportLogs);

      // Act
      const response = await request(app)
        .post('/message-logs/export')
        .send(exportData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.export_id).toBeDefined();
      expect(response.body.data.download_url).toBeDefined();
      expect(response.body.data.total_records).toBe(2);
      expect(response.body.data.format).toBe('csv');
    });

    it('should export message logs as JSON', async () => {
      // Arrange
      const exportLogs = [mockMessageLog];
      const exportData = {
        format: 'json',
        filters: {}
      };
      
      mockDbQuery(exportLogs);

      // Act
      const response = await request(app)
        .post('/message-logs/export')
        .send(exportData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.format).toBe('json');
      expect(response.body.data.total_records).toBe(1);
    });

    it('should validate export format', async () => {
      // Arrange
      const exportData = {
        format: 'invalid_format',
        filters: {}
      };

      // Act
      const response = await request(app)
        .post('/message-logs/export')
        .send(exportData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid export format');
    });
  });
});