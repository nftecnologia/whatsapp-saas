import pool from '@/config/database';
import { Company } from '@/types';

export class CompanyModel {
  static async findById(id: string): Promise<Company | null> {
    const result = await pool.query(
      'SELECT * FROM companies WHERE id = $1 AND is_active = true',
      [id]
    );
    return result.rows[0] || null;
  }

  static async findByEmail(email: string): Promise<Company | null> {
    const result = await pool.query(
      'SELECT * FROM companies WHERE email = $1 AND is_active = true',
      [email]
    );
    return result.rows[0] || null;
  }

  static async findAll(limit: number = 50, offset: number = 0): Promise<{
    companies: Company[];
    total: number;
  }> {
    const [companiesResult, countResult] = await Promise.all([
      pool.query(
        'SELECT * FROM companies WHERE is_active = true ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
      pool.query('SELECT COUNT(*) FROM companies WHERE is_active = true')
    ]);

    return {
      companies: companiesResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  static async create(companyData: {
    name: string;
    email: string;
    phone?: string;
    plan?: 'free' | 'basic' | 'premium' | 'enterprise';
  }): Promise<Company> {
    const result = await pool.query(
      `INSERT INTO companies (name, email, phone, plan) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [companyData.name, companyData.email, companyData.phone, companyData.plan || 'free']
    );
    return result.rows[0];
  }

  static async update(id: string, updates: Partial<Company>): Promise<Company | null> {
    const fields = Object.keys(updates).filter(key => key !== 'id');
    const values = fields.map(key => updates[key as keyof Company]);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    if (fields.length === 0) {
      return this.findById(id);
    }

    const result = await pool.query(
      `UPDATE companies SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  }

  static async deactivate(id: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE companies SET is_active = false WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  static async getStats(): Promise<{
    total: number;
    active: number;
    byPlan: Record<string, number>;
  }> {
    const [totalResult, planResult] = await Promise.all([
      pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active
         FROM companies`
      ),
      pool.query(
        `SELECT plan, COUNT(*) as count 
         FROM companies 
         WHERE is_active = true 
         GROUP BY plan`
      )
    ]);

    const byPlan: Record<string, number> = {};
    planResult.rows.forEach(row => {
      byPlan[row.plan] = parseInt(row.count);
    });

    return {
      total: parseInt(totalResult.rows[0].total),
      active: parseInt(totalResult.rows[0].active),
      byPlan
    };
  }

  static async getCompanyWithStats(id: string): Promise<{
    company: Company;
    stats: {
      users: number;
      contacts: number;
      templates: number;
      campaigns: number;
      messagesToday: number;
    };
  } | null> {
    const companyResult = await pool.query(
      'SELECT * FROM companies WHERE id = $1 AND is_active = true',
      [id]
    );

    if (companyResult.rows.length === 0) {
      return null;
    }

    const statsResult = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM users WHERE company_id = $1 AND is_active = true) as users,
        (SELECT COUNT(*) FROM contacts WHERE company_id = $1 AND is_active = true) as contacts,
        (SELECT COUNT(*) FROM templates WHERE company_id = $1 AND is_active = true) as templates,
        (SELECT COUNT(*) FROM campaigns WHERE company_id = $1) as campaigns,
        (SELECT COUNT(*) FROM message_logs WHERE company_id = $1 AND created_at >= CURRENT_DATE) as messages_today`,
      [id]
    );

    return {
      company: companyResult.rows[0],
      stats: {
        users: parseInt(statsResult.rows[0].users),
        contacts: parseInt(statsResult.rows[0].contacts),
        templates: parseInt(statsResult.rows[0].templates),
        campaigns: parseInt(statsResult.rows[0].campaigns),
        messagesToday: parseInt(statsResult.rows[0].messages_today)
      }
    };
  }
}