import bcrypt from 'bcryptjs';
import pool from '@/config/database';

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const companyId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = '550e8400-e29b-41d4-a716-446655440001';

      await client.query(`
        INSERT INTO companies (id, name, email, plan) 
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO NOTHING
      `, [companyId, 'Demo Company', 'demo@whatsappsaas.com', 'premium']);

      const hashedPassword = await bcrypt.hash('demo123456', 10);
      
      await client.query(`
        INSERT INTO users (id, company_id, email, name, password_hash, role) 
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO NOTHING
      `, [userId, companyId, 'admin@whatsappsaas.com', 'Admin User', hashedPassword, 'admin']);

      await client.query(`
        INSERT INTO contacts (company_id, name, phone, email) 
        VALUES 
          ($1, 'João Silva', '+5511999887766', 'joao@email.com'),
          ($1, 'Maria Santos', '+5511888777666', 'maria@email.com'),
          ($1, 'Pedro Oliveira', '+5511777666555', 'pedro@email.com')
        ON CONFLICT (company_id, phone) DO NOTHING
      `, [companyId]);

      await client.query(`
        INSERT INTO templates (company_id, name, content, variables, category) 
        VALUES 
          ($1, 'Boas-vindas', 'Olá {{nome}}! Bem-vindo(a) à nossa plataforma. Estamos felizes em tê-lo(a) conosco!', ARRAY['nome'], 'notification'),
          ($1, 'Promoção', 'Oi {{nome}}! Temos uma promoção especial para você: {{oferta}}. Válida até {{data_limite}}!', ARRAY['nome', 'oferta', 'data_limite'], 'marketing'),
          ($1, 'Suporte', 'Olá {{nome}}, recebemos sua solicitação de suporte. Nosso ticket é #{{ticket}}. Retornaremos em breve.', ARRAY['nome', 'ticket'], 'support')
        ON CONFLICT (company_id, name) DO NOTHING
      `, [companyId]);

      await client.query(`
        INSERT INTO whatsapp_integrations (company_id, instance_name, instance_key, status) 
        VALUES ($1, 'demo-instance', 'demo-key-12345', 'disconnected')
        ON CONFLICT (instance_key) DO NOTHING
      `, [companyId]);

      await client.query('COMMIT');
      
      console.log('✅ Database seeded successfully!');
      console.log('📋 Demo data created:');
      console.log('  - Company: Demo Company (demo@whatsappsaas.com)');
      console.log('  - Admin user: admin@whatsappsaas.com / demo123456');
      console.log('  - 3 sample contacts');
      console.log('  - 3 message templates');
      console.log('  - 1 WhatsApp integration (disconnected)');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Seeding script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding script failed:', error);
      process.exit(1);
    });
}

export default seedDatabase;