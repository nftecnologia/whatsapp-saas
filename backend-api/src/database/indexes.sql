-- WhatsApp SaaS Database Performance Indexes
-- This file contains all performance-critical indexes for the platform

-- ====================================================================
-- CONTACTS TABLE INDEXES
-- ====================================================================

-- Primary search index on phone (most common lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_phone 
ON contacts (phone);

-- Company-specific contact searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_company_id 
ON contacts (company_id);

-- Composite index for company + phone (unique constraint support)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_company_phone 
ON contacts (company_id, phone);

-- Email search index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_email 
ON contacts (email) WHERE email IS NOT NULL;

-- Tag search using GIN index for array operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_tags 
ON contacts USING GIN (tags);

-- Full-text search on name
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_name_search 
ON contacts USING gin(to_tsvector('english', name));

-- Composite index for common filtering (company + created_at)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_company_created 
ON contacts (company_id, created_at DESC);

-- Partial index for active contacts only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_active 
ON contacts (company_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- ====================================================================
-- TEMPLATES TABLE INDEXES
-- ====================================================================

-- Company-specific template searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_company_id 
ON templates (company_id);

-- Category filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_category 
ON templates (category);

-- Composite index for company + category
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_company_category 
ON templates (company_id, category);

-- Full-text search on name and content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_name_search 
ON templates USING gin(to_tsvector('english', name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_content_search 
ON templates USING gin(to_tsvector('english', content));

-- Common ordering by creation date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_company_created 
ON templates (company_id, created_at DESC);

-- ====================================================================
-- CAMPAIGNS TABLE INDEXES
-- ====================================================================

-- Company-specific campaign searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_company_id 
ON campaigns (company_id);

-- Status filtering (very common)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_status 
ON campaigns (status);

-- Composite index for company + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_company_status 
ON campaigns (company_id, status);

-- Template relationship
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_template_id 
ON campaigns (template_id);

-- Scheduled campaigns lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_scheduled 
ON campaigns (scheduled_at) 
WHERE scheduled_at IS NOT NULL AND status = 'scheduled';

-- Running campaigns monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_running 
ON campaigns (company_id, updated_at) 
WHERE status IN ('running', 'paused');

-- Common ordering and filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_company_created 
ON campaigns (company_id, created_at DESC);

-- Performance metrics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_metrics 
ON campaigns (company_id, status, sent_count, delivered_count);

-- ====================================================================
-- CAMPAIGN_CONTACTS TABLE INDEXES
-- ====================================================================

-- Primary lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_contacts_campaign_id 
ON campaign_contacts (campaign_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_contacts_contact_id 
ON campaign_contacts (contact_id);

-- Composite primary key alternative (if not using surrogate key)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_contacts_unique 
ON campaign_contacts (campaign_id, contact_id);

-- Status filtering for campaign progress
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_contacts_status 
ON campaign_contacts (campaign_id, status);

-- ====================================================================
-- MESSAGE_LOGS TABLE INDEXES
-- ====================================================================

-- Campaign-specific message logs (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_campaign_id 
ON message_logs (campaign_id);

-- Contact-specific message history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_contact_id 
ON message_logs (contact_id);

-- Phone number lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_phone 
ON message_logs (phone);

-- Status filtering for monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_status 
ON message_logs (status);

-- WhatsApp message ID for webhook updates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_whatsapp_id 
ON message_logs (whatsapp_message_id) 
WHERE whatsapp_message_id IS NOT NULL;

-- Time-based queries for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_created_at 
ON message_logs (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_sent_at 
ON message_logs (sent_at DESC) 
WHERE sent_at IS NOT NULL;

-- Composite indexes for common analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_campaign_status 
ON message_logs (campaign_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_campaign_created 
ON message_logs (campaign_id, created_at DESC);

-- Failed message analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_failed 
ON message_logs (created_at DESC, error_message) 
WHERE status = 'failed';

-- Company-wide message analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_company_analytics 
ON message_logs (company_id, created_at DESC, status);

-- Performance monitoring index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_processing_time 
ON message_logs (created_at, sent_at) 
WHERE sent_at IS NOT NULL;

-- ====================================================================
-- USERS TABLE INDEXES
-- ====================================================================

-- Email lookup for authentication
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users (email);

-- Company-specific user management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_company_id 
ON users (company_id);

-- Active users only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active 
ON users (company_id, role) 
WHERE is_active = true;

-- ====================================================================
-- COMPANIES TABLE INDEXES
-- ====================================================================

-- Email lookup
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_email 
ON companies (email);

-- Plan-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_plan 
ON companies (plan);

-- Active companies
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_active 
ON companies (plan, created_at DESC) 
WHERE deleted_at IS NULL;

-- ====================================================================
-- PERFORMANCE MONITORING INDEXES
-- ====================================================================

-- System-wide statistics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_message_stats 
ON message_logs (DATE(created_at), status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_campaign_stats 
ON campaigns (DATE(created_at), status);

-- ====================================================================
-- MAINTENANCE INDEXES
-- ====================================================================

-- Cleanup operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_cleanup 
ON message_logs (created_at) 
WHERE status IN ('completed', 'failed');

-- Soft delete support
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_deleted 
ON contacts (deleted_at) 
WHERE deleted_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_deleted 
ON templates (deleted_at) 
WHERE deleted_at IS NOT NULL;

-- ====================================================================
-- NOTES
-- ====================================================================

-- 1. All indexes use CONCURRENTLY to avoid blocking production traffic
-- 2. Partial indexes are used where appropriate to reduce size
-- 3. GIN indexes are used for array and full-text search operations
-- 4. Composite indexes follow the principle of most selective column first
-- 5. Unique indexes ensure data integrity while providing performance benefits
-- 6. Consider pg_stat_user_indexes to monitor index usage
-- 7. Regularly run ANALYZE to keep statistics updated

-- Monitor index usage with:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- ORDER BY idx_scan DESC;

-- Check index sizes with:
-- SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_stat_user_indexes 
-- ORDER BY pg_relation_size(indexrelid) DESC;