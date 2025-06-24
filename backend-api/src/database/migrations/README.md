# Database Migrations

This directory contains database migration files for the WhatsApp SaaS platform.

## Migration System

The migration system tracks which migrations have been executed using a `migrations` table in the database. Each migration file is executed only once.

## File Naming Convention

Migration files should follow this naming pattern:
```
[number]_[description].sql
```

Examples:
- `001_add_whatsapp_instances_table.sql`
- `002_add_index_to_campaigns.sql`
- `003_update_user_roles.sql`

## Available Commands

### Run All Pending Migrations
```bash
npm run db:migrate:run
```

### Run a Specific Migration
```bash
npm run db:migrate:single 001_add_whatsapp_instances_table.sql
```

### Full Database Setup (Schema + Migrations)
```bash
npm run db:migrate
```

## Migration File Structure

Each migration file should:
1. Include a comment describing the migration purpose
2. Use `IF NOT EXISTS` clauses where appropriate to prevent errors
3. Handle enum type creation safely with DO blocks
4. Include proper indexes and constraints
5. Add table/column comments for documentation

## Example Migration File

```sql
-- Migration: Add new feature table
-- Created at: 2025-06-24
-- Description: Creates table for storing new feature data

-- Create enum type safely
DO $$ BEGIN
    CREATE TYPE status_enum AS ENUM ('active', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS new_feature (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    status status_enum NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_new_feature_status ON new_feature(status);

-- Create trigger for updated_at
CREATE TRIGGER update_new_feature_updated_at 
    BEFORE UPDATE ON new_feature
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE new_feature IS 'Stores new feature data';
```

## Current Migrations

- `001_add_whatsapp_instances_table.sql` - Adds WhatsApp Cloud API instances table

## Notes

- The migration system automatically creates a `migrations` table to track executed migrations
- Migrations are executed in alphabetical order based on filename
- Each migration is executed within a transaction
- Failed migrations will stop the process and require manual intervention
- Use TypeScript models in `/src/models/` to maintain type safety for new tables