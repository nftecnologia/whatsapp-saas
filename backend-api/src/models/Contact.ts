import pool from '@/config/database';
import { Contact } from '@/types';

export class ContactModel {
  static async findById(id: string, companyId: string): Promise<Contact | null> {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE id = $1 AND company_id = $2 AND is_active = true',
      [id, companyId]
    );
    return result.rows[0] || null;
  }

  static async findByPhone(phone: string, companyId: string): Promise<Contact | null> {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE phone = $1 AND company_id = $2 AND is_active = true',
      [phone, companyId]
    );
    return result.rows[0] || null;
  }

  static async findAll(
    companyId: string,
    filters: {
      search?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    contacts: Contact[];
    total: number;
  }> {
    let whereClause = 'WHERE company_id = $1 AND is_active = true';
    let params: any[] = [companyId];
    let paramIndex = 2;

    if (filters.search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.tags && filters.tags.length > 0) {
      whereClause += ` AND tags @> $${paramIndex}`;
      params.push(filters.tags);
      paramIndex++;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [contactsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM contacts ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM contacts ${whereClause}`, params)
    ]);

    return {
      contacts: contactsResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  static async create(contactData: {
    company_id: string;
    name: string;
    phone: string;
    email?: string;
    tags?: string[];
    custom_fields?: Record<string, any>;
  }): Promise<Contact> {
    const result = await pool.query(
      `INSERT INTO contacts (company_id, name, phone, email, tags, custom_fields) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        contactData.company_id,
        contactData.name,
        contactData.phone,
        contactData.email,
        contactData.tags || [],
        contactData.custom_fields || {}
      ]
    );
    return result.rows[0];
  }

  static async update(id: string, companyId: string, updates: Partial<Contact>): Promise<Contact | null> {
    const fields = Object.keys(updates).filter(key => !['id', 'company_id', 'created_at'].includes(key));
    const values = fields.map(key => updates[key as keyof Contact]);
    const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');

    if (fields.length === 0) {
      return this.findById(id, companyId);
    }

    const result = await pool.query(
      `UPDATE contacts SET ${setClause} WHERE id = $1 AND company_id = $2 RETURNING *`,
      [id, companyId, ...values]
    );
    return result.rows[0] || null;
  }

  static async delete(id: string, companyId: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE contacts SET is_active = false WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    return result.rowCount > 0;
  }

  static async bulkCreate(
    companyId: string,
    contacts: Array<{
      name: string;
      phone: string;
      email?: string;
      tags?: string[];
      custom_fields?: Record<string, any>;
    }>
  ): Promise<Contact[]> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results: Contact[] = [];
      
      for (const contact of contacts) {
        try {
          const result = await client.query(
            `INSERT INTO contacts (company_id, name, phone, email, tags, custom_fields) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             ON CONFLICT (company_id, phone) DO UPDATE SET 
               name = EXCLUDED.name,
               email = EXCLUDED.email,
               tags = EXCLUDED.tags,
               custom_fields = EXCLUDED.custom_fields,
               is_active = true
             RETURNING *`,
            [
              companyId,
              contact.name,
              contact.phone,
              contact.email,
              contact.tags || [],
              contact.custom_fields || {}
            ]
          );
          results.push(result.rows[0]);
        } catch (error) {
          console.error(`Error inserting contact ${contact.phone}:`, error);
        }
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getTags(companyId: string): Promise<string[]> {
    const result = await pool.query(
      `SELECT DISTINCT unnest(tags) as tag 
       FROM contacts 
       WHERE company_id = $1 AND is_active = true AND tags IS NOT NULL 
       ORDER BY tag`,
      [companyId]
    );
    return result.rows.map(row => row.tag);
  }

  static async getStats(companyId: string): Promise<{
    total: number;
    active: number;
    withEmail: number;
    byTags: Record<string, number>;
  }> {
    const [totalResult, tagsResult] = await Promise.all([
      pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '' AND is_active = true) as with_email
         FROM contacts 
         WHERE company_id = $1`,
        [companyId]
      ),
      pool.query(
        `SELECT unnest(tags) as tag, COUNT(*) as count 
         FROM contacts 
         WHERE company_id = $1 AND is_active = true AND tags IS NOT NULL 
         GROUP BY tag 
         ORDER BY count DESC`,
        [companyId]
      )
    ]);

    const byTags: Record<string, number> = {};
    tagsResult.rows.forEach(row => {
      byTags[row.tag] = parseInt(row.count);
    });

    return {
      total: parseInt(totalResult.rows[0].total),
      active: parseInt(totalResult.rows[0].active),
      withEmail: parseInt(totalResult.rows[0].with_email),
      byTags
    };
  }
}