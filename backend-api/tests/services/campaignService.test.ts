import campaignService from '@/services/campaignService';
import { mockUser, mockCompany, mockCampaign, mockTemplate, mockContact, mockDbQuery, mockDbError, mockRabbitMQSuccess } from '../setup';

describe('CampaignService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCampaign', () => {
    it('should create campaign with valid data', async () => {
      // Arrange
      const campaignData = {
        name: 'New Campaign',
        template_id: mockTemplate.id,
        contact_ids: [mockContact.id],
        variables: { product: 'WhatsApp SaaS' },
        scheduled_at: null
      };

      const createdCampaign = {
        ...mockCampaign,
        ...campaignData,
        id: 'new-campaign-id',
        total_contacts: 1
      };

      // Mock database operations
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockTemplate] }) // Template validation
        .mockResolvedValueOnce({ rows: [mockContact] }) // Contact validation
        .mockResolvedValueOnce({ rows: [createdCampaign] }); // Campaign creation

      // Act
      const result = await campaignService.createCampaign(campaignData, mockCompany.id);

      // Assert
      expect(result.id).toBe('new-campaign-id');
      expect(result.name).toBe('New Campaign');
      expect(result.template_id).toBe(mockTemplate.id);
      expect(result.total_contacts).toBe(1);
      expect(result.company_id).toBe(mockCompany.id);
    });

    it('should validate template exists and belongs to company', async () => {
      // Arrange
      const campaignData = {
        name: 'Test Campaign',
        template_id: 'non-existent-template',
        contact_ids: [mockContact.id],
        variables: {},
        scheduled_at: null
      };

      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Template not found

      // Act & Assert
      await expect(campaignService.createCampaign(campaignData, mockCompany.id))
        .rejects.toThrow('Template not found or does not belong to company');
    });

    it('should validate contacts exist and belong to company', async () => {
      // Arrange
      const campaignData = {
        name: 'Test Campaign',
        template_id: mockTemplate.id,
        contact_ids: ['non-existent-contact'],
        variables: {},
        scheduled_at: null
      };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockTemplate] }) // Template exists
        .mockResolvedValueOnce({ rows: [] }); // Contacts not found

      // Act & Assert
      await expect(campaignService.createCampaign(campaignData, mockCompany.id))
        .rejects.toThrow('Some contacts not found or do not belong to company');
    });

    it('should handle database errors during creation', async () => {
      // Arrange
      const campaignData = {
        name: 'Test Campaign',
        template_id: mockTemplate.id,
        contact_ids: [mockContact.id],
        variables: {},
        scheduled_at: null
      };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockTemplate] })
        .mockResolvedValueOnce({ rows: [mockContact] })
        .mockRejectedValueOnce(new Error('Database connection failed'));

      // Act & Assert
      await expect(campaignService.createCampaign(campaignData, mockCompany.id))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('sendCampaign', () => {
    it('should send campaign successfully', async () => {
      // Arrange
      const campaignId = mockCampaign.id;
      const { mockRabbitMQ } = mockRabbitMQSuccess();

      const campaignWithContacts = {
        ...mockCampaign,
        contacts: [mockContact]
      };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] }) // Get campaign
        .mockResolvedValueOnce({ rows: [mockContact] }) // Get contacts
        .mockResolvedValueOnce({ rows: [{ ...mockCampaign, status: 'running' }] }); // Update status

      // Act
      const result = await campaignService.sendCampaign(campaignId, mockCompany.id);

      // Assert
      expect(result.success).toBe(true);
      expect(result.campaign.status).toBe('running');
      expect(result.message).toContain('Campaign started successfully');
      expect(mockRabbitMQ.publishToQueue).toHaveBeenCalledWith(
        'send_messages',
        expect.objectContaining({
          campaign_id: campaignId,
          company_id: mockCompany.id,
          contacts: [mockContact],
          template: expect.any(Object)
        })
      );
    });

    it('should prevent sending non-draft campaign', async () => {
      // Arrange
      const runningCampaign = { ...mockCampaign, status: 'running' };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [runningCampaign] });

      // Act & Assert
      await expect(campaignService.sendCampaign(mockCampaign.id, mockCompany.id))
        .rejects.toThrow('Only draft campaigns can be sent');
    });

    it('should prevent sending campaign with no contacts', async () => {
      // Arrange
      const emptyContactsCampaign = { ...mockCampaign, total_contacts: 0 };
      
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [emptyContactsCampaign] })
        .mockResolvedValueOnce({ rows: [] }); // No contacts

      // Act & Assert
      await expect(campaignService.sendCampaign(mockCampaign.id, mockCompany.id))
        .rejects.toThrow('Campaign has no contacts to send to');
    });

    it('should handle RabbitMQ publishing errors', async () => {
      // Arrange
      const mockRabbitMQ = require('@/config/rabbitmq');
      mockRabbitMQ.publishToQueue.mockRejectedValue(new Error('RabbitMQ connection failed'));

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] })
        .mockResolvedValueOnce({ rows: [mockContact] });

      // Act & Assert
      await expect(campaignService.sendCampaign(mockCampaign.id, mockCompany.id))
        .rejects.toThrow('Failed to queue campaign messages');
    });

    it('should rollback campaign status on failure', async () => {
      // Arrange
      const mockRabbitMQ = require('@/config/rabbitmq');
      mockRabbitMQ.publishToQueue.mockRejectedValue(new Error('Queue failed'));

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] }) // Get campaign
        .mockResolvedValueOnce({ rows: [mockContact] }) // Get contacts
        .mockResolvedValueOnce({ rows: [{ ...mockCampaign, status: 'running' }] }) // Update to running
        .mockResolvedValueOnce({ rows: [mockCampaign] }); // Rollback to draft

      // Act & Assert
      await expect(campaignService.sendCampaign(mockCampaign.id, mockCompany.id))
        .rejects.toThrow('Failed to queue campaign messages');

      // Verify rollback was attempted
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE campaigns SET status = $1'),
        ['draft', mockCampaign.id, mockCompany.id]
      );
    });
  });

  describe('pauseCampaign', () => {
    it('should pause running campaign successfully', async () => {
      // Arrange
      const runningCampaign = { ...mockCampaign, status: 'running' };
      const pausedCampaign = { ...mockCampaign, status: 'paused' };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [runningCampaign] })
        .mockResolvedValueOnce({ rows: [pausedCampaign] });

      // Act
      const result = await campaignService.pauseCampaign(mockCampaign.id, mockCompany.id);

      // Assert
      expect(result.status).toBe('paused');
      expect(result.id).toBe(mockCampaign.id);
    });

    it('should prevent pausing non-running campaign', async () => {
      // Arrange
      const draftCampaign = { ...mockCampaign, status: 'draft' };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [draftCampaign] });

      // Act & Assert
      await expect(campaignService.pauseCampaign(mockCampaign.id, mockCompany.id))
        .rejects.toThrow('Only running campaigns can be paused');
    });

    it('should handle campaign not found', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Act & Assert
      await expect(campaignService.pauseCampaign('non-existent-id', mockCompany.id))
        .rejects.toThrow('Campaign not found');
    });
  });

  describe('resumeCampaign', () => {
    it('should resume paused campaign successfully', async () => {
      // Arrange
      const pausedCampaign = { ...mockCampaign, status: 'paused' };
      const runningCampaign = { ...mockCampaign, status: 'running' };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [pausedCampaign] })
        .mockResolvedValueOnce({ rows: [runningCampaign] });

      // Act
      const result = await campaignService.resumeCampaign(mockCampaign.id, mockCompany.id);

      // Assert
      expect(result.status).toBe('running');
      expect(result.id).toBe(mockCampaign.id);
    });

    it('should prevent resuming non-paused campaign', async () => {
      // Arrange
      const runningCampaign = { ...mockCampaign, status: 'running' };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [runningCampaign] });

      // Act & Assert
      await expect(campaignService.resumeCampaign(mockCampaign.id, mockCompany.id))
        .rejects.toThrow('Only paused campaigns can be resumed');
    });
  });

  describe('cancelCampaign', () => {
    it('should cancel campaign successfully', async () => {
      // Arrange
      const cancelledCampaign = { ...mockCampaign, status: 'cancelled' };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] })
        .mockResolvedValueOnce({ rows: [cancelledCampaign] });

      // Act
      const result = await campaignService.cancelCampaign(mockCampaign.id, mockCompany.id);

      // Assert
      expect(result.status).toBe('cancelled');
      expect(result.id).toBe(mockCampaign.id);
    });

    it('should prevent cancelling completed campaign', async () => {
      // Arrange
      const completedCampaign = { ...mockCampaign, status: 'completed' };
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [completedCampaign] });

      // Act & Assert
      await expect(campaignService.cancelCampaign(mockCampaign.id, mockCompany.id))
        .rejects.toThrow('Completed campaigns cannot be cancelled');
    });
  });

  describe('scheduleCampaign', () => {
    it('should schedule campaign for future execution', async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const scheduledCampaign = { 
        ...mockCampaign, 
        status: 'scheduled',
        scheduled_at: futureDate
      };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] })
        .mockResolvedValueOnce({ rows: [scheduledCampaign] });

      // Act
      const result = await campaignService.scheduleCampaign(mockCampaign.id, futureDate, mockCompany.id);

      // Assert
      expect(result.status).toBe('scheduled');
      expect(result.scheduled_at).toBe(futureDate);
    });

    it('should validate scheduled date is in the future', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Act & Assert
      await expect(campaignService.scheduleCampaign(mockCampaign.id, pastDate, mockCompany.id))
        .rejects.toThrow('Scheduled date must be in the future');
    });

    it('should prevent scheduling non-draft campaign', async () => {
      // Arrange
      const runningCampaign = { ...mockCampaign, status: 'running' };
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [runningCampaign] });

      // Act & Assert
      await expect(campaignService.scheduleCampaign(mockCampaign.id, futureDate, mockCompany.id))
        .rejects.toThrow('Only draft campaigns can be scheduled');
    });
  });

  describe('duplicateCampaign', () => {
    it('should duplicate campaign successfully', async () => {
      // Arrange
      const originalCampaign = {
        ...mockCampaign,
        template_name: mockTemplate.name,
        template_content: mockTemplate.content
      };

      const duplicatedCampaign = {
        ...mockCampaign,
        id: 'duplicated-campaign-id',
        name: `${mockCampaign.name} (Copy)`,
        status: 'draft',
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0
      };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [originalCampaign] }) // Get original
        .mockResolvedValueOnce({ rows: [mockContact] }) // Get contacts
        .mockResolvedValueOnce({ rows: [duplicatedCampaign] }); // Create duplicate

      // Act
      const result = await campaignService.duplicateCampaign(mockCampaign.id, mockCompany.id);

      // Assert
      expect(result.id).toBe('duplicated-campaign-id');
      expect(result.name).toBe(`${mockCampaign.name} (Copy)`);
      expect(result.status).toBe('draft');
      expect(result.sent_count).toBe(0);
      expect(result.delivered_count).toBe(0);
    });

    it('should handle campaign not found', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Act & Assert
      await expect(campaignService.duplicateCampaign('non-existent-id', mockCompany.id))
        .rejects.toThrow('Campaign not found');
    });
  });

  describe('getCampaignStats', () => {
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
        this_month: '5'
      };

      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [mockStats] });

      // Act
      const result = await campaignService.getCampaignStats(mockCompany.id);

      // Assert
      expect(result.total).toBe(25);
      expect(result.byStatus.draft).toBe(8);
      expect(result.byStatus.running).toBe(2);
      expect(result.totalMessagesSent).toBe(15000);
      expect(result.averageSuccessRate).toBe(96.5);
      expect(result.thisMonth).toBe(5);
    });

    it('should handle empty statistics', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await campaignService.getCampaignStats(mockCompany.id);

      // Assert
      expect(result.total).toBe(0);
      expect(result.byStatus.draft).toBe(0);
      expect(result.totalMessagesSent).toBe(0);
    });
  });

  describe('processScheduledCampaigns', () => {
    it('should process due scheduled campaigns', async () => {
      // Arrange
      const scheduledCampaigns = [
        { 
          ...mockCampaign, 
          status: 'scheduled',
          scheduled_at: new Date(Date.now() - 1000).toISOString() // Due now
        }
      ];

      const { mockRabbitMQ } = mockRabbitMQSuccess();

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: scheduledCampaigns }) // Get due campaigns
        .mockResolvedValueOnce({ rows: [mockContact] }) // Get contacts for each campaign
        .mockResolvedValueOnce({ rows: [{ ...mockCampaign, status: 'running' }] }); // Update status

      // Act
      const result = await campaignService.processScheduledCampaigns();

      // Assert
      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockRabbitMQ.publishToQueue).toHaveBeenCalledWith(
        'send_messages',
        expect.objectContaining({
          campaign_id: mockCampaign.id
        })
      );
    });

    it('should handle campaigns with no contacts gracefully', async () => {
      // Arrange
      const scheduledCampaigns = [
        { 
          ...mockCampaign, 
          status: 'scheduled',
          scheduled_at: new Date(Date.now() - 1000).toISOString()
        }
      ];

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: scheduledCampaigns })
        .mockResolvedValueOnce({ rows: [] }); // No contacts

      // Act
      const result = await campaignService.processScheduledCampaigns();

      // Assert
      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should continue processing other campaigns if one fails', async () => {
      // Arrange
      const scheduledCampaigns = [
        { 
          ...mockCampaign, 
          id: 'campaign1',
          status: 'scheduled',
          scheduled_at: new Date(Date.now() - 1000).toISOString()
        },
        { 
          ...mockCampaign, 
          id: 'campaign2',
          status: 'scheduled',
          scheduled_at: new Date(Date.now() - 1000).toISOString()
        }
      ];

      const { mockRabbitMQ } = mockRabbitMQSuccess();

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: scheduledCampaigns })
        .mockResolvedValueOnce({ rows: [] }) // No contacts for campaign1
        .mockResolvedValueOnce({ rows: [mockContact] }) // Contacts for campaign2
        .mockResolvedValueOnce({ rows: [{ ...mockCampaign, status: 'running' }] }); // Update campaign2

      // Act
      const result = await campaignService.processScheduledCampaigns();

      // Assert
      expect(result.processed).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('getCampaignPerformance', () => {
    it('should return campaign performance metrics', async () => {
      // Arrange
      const mockPerformance = {
        campaign_id: mockCampaign.id,
        campaign_name: mockCampaign.name,
        total_sent: '1000',
        delivered: '950',
        read: '780',
        failed: '50',
        success_rate: '95.0',
        delivery_rate: '95.0',
        read_rate: '82.1',
        avg_delivery_time: '45'
      };

      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [mockPerformance] });

      // Act
      const result = await campaignService.getCampaignPerformance(mockCampaign.id, mockCompany.id);

      // Assert
      expect(result.campaignId).toBe(mockCampaign.id);
      expect(result.campaignName).toBe(mockCampaign.name);
      expect(result.totalSent).toBe(1000);
      expect(result.delivered).toBe(950);
      expect(result.read).toBe(780);
      expect(result.failed).toBe(50);
      expect(result.successRate).toBe(95.0);
      expect(result.deliveryRate).toBe(95.0);
      expect(result.readRate).toBe(82.1);
      expect(result.avgDeliveryTime).toBe(45);
    });

    it('should handle campaign not found', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Act & Assert
      await expect(campaignService.getCampaignPerformance('non-existent-id', mockCompany.id))
        .rejects.toThrow('Campaign not found');
    });
  });
});