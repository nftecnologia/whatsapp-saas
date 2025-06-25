import pool from '@/config/database';
import { User } from '@/types';

interface UserWithPassword extends User {
  password_hash: string;
}

export class UserModel {
  static async findById(id: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [id]
    );
    return result.rows[0] || null;
  }

  static async findByEmail(email: string): Promise<UserWithPassword | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    return result.rows[0] || null;
  }

  static async findByCompanyId(companyId: string): Promise<User[]> {
    const result = await pool.query(
      'SELECT * FROM users WHERE company_id = $1 AND is_active = true ORDER BY created_at DESC',
      [companyId]
    );
    return result.rows;
  }

  static async create(userData: {
    email: string;
    name: string;
    password_hash: string;
    company_id: string;
    role?: 'admin' | 'user';
  }): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, company_id, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [userData.email, userData.name, userData.password_hash, userData.company_id, userData.role || 'user']
    );
    return result.rows[0];
  }

  static async update(id: string, updates: Partial<User>): Promise<User | null> {
    const fields = Object.keys(updates).filter(key => key !== 'id');
    const values = fields.map(key => updates[key as keyof User]);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    if (fields.length === 0) {
      return this.findById(id);
    }

    const result = await pool.query(
      `UPDATE users SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  }

  static async updateLastLogin(id: string): Promise<void> {
    await pool.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  static async deactivate(id: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE users SET is_active = false WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  static async getStats(companyId: string): Promise<{
    total: number;
    active: number;
    admins: number;
  }> {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE role = 'admin' AND is_active = true) as admins
       FROM users 
       WHERE company_id = $1`,
      [companyId]
    );
    return result.rows[0];
  }
}