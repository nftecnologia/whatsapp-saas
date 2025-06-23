import pool from '@/config/database';
import { Template } from '@/types';

export class TemplateModel {
  static async findById(id: string, companyId: string): Promise<Template | null> {
    const result = await pool.query(
      'SELECT * FROM templates WHERE id = $1 AND company_id = $2 AND is_active = true',
      [id, companyId]
    );
    return result.rows[0] || null;
  }

  static async findByName(name: string, companyId: string): Promise<Template | null> {
    const result = await pool.query(
      'SELECT * FROM templates WHERE name = $1 AND company_id = $2 AND is_active = true',
      [name, companyId]
    );
    return result.rows[0] || null;
  }

  static async findAll(
    companyId: string,
    filters: {
      search?: string;
      category?: 'marketing' | 'notification' | 'support';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    templates: Template[];
    total: number;
  }> {
    let whereClause = 'WHERE company_id = $1 AND is_active = true';
    let params: any[] = [companyId];
    let paramIndex = 2;

    if (filters.search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [templatesResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM templates ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM templates ${whereClause}`, params)
    ]);

    return {
      templates: templatesResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  static async create(templateData: {
    company_id: string;
    name: string;
    content: string;
    variables?: string[];
    category?: 'marketing' | 'notification' | 'support';
  }): Promise<Template> {
    const result = await pool.query(
      `INSERT INTO templates (company_id, name, content, variables, category) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [
        templateData.company_id,
        templateData.name,
        templateData.content,
        templateData.variables || [],
        templateData.category || 'notification'
      ]
    );
    return result.rows[0];
  }

  static async update(id: string, companyId: string, updates: Partial<Template>): Promise<Template | null> {
    const fields = Object.keys(updates).filter(key => !['id', 'company_id', 'created_at'].includes(key));
    const values = fields.map(key => updates[key as keyof Template]);
    const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');

    if (fields.length === 0) {
      return this.findById(id, companyId);
    }

    const result = await pool.query(
      `UPDATE templates SET ${setClause} WHERE id = $1 AND company_id = $2 RETURNING *`,
      [id, companyId, ...values]
    );
    return result.rows[0] || null;
  }

  static async delete(id: string, companyId: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE templates SET is_active = false WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    return result.rowCount > 0;
  }

  static async getStats(companyId: string): Promise<{
    total: number;
    active: number;
    byCategory: Record<string, number>;
  }> {
    const [totalResult, categoryResult] = await Promise.all([
      pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active
         FROM templates 
         WHERE company_id = $1`,
        [companyId]
      ),
      pool.query(
        `SELECT category, COUNT(*) as count 
         FROM templates 
         WHERE company_id = $1 AND is_active = true 
         GROUP BY category`,
        [companyId]
      )
    ]);

    const byCategory: Record<string, number> = {};
    categoryResult.rows.forEach(row => {
      byCategory[row.category] = parseInt(row.count);
    });

    return {
      total: parseInt(totalResult.rows[0].total),
      active: parseInt(totalResult.rows[0].active),
      byCategory
    };
  }

  static extractVariables(content: string): string[] {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  static replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });

    return result;
  }
}