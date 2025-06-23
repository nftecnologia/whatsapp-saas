import pool from '@/config/database';
import { MessageLog } from '@/types';

export class MessageLogModel {
  static async create(logData: {
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

  static async updateStatus(
    id: string,
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
    const values = [id, status];
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

  static async findById(id: string): Promise<MessageLog | null> {
    const result = await pool.query(
      'SELECT * FROM message_logs WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async findByCampaign(
    campaignId: string,
    filters: {
      status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    logs: MessageLog[];
    total: number;
  }> {
    let whereClause = 'WHERE campaign_id = $1';
    let params: any[] = [campaignId];
    let paramIndex = 2;

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [logsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT ml.*, c.name as contact_name 
         FROM message_logs ml 
         LEFT JOIN contacts c ON ml.contact_id = c.id 
         ${whereClause} 
         ORDER BY ml.created_at DESC 
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM message_logs ${whereClause}`, params)
    ]);

    return {
      logs: logsResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  static async findByCompany(
    companyId: string,
    filters: {
      campaign_id?: string;
      status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
      phone?: string;
      start_date?: Date;
      end_date?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    logs: MessageLog[];
    total: number;
  }> {
    let whereClause = 'WHERE ml.company_id = $1';
    let params: any[] = [companyId];
    let paramIndex = 2;

    if (filters.campaign_id) {
      whereClause += ` AND ml.campaign_id = $${paramIndex}`;
      params.push(filters.campaign_id);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND ml.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.phone) {
      whereClause += ` AND ml.phone ILIKE $${paramIndex}`;
      params.push(`%${filters.phone}%`);
      paramIndex++;
    }

    if (filters.start_date) {
      whereClause += ` AND ml.created_at >= $${paramIndex}`;
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      whereClause += ` AND ml.created_at <= $${paramIndex}`;
      params.push(filters.end_date);
      paramIndex++;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [logsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT ml.*, c.name as contact_name, camp.name as campaign_name 
         FROM message_logs ml 
         LEFT JOIN contacts c ON ml.contact_id = c.id 
         LEFT JOIN campaigns camp ON ml.campaign_id = camp.id 
         ${whereClause} 
         ORDER BY ml.created_at DESC 
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM message_logs ml ${whereClause}`, params)
    ]);

    return {
      logs: logsResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  static async getStats(
    companyId: string,
    filters: {
      campaign_id?: string;
      start_date?: Date;
      end_date?: Date;
    } = {}
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    successRate: number;
    deliveryRate: number;
    readRate: number;
  }> {
    let whereClause = 'WHERE company_id = $1';
    let params: any[] = [companyId];
    let paramIndex = 2;

    if (filters.campaign_id) {
      whereClause += ` AND campaign_id = $${paramIndex}`;
      params.push(filters.campaign_id);
      paramIndex++;
    }

    if (filters.start_date) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(filters.end_date);
      paramIndex++;
    }

    const result = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'read') as read,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM message_logs 
       ${whereClause}`,
      params
    );

    const stats = result.rows[0];
    const total = parseInt(stats.total);
    const sent = parseInt(stats.sent);
    const delivered = parseInt(stats.delivered);
    const read = parseInt(stats.read);

    const byStatus = {
      pending: parseInt(stats.pending),
      sent,
      delivered,
      read,
      failed: parseInt(stats.failed)
    };

    const successRate = total > 0 ? ((sent + delivered + read) / total) * 100 : 0;
    const deliveryRate = sent > 0 ? ((delivered + read) / (sent + delivered + read)) * 100 : 0;
    const readRate = delivered > 0 ? (read / (delivered + read)) * 100 : 0;

    return {
      total,
      byStatus,
      successRate: Math.round(successRate * 100) / 100,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      readRate: Math.round(readRate * 100) / 100
    };
  }
}