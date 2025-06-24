-- Migration: Add instance audit logs and webhook failure logs tables
-- Created at: 2025-06-24
-- Description: Creates audit trail and webhook monitoring tables for enhanced instance management

-- Create enum types for audit events
DO $$ BEGIN
    CREATE TYPE instance_event_type_enum AS ENUM (
        'status_change', 
        'webhook_received', 
        'connection_update', 
        'error_occurred'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_source_enum AS ENUM ('webhook', 'system', 'manual', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE webhook_failure_status_enum AS ENUM ('pending', 'retrying', 'failed', 'resolved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create instance audit logs table
CREATE TABLE IF NOT EXISTS instance_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    event_type instance_event_type_enum NOT NULL,
    old_data JSONB DEFAULT '{}',
    new_data JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    source audit_source_enum NOT NULL DEFAULT 'system',
    source_ip INET,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create webhook failure logs table for retry mechanism
CREATE TABLE IF NOT EXISTS webhook_failure_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_url TEXT NOT NULL,
    payload JSONB NOT NULL,
    instance_name VARCHAR(255) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    failure_reason TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    status webhook_failure_status_enum NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_instance_audit_logs_instance_id ON instance_audit_logs(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_audit_logs_company_id ON instance_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_instance_audit_logs_event_type ON instance_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_instance_audit_logs_created_at ON instance_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_instance_audit_logs_source ON instance_audit_logs(source);

CREATE INDEX IF NOT EXISTS idx_webhook_failure_logs_company_id ON webhook_failure_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_webhook_failure_logs_status ON webhook_failure_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_failure_logs_instance_name ON webhook_failure_logs(instance_name);
CREATE INDEX IF NOT EXISTS idx_webhook_failure_logs_next_retry_at ON webhook_failure_logs(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_failure_logs_created_at ON webhook_failure_logs(created_at DESC);

-- Create trigger to update updated_at column for webhook_failure_logs
CREATE TRIGGER update_webhook_failure_logs_updated_at 
    BEFORE UPDATE ON webhook_failure_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments to tables
COMMENT ON TABLE instance_audit_logs IS 'Audit trail for all WhatsApp instance changes and events';
COMMENT ON COLUMN instance_audit_logs.old_data IS 'Previous state data before the change';
COMMENT ON COLUMN instance_audit_logs.new_data IS 'New state data after the change';
COMMENT ON COLUMN instance_audit_logs.metadata IS 'Additional context and metadata for the event';
COMMENT ON COLUMN instance_audit_logs.source IS 'Source of the change (webhook, system, manual, user)';
COMMENT ON COLUMN instance_audit_logs.source_ip IS 'IP address if the change came from a web request';

COMMENT ON TABLE webhook_failure_logs IS 'Logs webhook failures for retry mechanism and monitoring';
COMMENT ON COLUMN webhook_failure_logs.payload IS 'Original webhook payload that failed';
COMMENT ON COLUMN webhook_failure_logs.failure_reason IS 'Reason why the webhook processing failed';
COMMENT ON COLUMN webhook_failure_logs.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN webhook_failure_logs.next_retry_at IS 'When the next retry should be attempted';