import fs from 'fs';
import path from 'path';
import pool from '@/config/database';

// Create migrations tracking table if it doesn't exist
const createMigrationsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(query);
};

// Get list of executed migrations
const getExecutedMigrations = async (): Promise<string[]> => {
  const result = await pool.query('SELECT filename FROM migrations ORDER BY id');
  return result.rows.map(row => row.filename);
};

// Mark migration as executed
const markMigrationExecuted = async (filename: string) => {
  await pool.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
};

// Run a single migration file
const runMigrationFile = async (filePath: string, filename: string) => {
  try {
    console.log(`🔄 Running migration: ${filename}`);
    
    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query(sql);
    await markMigrationExecuted(filename);
    
    console.log(`✅ Migration completed: ${filename}`);
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`, error);
    throw error;
  }
};

// Run all pending migrations
const runMigrations = async () => {
  try {
    console.log('🔄 Starting database migrations...');
    
    // Create migrations tracking table
    await createMigrationsTable();
    
    // Get migrations directory
    const migrationsDir = path.join(__dirname, 'migrations');
    
    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 No migrations directory found, skipping migrations');
      return;
    }
    
    // Get all migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure proper order
    
    if (migrationFiles.length === 0) {
      console.log('📁 No migration files found');
      return;
    }
    
    // Get executed migrations
    const executedMigrations = await getExecutedMigrations();
    
    // Find pending migrations
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✅ All migrations are up to date');
      return;
    }
    
    console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach(file => console.log(`  - ${file}`));
    
    // Run pending migrations
    for (const filename of pendingMigrations) {
      const filePath = path.join(migrationsDir, filename);
      await runMigrationFile(filePath, filename);
    }
    
    console.log('✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run specific migration (for development/testing)
const runSingleMigration = async (filename: string) => {
  try {
    await createMigrationsTable();
    
    const filePath = path.join(__dirname, 'migrations', filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration file not found: ${filename}`);
    }
    
    const executedMigrations = await getExecutedMigrations();
    
    if (executedMigrations.includes(filename)) {
      console.log(`⚠️  Migration already executed: ${filename}`);
      return;
    }
    
    await runMigrationFile(filePath, filename);
    
  } catch (error) {
    console.error('❌ Single migration failed:', error);
    throw error;
  }
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'single' && args[1]) {
    // Run single migration: npm run migrate single 001_add_whatsapp_instances_table.sql
    runSingleMigration(args[1])
      .then(() => {
        console.log('🎉 Single migration completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Single migration failed:', error);
        process.exit(1);
      });
  } else {
    // Run all pending migrations: npm run migrate
    runMigrations()
      .then(() => {
        console.log('🎉 Migration process completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Migration process failed:', error);
        process.exit(1);
      });
  }
}

export { runMigrations, runSingleMigration };
export default runMigrations;