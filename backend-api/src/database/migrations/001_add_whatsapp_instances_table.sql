-- Migration: Add WhatsApp Cloud API instances table
-- Created at: 2025-06-24
-- Description: Creates whatsapp_instances table to store WhatsApp Cloud API instance information

-- Create enum types for integration_type and status
DO $$ BEGIN
    CREATE TYPE integration_type_enum AS ENUM ('WHATSAPP-BUSINESS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE whatsapp_instance_status_enum AS ENUM ('connected', 'disconnected', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create whatsapp_instances table
CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    instance_name VARCHAR(255) NOT NULL,
    integration_type integration_type_enum NOT NULL DEFAULT 'WHATSAPP-BUSINESS',
    meta_access_token TEXT NOT NULL, -- Encrypted access token for Meta Graph API
    meta_phone_number_id VARCHAR(255) NOT NULL, -- Phone number ID from Meta Business
    meta_business_id VARCHAR(255) NOT NULL, -- Business account ID from Meta
    status whatsapp_instance_status_enum NOT NULL DEFAULT 'disconnected',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, instance_name),
    UNIQUE(meta_phone_number_id) -- Each phone number can only be used once
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_company_id ON whatsapp_instances(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_meta_phone_number_id ON whatsapp_instances(meta_phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_integration_type ON whatsapp_instances(integration_type);

-- Create trigger to update updated_at column
CREATE TRIGGER update_whatsapp_instances_updated_at 
    BEFORE UPDATE ON whatsapp_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE whatsapp_instances IS 'Stores WhatsApp Cloud API instance configurations for companies';
COMMENT ON COLUMN whatsapp_instances.meta_access_token IS 'Encrypted Meta Graph API access token';
COMMENT ON COLUMN whatsapp_instances.meta_phone_number_id IS 'Phone Number ID from Meta Business Manager';
COMMENT ON COLUMN whatsapp_instances.meta_business_id IS 'Business Account ID from Meta Business Manager';
COMMENT ON COLUMN whatsapp_instances.integration_type IS 'Type of WhatsApp integration (currently only Cloud API)';