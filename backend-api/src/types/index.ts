export interface User {
  id: string;
  email: string;
  name: string;
  company_id: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  phone?: string;
  plan: 'free' | 'basic' | 'premium' | 'enterprise';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Contact {
  id: string;
  company_id: string;
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Template {
  id: string;
  company_id: string;
  name: string;
  content: string;
  variables: string[];
  category: 'marketing' | 'notification' | 'support';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Campaign {
  id: string;
  company_id: string;
  name: string;
  template_id: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'cancelled';
  type?: 'broadcast' | 'individual' | 'automated';
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  variables?: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

export interface CampaignContact {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at?: Date;
  delivered_at?: Date;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface MessageLog {
  id: string;
  company_id: string;
  campaign_id?: string;
  contact_id: string;
  phone: string;
  message_content: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  whatsapp_message_id?: string;
  evolution_api_response?: Record<string, any>;
  error_message?: string;
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface WhatsAppIntegration {
  id: string;
  company_id: string;
  instance_name: string;
  instance_key: string;
  qr_code?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  phone_number?: string;
  profile_name?: string;
  evolution_api_data?: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SendMessageJob {
  id: string;
  campaign_id?: string;
  contact_id: string;
  phone: string;
  message_content: string;
  template_variables?: Record<string, string>;
  company_id: string;
  integration_id: string;
  retry_count?: number;
  scheduled_at?: Date;
  created_at: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  company_id: string;
  role: 'admin' | 'user';
}

// Enhanced webhook types for Evolution API integration
export interface EvolutionWebhookPayload {
  instance: string;
  data: {
    key?: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    messageTimestamp?: number;
    status?: 'ERROR' | 'PENDING' | 'SERVER_ACK' | 'DELIVERY_ACK' | 'READ' | 'PLAYED';
    participant?: string;
    messageType?: string;
    message?: any;
    // Instance status data
    instance?: {
      instanceName: string;
      state: 'open' | 'close' | 'connecting' | 'qr' | 'browserClose';
      connectionStatus?: string;
    };
    qrcode?: {
      code: string;
      base64: string;
    };
    connection?: {
      state: string;
      statusReason?: number;
    };
  };
  destination: string;
  date_time: string;
  sender: string;
  server_url: string;
  apikey: string;
  webhook: string;
  events: string[];
}

// Instance status change event
export interface InstanceStatusChangeEvent {
  instanceId: string;
  instanceName: string;
  companyId: string;
  oldStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  newStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  timestamp: Date;
  metadata?: {
    qrCode?: string;
    phoneNumber?: string;
    profileName?: string;
    connectionDetails?: Record<string, any>;
  };
  source: 'webhook' | 'system' | 'manual';
}

// Webhook retry configuration
export interface WebhookRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableEvents: string[];
}

// Webhook failure log
export interface WebhookFailureLog {
  id: string;
  webhook_url: string;
  payload: Record<string, any>;
  instance_name: string;
  company_id: string;
  failure_reason: string;
  retry_count: number;
  next_retry_at?: Date;
  status: 'pending' | 'retrying' | 'failed' | 'resolved';
  created_at: Date;
  updated_at: Date;
}

// Instance audit log
export interface InstanceAuditLog {
  id: string;
  instance_id: string;
  company_id: string;
  event_type: 'status_change' | 'webhook_received' | 'connection_update' | 'error_occurred';
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  metadata?: Record<string, any>;
  source: 'webhook' | 'system' | 'manual' | 'user';
  source_ip?: string;
  user_id?: string;
  created_at: Date;
}

// Real-time update event for frontend
export interface RealTimeUpdateEvent {
  type: 'instance_status' | 'message_status' | 'webhook_failure' | 'system_alert';
  companyId: string;
  instanceId?: string;
  data: Record<string, any>;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}