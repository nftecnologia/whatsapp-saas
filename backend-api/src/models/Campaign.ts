import pool from '@/config/database';
import { Campaign, CampaignContact } from '@/types';

export class CampaignModel {
  static async findById(id: string, companyId: string): Promise<Campaign | null> {
    const result = await pool.query(
      'SELECT * FROM campaigns WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    return result.rows[0] || null;
  }

  static async findByName(name: string, companyId: string): Promise<Campaign | null> {
    const result = await pool.query(
      'SELECT * FROM campaigns WHERE name = $1 AND company_id = $2',
      [name, companyId]
    );
    return result.rows[0] || null;
  }

  static async findAll(
    companyId: string,
    filters: {
      search?: string;
      status?: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'cancelled';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    campaigns: Campaign[];
    total: number;
  }> {
    let whereClause = 'WHERE company_id = $1';
    let params: any[] = [companyId];
    let paramIndex = 2;

    if (filters.search) {
      whereClause += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [campaignsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT c.*, t.name as template_name 
         FROM campaigns c 
         LEFT JOIN templates t ON c.template_id = t.id 
         ${whereClause} 
         ORDER BY c.created_at DESC 
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM campaigns ${whereClause}`, params)
    ]);

    return {
      campaigns: campaignsResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  static async create(campaignData: {
    company_id: string;
    name: string;
    template_id: string;
    scheduled_at?: Date;
    variables?: Record<string, string>;
  }): Promise<Campaign> {
    const result = await pool.query(
      `INSERT INTO campaigns (company_id, name, template_id, scheduled_at, variables) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [
        campaignData.company_id,
        campaignData.name,
        campaignData.template_id,
        campaignData.scheduled_at,
        campaignData.variables || {}
      ]
    );
    return result.rows[0];
  }

  static async update(id: string, companyId: string, updates: Partial<Campaign>): Promise<Campaign | null> {
    const fields = Object.keys(updates).filter(key => !['id', 'company_id', 'created_at'].includes(key));
    const values = fields.map(key => updates[key as keyof Campaign]);
    const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');

    if (fields.length === 0) {
      return this.findById(id, companyId);
    }

    const result = await pool.query(
      `UPDATE campaigns SET ${setClause} WHERE id = $1 AND company_id = $2 RETURNING *`,
      [id, companyId, ...values]
    );
    return result.rows[0] || null;
  }

  static async delete(id: string, companyId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM campaigns WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    return (result.rowCount || 0) > 0;
  }

  static async addContacts(campaignId: string, contactIds: string[]): Promise<CampaignContact[]> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results: CampaignContact[] = [];
      
      for (const contactId of contactIds) {
        const result = await client.query(
          `INSERT INTO campaign_contacts (campaign_id, contact_id) 
           VALUES ($1, $2) 
           ON CONFLICT (campaign_id, contact_id) DO NOTHING
           RETURNING *`,
          [campaignId, contactId]
        );
        if (result.rows.length > 0) {
          results.push(result.rows[0]);
        }
      }

      await client.query(
        `UPDATE campaigns 
         SET total_contacts = (
           SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1
         ) 
         WHERE id = $1`,
        [campaignId]
      );
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async removeContact(campaignId: string, contactId: string): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        'DELETE FROM campaign_contacts WHERE campaign_id = $1 AND contact_id = $2',
        [campaignId, contactId]
      );

      await client.query(
        `UPDATE campaigns 
         SET total_contacts = (
           SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1
         ) 
         WHERE id = $1`,
        [campaignId]
      );
      
      await client.query('COMMIT');
      return (result.rowCount || 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getCampaignContacts(
    campaignId: string,
    filters: {
      status?: 'pending' | 'sent' | 'delivered' | 'failed';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    contacts: any[];
    total: number;
  }> {
    let whereClause = 'WHERE cc.campaign_id = $1';
    let params: any[] = [campaignId];
    let paramIndex = 2;

    if (filters.status) {
      whereClause += ` AND cc.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [contactsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT cc.*, c.name, c.phone, c.email 
         FROM campaign_contacts cc 
         JOIN contacts c ON cc.contact_id = c.id 
         ${whereClause} 
         ORDER BY cc.created_at DESC 
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM campaign_contacts cc ${whereClause}`, params)
    ]);

    return {
      contacts: contactsResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  static async updateCampaignContactStatus(
    campaignId: string,
    contactId: string,
    status: 'pending' | 'sent' | 'delivered' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const updateFields = ['status = $3'];
    const params = [campaignId, contactId, status];
    
    if (status === 'sent') {
      updateFields.push('sent_at = CURRENT_TIMESTAMP');
    } else if (status === 'delivered') {
      updateFields.push('delivered_at = CURRENT_TIMESTAMP');
    }
    
    if (errorMessage) {
      updateFields.push(`error_message = $${params.length + 1}`);
      params.push(errorMessage);
    }

    await pool.query(
      `UPDATE campaign_contacts 
       SET ${updateFields.join(', ')} 
       WHERE campaign_id = $1 AND contact_id = $2`,
      params
    );

    await this.updateCampaignStats(campaignId);
  }

  static async updateCampaignStats(campaignId: string): Promise<void> {
    await pool.query(
      `UPDATE campaigns SET 
        sent_count = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status IN ('sent', 'delivered')),
        delivered_count = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status = 'delivered'),
        failed_count = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status = 'failed')
       WHERE id = $1`,
      [campaignId]
    );
  }

  static async getStats(companyId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalMessages: number;
    successRate: number;
  }> {
    const [campaignResult, messageResult] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*) as count 
         FROM campaigns 
         WHERE company_id = $1 
         GROUP BY status`,
        [companyId]
      ),
      pool.query(
        `SELECT 
          SUM(sent_count) as total_sent,
          SUM(delivered_count) as total_delivered
         FROM campaigns 
         WHERE company_id = $1`,
        [companyId]
      )
    ]);

    const byStatus: Record<string, number> = {};
    let total = 0;

    campaignResult.rows.forEach(row => {
      const count = parseInt(row.count);
      byStatus[row.status] = count;
      total += count;
    });

    const totalSent = parseInt(messageResult.rows[0]?.total_sent || '0');
    const totalDelivered = parseInt(messageResult.rows[0]?.total_delivered || '0');
    const successRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

    return {
      total,
      byStatus,
      totalMessages: totalSent,
      successRate: Math.round(successRate * 100) / 100
    };
  }
}