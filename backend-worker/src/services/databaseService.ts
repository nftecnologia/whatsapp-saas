import pool from '@/config/database';
import { MessageLog, WhatsAppIntegration, CampaignContact } from '@/types';

export class DatabaseService {
  static async updateMessageLog(
    messageLogId: string,
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed',
    updates: {
      whatsapp_message_id?: string;
      evolution_api_response?: Record<string, any>;
      error_message?: string;
      sent_at?: Date;
      delivered_at?: Date;
      read_at?: Date;
    } = {}
  ): Promise<MessageLog | null> {
    const fields = ['status = $2'];
    const values = [messageLogId, status];
    let paramIndex = 3;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (status === 'sent' && !updates.sent_at) {
      fields.push('sent_at = CURRENT_TIMESTAMP');
    } else if (status === 'delivered' && !updates.delivered_at) {
      fields.push('delivered_at = CURRENT_TIMESTAMP');
    } else if (status === 'read' && !updates.read_at) {
      fields.push('read_at = CURRENT_TIMESTAMP');
    }

    const result = await pool.query(
      `UPDATE message_logs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  static async createMessageLog(logData: {
    company_id: string;
    campaign_id?: string;
    contact_id?: string;
    phone: string;
    message_content: string;
    status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    whatsapp_message_id?: string;
    evolution_api_response?: Record<string, any>;
    error_message?: string;
  }): Promise<MessageLog> {
    const result = await pool.query(
      `INSERT INTO message_logs 
       (company_id, campaign_id, contact_id, phone, message_content, status, whatsapp_message_id, evolution_api_response, error_message) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        logData.company_id,
        logData.campaign_id,
        logData.contact_id,
        logData.phone,
        logData.message_content,
        logData.status || 'pending',
        logData.whatsapp_message_id,
        logData.evolution_api_response,
        logData.error_message
      ]
    );
    return result.rows[0];
  }

  static async findMessageLogByJobId(jobId: string): Promise<MessageLog | null> {
    const result = await pool.query(
      `SELECT * FROM message_logs 
       WHERE evolution_api_response->>'jobId' = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [jobId]
    );
    return result.rows[0] || null;
  }

  static async findMessageLogsByPhone(
    phone: string,
    companyId: string,
    limit: number = 10
  ): Promise<MessageLog[]> {
    const result = await pool.query(
      `SELECT * FROM message_logs 
       WHERE phone = $1 AND company_id = $2 
       ORDER BY created_at DESC 
       LIMIT $3`,
      [phone, companyId, limit]
    );
    return result.rows;
  }

  static async getWhatsAppIntegration(
    integrationId: string,
    companyId: string
  ): Promise<WhatsAppIntegration | null> {
    const result = await pool.query(
      'SELECT * FROM whatsapp_integrations WHERE id = $1 AND company_id = $2 AND is_active = true',
      [integrationId, companyId]
    );
    return result.rows[0] || null;
  }

  static async getActiveWhatsAppIntegration(
    companyId: string
  ): Promise<WhatsAppIntegration | null> {
    const result = await pool.query(
      `SELECT * FROM whatsapp_integrations 
       WHERE company_id = $1 AND is_active = true AND status = 'connected' 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [companyId]
    );
    return result.rows[0] || null;
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

  static async getCampaignInfo(campaignId: string): Promise<any> {
    const result = await pool.query(
      `SELECT c.*, co.name as company_name 
       FROM campaigns c 
       JOIN companies co ON c.company_id = co.id 
       WHERE c.id = $1`,
      [campaignId]
    );
    return result.rows[0] || null;
  }

  static async getContactInfo(contactId: string): Promise<any> {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE id = $1',
      [contactId]
    );
    return result.rows[0] || null;
  }

  static async logWorkerActivity(
    workerId: string,
    activity: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO worker_logs (worker_id, activity, data, created_at) 
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [workerId, activity, data]
      );
    } catch (error) {
      console.error('Error logging worker activity:', error);
    }
  }
}