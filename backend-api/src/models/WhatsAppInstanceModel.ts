import pool from '@/config/database';
import crypto from 'crypto';
import logger from '@/utils/logger';

export interface WhatsAppInstance {
  id: string;
  company_id: string;
  instance_name: string;
  integration_type: 'WHATSAPP-BUSINESS';
  meta_access_token: string; // Encrypted
  meta_phone_number_id: string;
  meta_business_id: string;
  status: 'connected' | 'disconnected' | 'error';
  created_at: Date;
  updated_at: Date;
}

export interface WhatsAppInstanceResponse extends Omit<WhatsAppInstance, 'meta_access_token'> {
  meta_access_token: string; // Masked for API responses
}

export interface CreateWhatsAppInstanceInput {
  company_id: string;
  instance_name: string;
  integration_type: 'WHATSAPP-BUSINESS';
  meta_access_token: string;
  meta_phone_number_id: string;
  meta_business_id: string;
  status?: 'connected' | 'disconnected' | 'error';
}

export interface UpdateWhatsAppInstanceInput {
  instance_name?: string;
  meta_access_token?: string;
  meta_phone_number_id?: string;
  meta_business_id?: string;
  status?: 'connected' | 'disconnected' | 'error';
}

export class WhatsAppInstanceModel {
  private static readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-prod';
  private static readonly ALGORITHM = 'aes-256-gcm';

