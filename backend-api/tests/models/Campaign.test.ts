import { CampaignModel } from '@/models/Campaign';
import { mockUser, mockCompany, mockCampaign, mockTemplate, mockContact, mockDbQuery, mockDbError } from '../setup';

describe('CampaignModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find campaign by ID with template details', async () => {
      // Arrange
      const campaignWithTemplate = {
        ...mockCampaign,
        template_name: mockTemplate.name,
        template_content: mockTemplate.content,
        template_category: mockTemplate.category
      };

      mockDbQuery(campaignWithTemplate);

      // Act
      const result = await CampaignModel.findById(mockCampaign.id);

      // Assert
      expect(result).toEqual(campaignWithTemplate);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN templates'),
        [mockCampaign.id]
      );
    });

    it('should return null for non-existent campaign', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await CampaignModel.findById('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      mockDbError(new Error('Database connection failed'));

      // Act & Assert
      await expect(CampaignModel.findById(mockCampaign.id))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('findAll', () => {
    it('should find campaigns with pagination and filters', async () => {
      // Arrange
      const mockCampaigns = [
        mockCampaign,
        { ...mockCampaign, id: 'campaign2', name: 'Campaign 2', status: 'running' }
      ];

      const filters = {
        limit: 10,
        offset: 0,
        search: 'Test',
        status: 'draft' as const
      };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: mockCampaigns }) // Campaigns query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // Count query

      // Act
      const result = await CampaignModel.findAll(mockCompany.id, filters);

      // Assert
      expect(result.campaigns).toEqual(mockCampaigns);
      expect(result.total).toBe(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE c.company_id = $1'),
        expect.arrayContaining([mockCompany.id, '%Test%', 'draft'])
      );
    });

    it('should handle empty filters', async () => {
      // Arrange
      const mockCampaigns = [mockCampaign];
      const filters = { limit: 50, offset: 0 };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: mockCampaigns })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      // Act
      const result = await CampaignModel.findAll(mockCompany.id, filters);

      // Assert
      expect(result.campaigns).toEqual(mockCampaigns);
      expect(result.total).toBe(1);
    });

    it('should order campaigns by created_at DESC', async () => {
      // Arrange
      const filters = { limit: 10, offset: 0 };
      mockDbQuery(mockCampaign);

      // Act
      await CampaignModel.findAll(mockCompany.id, filters);

      // Assert
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY c.created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('create', () => {
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
        id: 'new-campaign-id',
        company_id: mockCompany.id,
        status: 'draft' as const,
        total_contacts: 1,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        ...campaignData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [createdCampaign] }) // Campaign creation
        .mockResolvedValueOnce({ rows: [] }); // Campaign contacts insertion

      // Act
      const result = await CampaignModel.create(campaignData, mockCompany.id);

      // Assert
      expect(result).toEqual(createdCampaign);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO campaigns'),
        expect.arrayContaining([
          campaignData.name,
          campaignData.template_id,
          mockCompany.id,
          JSON.stringify(campaignData.variables)
        ])
      );

      // Verify campaign_contacts insertion
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO campaign_contacts'),
        expect.any(Array)
      );
    });

    it('should handle scheduled campaigns', async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const campaignData = {
        name: 'Scheduled Campaign',
        template_id: mockTemplate.id,
        contact_ids: [mockContact.id],
        variables: {},
        scheduled_at: futureDate
      };

      const scheduledCampaign = {
        ...mockCampaign,
        ...campaignData,
        status: 'scheduled' as const,
        scheduled_at: futureDate
      };

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [scheduledCampaign] })
        .mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await CampaignModel.create(campaignData, mockCompany.id);

      // Assert
      expect(result.status).toBe('scheduled');
      expect(result.scheduled_at).toBe(futureDate);
    });

    it('should validate campaign name uniqueness within company', async () => {
      // Arrange
      const campaignData = {
        name: mockCampaign.name, // Duplicate name
        template_id: mockTemplate.id,
        contact_ids: [mockContact.id],
        variables: {}
      };

      const duplicateError = new Error('duplicate key value violates unique constraint');
      duplicateError.name = 'PostgresError';
      (duplicateError as any).code = '23505';
      
      mockDbError(duplicateError);

      // Act & Assert
      await expect(CampaignModel.create(campaignData, mockCompany.id))
        .rejects.toThrow('Campaign name already exists');
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidData = {
        template_id: mockTemplate.id,
        contact_ids: [mockContact.id]
        // Missing name
      } as any;

      // Act & Assert
      await expect(CampaignModel.create(invalidData, mockCompany.id))
        .rejects.toThrow('Campaign name is required');
    });
  });

  describe('update', () => {
    it('should update campaign with valid data', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Campaign Name',
        variables: { product: 'Updated Product' },
        scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      const updatedCampaign = {
        ...mockCampaign,
        ...updateData,
        updated_at: new Date().toISOString()
      };

      mockDbQuery(updatedCampaign);

      // Act
      const result = await CampaignModel.update(mockCampaign.id, updateData, mockCompany.id);

      // Assert
      expect(result).toEqual(updatedCampaign);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE campaigns SET'),
        expect.arrayContaining([
          updateData.name,
          JSON.stringify(updateData.variables),
          updateData.scheduled_at,
          mockCampaign.id,
          mockCompany.id
        ])
      );
    });

    it('should prevent updating running campaigns', async () => {
      // Arrange
      const runningCampaign = { ...mockCampaign, status: 'running' };
      mockDbQuery(runningCampaign);

      const updateData = { name: 'Updated Name' };

      // Act & Assert
      await expect(CampaignModel.update(mockCampaign.id, updateData, mockCompany.id))
        .rejects.toThrow('Cannot update running or completed campaigns');
    });

    it('should prevent updating completed campaigns', async () => {
      // Arrange
      const completedCampaign = { ...mockCampaign, status: 'completed' };
      mockDbQuery(completedCampaign);

      const updateData = { name: 'Updated Name' };

      // Act & Assert
      await expect(CampaignModel.update(mockCampaign.id, updateData, mockCompany.id))
        .rejects.toThrow('Cannot update running or completed campaigns');
    });

    it('should return null for non-existent campaign', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await CampaignModel.update('non-existent-id', { name: 'Test' }, mockCompany.id);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete draft campaign successfully', async () => {
      // Arrange
      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockCampaign] }) // Check campaign exists and is draft
        .mockResolvedValueOnce({ rows: [] }) // Delete campaign_contacts
        .mockResolvedValueOnce({ rows: [{ id: mockCampaign.id }] }); // Delete campaign

      // Act
      const result = await CampaignModel.delete(mockCampaign.id, mockCompany.id);

      // Assert
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM campaign_contacts'),
        [mockCampaign.id]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM campaigns'),
        [mockCampaign.id, mockCompany.id]
      );
    });

    it('should prevent deletion of running campaigns', async () => {
      // Arrange
      const runningCampaign = { ...mockCampaign, status: 'running' };
      mockDbQuery(runningCampaign);

      // Act & Assert
      await expect(CampaignModel.delete(mockCampaign.id, mockCompany.id))
        .rejects.toThrow('Cannot delete running or completed campaigns');
    });

    it('should return false for non-existent campaign', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await CampaignModel.delete('non-existent-id', mockCompany.id);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('should update campaign status', async () => {
      // Arrange
      const newStatus = 'running';
      const updatedCampaign = {
        ...mockCampaign,
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      mockDbQuery(updatedCampaign);

      // Act
      const result = await CampaignModel.updateStatus(mockCampaign.id, newStatus, mockCompany.id);

      // Assert
      expect(result).toEqual(updatedCampaign);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE campaigns SET status = $1'),
        [newStatus, mockCampaign.id, mockCompany.id]
      );
    });

    it('should validate status values', async () => {
      // Act & Assert
      await expect(CampaignModel.updateStatus(mockCampaign.id, 'invalid_status' as any, mockCompany.id))
        .rejects.toThrow('Invalid campaign status');
    });
  });

  describe('updateCounts', () => {
    it('should update campaign message counts', async () => {
      // Arrange
      const counts = {
        sent_count: 100,
        delivered_count: 95,
        read_count: 80,
        failed_count: 5
      };

      const updatedCampaign = {
        ...mockCampaign,
        ...counts,
        updated_at: new Date().toISOString()
      };

      mockDbQuery(updatedCampaign);

      // Act
      const result = await CampaignModel.updateCounts(mockCampaign.id, counts, mockCompany.id);

      // Assert
      expect(result).toEqual(updatedCampaign);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE campaigns SET'),
        expect.arrayContaining([
          counts.sent_count,
          counts.delivered_count,
          counts.read_count,
          counts.failed_count,
          mockCampaign.id,
          mockCompany.id
        ])
      );
    });

    it('should validate count values are non-negative', async () => {
      // Arrange
      const invalidCounts = {
        sent_count: -1,
        delivered_count: 95
      };

      // Act & Assert
      await expect(CampaignModel.updateCounts(mockCampaign.id, invalidCounts, mockCompany.id))
        .rejects.toThrow('Counts cannot be negative');
    });
  });

  describe('getCampaignContacts', () => {
    it('should get all contacts for a campaign', async () => {
      // Arrange
      const mockContacts = [
        mockContact,
        { ...mockContact, id: 'contact2', name: 'Contact 2' }
      ];

      mockDbQuery(mockContacts);

      // Act
      const result = await CampaignModel.getCampaignContacts(mockCampaign.id);

      // Assert
      expect(result).toEqual(mockContacts);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN campaign_contacts'),
        [mockCampaign.id]
      );
    });

    it('should return empty array for campaign with no contacts', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await CampaignModel.getCampaignContacts('empty-campaign-id');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getScheduledCampaigns', () => {
    it('should find campaigns scheduled for execution', async () => {
      // Arrange
      const now = new Date();
      const scheduledCampaigns = [
        {
          ...mockCampaign,
          status: 'scheduled',
          scheduled_at: new Date(now.getTime() - 1000).toISOString() // Due 1 second ago
        }
      ];

      mockDbQuery(scheduledCampaigns);

      // Act
      const result = await CampaignModel.getScheduledCampaigns();

      // Assert
      expect(result).toEqual(scheduledCampaigns);
      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1 AND scheduled_at <= $2'),
        ['scheduled', expect.any(String)]
      );
    });

    it('should return empty array when no campaigns are due', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await CampaignModel.getScheduledCampaigns();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return campaign statistics for company', async () => {
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

      mockDbQuery([mockStats]);

      // Act
      const result = await CampaignModel.getStats(mockCompany.id);

      // Assert
      expect(result.total).toBe(25);
      expect(result.byStatus.draft).toBe(8);
      expect(result.byStatus.running).toBe(2);
      expect(result.totalMessagesSent).toBe(15000);
      expect(result.averageSuccessRate).toBe(96.5);
      expect(result.thisMonth).toBe(5);

      const mockPool = require('@/config/database');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [mockCompany.id]
      );
    });

    it('should handle company with no campaigns', async () => {
      // Arrange
      mockDbQuery([]);

      // Act
      const result = await CampaignModel.getStats('empty-company-id');

      // Assert
      expect(result.total).toBe(0);
      expect(result.byStatus.draft).toBe(0);
      expect(result.totalMessagesSent).toBe(0);
    });
  });

  describe('duplicate', () => {
    it('should duplicate campaign with new name', async () => {
      // Arrange
      const originalCampaign = {
        ...mockCampaign,
        template_name: mockTemplate.name,
        template_content: mockTemplate.content
      };

      const duplicatedCampaign = {
        ...originalCampaign,
        id: 'duplicated-campaign-id',
        name: `${mockCampaign.name} (Copy)`,
        status: 'draft' as const,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const mockContacts = [mockContact];

      const mockPool = require('@/config/database');
      mockPool.query
        .mockResolvedValueOnce({ rows: [originalCampaign] }) // Get original campaign
        .mockResolvedValueOnce({ rows: mockContacts }) // Get campaign contacts
        .mockResolvedValueOnce({ rows: [duplicatedCampaign] }) // Create duplicate
        .mockResolvedValueOnce({ rows: [] }); // Insert contacts

      // Act
      const result = await CampaignModel.duplicate(mockCampaign.id, mockCompany.id);

      // Assert
      expect(result).toEqual(duplicatedCampaign);
      expect(result.name).toBe(`${mockCampaign.name} (Copy)`);
      expect(result.status).toBe('draft');
      expect(result.sent_count).toBe(0);
    });

    it('should handle original campaign not found', async () => {
      // Arrange
      mockDbQuery([]);

      // Act & Assert
      await expect(CampaignModel.duplicate('non-existent-id', mockCompany.id))
        .rejects.toThrow('Campaign not found');
    });
  });
});