  /**
   * Encrypt sensitive data (access tokens)
   */
  private static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.ALGORITHM, this.ENCRYPTION_KEY);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Error encrypting token:', error);
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt sensitive data (access tokens)
   */
  private static decrypt(encryptedText: string): string {
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      const decipher = crypto.createDecipher(this.ALGORITHM, this.ENCRYPTION_KEY);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting token:', error);
      throw new Error('Failed to decrypt token');
    }
  }

  /**
   * Mask access token for API responses
   */
  private static maskToken(token: string): string {
    if (!token || token.length < 8) return '****';
    return token.substring(0, 4) + '****' + token.substring(token.length - 4);
  }

  /**
   * Convert database row to API response format
   */
  private static toResponse(instance: WhatsAppInstance): WhatsAppInstanceResponse {
    return {
      ...instance,
      meta_access_token: this.maskToken(instance.meta_access_token)
    };
  }

  /**
   * Find WhatsApp instance by ID
   */
  static async findById(id: string, companyId: string): Promise<WhatsAppInstance | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM whatsapp_instances WHERE id = $1 AND company_id = $2',
        [id, companyId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const instance = result.rows[0];
      // Decrypt the access token
      instance.meta_access_token = this.decrypt(instance.meta_access_token);
      
      return instance;
    } catch (error) {
      logger.error('Error finding WhatsApp instance by ID:', { id, companyId, error });
      throw error;
    }
  }

  /**
   * Find WhatsApp instance by phone number ID
   */
  static async findByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppInstance | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM whatsapp_instances WHERE meta_phone_number_id = $1',
        [phoneNumberId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const instance = result.rows[0];
      // Decrypt the access token
      instance.meta_access_token = this.decrypt(instance.meta_access_token);
      
      return instance;
    } catch (error) {
      logger.error('Error finding WhatsApp instance by phone number ID:', { phoneNumberId, error });
      throw error;
    }
  }

  /**
   * Find all WhatsApp instances for a company
   */
  static async findByCompanyId(
    companyId: string,
    filters: {
      status?: 'connected' | 'disconnected' | 'error';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    instances: WhatsAppInstanceResponse[];
    total: number;
  }> {
    try {
      let whereClause = 'WHERE company_id = $1';
      let params: any[] = [companyId];
      let paramIndex = 2;

      if (filters.status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const [instancesResult, countResult] = await Promise.all([
        pool.query(
          `SELECT * FROM whatsapp_instances ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          [...params, limit, offset]
        ),
        pool.query(`SELECT COUNT(*) FROM whatsapp_instances ${whereClause}`, params)
      ]);

      const instances = instancesResult.rows.map(row => {
        // Decrypt for internal processing, but return masked version
        const decryptedToken = this.decrypt(row.meta_access_token);
        return this.toResponse({
          ...row,
          meta_access_token: decryptedToken
        });
      });

      return {
        instances,
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      logger.error('Error finding WhatsApp instances by company ID:', { companyId, filters, error });
      throw error;
    }
  }

  /**
   * Create new WhatsApp instance
   */
  static async create(data: CreateWhatsAppInstanceInput): Promise<WhatsAppInstance> {
    try {
      // Check if instance name already exists for this company
      const existingInstance = await pool.query(
        'SELECT id FROM whatsapp_instances WHERE company_id = $1 AND instance_name = $2',
        [data.company_id, data.instance_name]
      );

      if (existingInstance.rows.length > 0) {
        throw new Error('Instance name already exists for this company');
      }

      // Check if phone number ID is already in use
      const existingPhoneNumber = await pool.query(
        'SELECT id FROM whatsapp_instances WHERE meta_phone_number_id = $1',
        [data.meta_phone_number_id]
      );

      if (existingPhoneNumber.rows.length > 0) {
        throw new Error('Phone number ID is already in use');
      }

      // Encrypt the access token
      const encryptedToken = this.encrypt(data.meta_access_token);

      const result = await pool.query(
        `INSERT INTO whatsapp_instances 
         (company_id, instance_name, integration_type, meta_access_token, meta_phone_number_id, meta_business_id, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [
          data.company_id,
          data.instance_name,
          data.integration_type,
          encryptedToken,
          data.meta_phone_number_id,
          data.meta_business_id,
          data.status || 'disconnected'
        ]
      );

      const instance = result.rows[0];
      // Return with decrypted token for internal use
      instance.meta_access_token = data.meta_access_token;
      
      logger.info('WhatsApp instance created successfully', {
        instanceId: instance.id,
        companyId: data.company_id,
        instanceName: data.instance_name
      });

      return instance;
    } catch (error) {
      logger.error('Error creating WhatsApp instance:', { data, error });
      throw error;
    }
  }

  /**
   * Update WhatsApp instance
   */
  static async update(
    id: string,
    companyId: string,
    updates: UpdateWhatsAppInstanceInput
  ): Promise<WhatsAppInstance | null> {
    try {
      // Check if instance exists
      const existingInstance = await this.findById(id, companyId);
      if (!existingInstance) {
        return null;
      }

      // Check for conflicts
      if (updates.instance_name) {
        const nameConflict = await pool.query(
          'SELECT id FROM whatsapp_instances WHERE company_id = $1 AND instance_name = $2 AND id != $3',
          [companyId, updates.instance_name, id]
        );

        if (nameConflict.rows.length > 0) {
          throw new Error('Instance name already exists for this company');
        }
      }

      if (updates.meta_phone_number_id) {
        const phoneConflict = await pool.query(
          'SELECT id FROM whatsapp_instances WHERE meta_phone_number_id = $1 AND id != $2',
          [updates.meta_phone_number_id, id]
        );

        if (phoneConflict.rows.length > 0) {
          throw new Error('Phone number ID is already in use');
        }
      }

      // Build update query
      const updateData = { ...updates };
      if (updateData.meta_access_token) {
        updateData.meta_access_token = this.encrypt(updateData.meta_access_token);
      }

      const fields = Object.keys(updateData);
      const values = fields.map(key => updateData[key as keyof UpdateWhatsAppInstanceInput]);
      const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');

      if (fields.length === 0) {
        return existingInstance;
      }

      const result = await pool.query(
        `UPDATE whatsapp_instances SET ${setClause} WHERE id = $1 AND company_id = $2 RETURNING *`,
        [id, companyId, ...values]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const instance = result.rows[0];
      // Decrypt the access token for return
      instance.meta_access_token = this.decrypt(instance.meta_access_token);

      logger.info('WhatsApp instance updated successfully', {
        instanceId: id,
        companyId,
        updatedFields: fields
      });

      return instance;
    } catch (error) {
      logger.error('Error updating WhatsApp instance:', { id, companyId, updates, error });
      throw error;
    }
  }

  /**
   * Delete WhatsApp instance
   */
  static async delete(id: string, companyId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'DELETE FROM whatsapp_instances WHERE id = $1 AND company_id = $2',
        [id, companyId]
      );

      const deleted = (result.rowCount || 0) > 0;

      if (deleted) {
        logger.info('WhatsApp instance deleted successfully', {
          instanceId: id,
          companyId
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting WhatsApp instance:', { id, companyId, error });
      throw error;
    }
  }

  /**
   * Update instance status
   */
  static async updateStatus(
    id: string,
    companyId: string,
    status: 'connected' | 'disconnected' | 'error'
  ): Promise<boolean> {
    try {
      const result = await pool.query(
        'UPDATE whatsapp_instances SET status = $1 WHERE id = $2 AND company_id = $3',
        [status, id, companyId]
      );

      const updated = (result.rowCount || 0) > 0;

      if (updated) {
        logger.info('WhatsApp instance status updated', {
          instanceId: id,
          companyId,
          status
        });
      }

      return updated;
    } catch (error) {
      logger.error('Error updating WhatsApp instance status:', { id, companyId, status, error });
      throw error;
    }
  }

  /**
   * Get statistics for company's WhatsApp instances
   */
  static async getStats(companyId: string): Promise<{
    total: number;
    connected: number;
    disconnected: number;
    error: number;
  }> {
    try {
      const result = await pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'connected') as connected,
          COUNT(*) FILTER (WHERE status = 'disconnected') as disconnected,
          COUNT(*) FILTER (WHERE status = 'error') as error
         FROM whatsapp_instances 
         WHERE company_id = $1`,
        [companyId]
      );

      return {
        total: parseInt(result.rows[0].total),
        connected: parseInt(result.rows[0].connected),
        disconnected: parseInt(result.rows[0].disconnected),
        error: parseInt(result.rows[0].error)
      };
    } catch (error) {
      logger.error('Error getting WhatsApp instance stats:', { companyId, error });
      throw error;
    }
  }
}