export interface User {
  id: string;
  email: string;
  name: string;
  company_id: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  phone?: string;
  plan: 'free' | 'basic' | 'premium' | 'enterprise';
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  company_id: string;
  name: string;
  content: string;
  variables: string[];
  category: 'marketing' | 'notification' | 'support';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  company_id: string;
  name: string;
  template_id: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'cancelled';
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  variables?: Record<string, string>;
  created_at: string;
  updated_at: string;
  template_name?: string;
}

export interface MessageLog {
  id: string;
  company_id: string;
  campaign_id?: string;
  contact_id?: string;
  phone: string;
  message_content: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  whatsapp_message_id?: string;
  evolution_api_response?: Record<string, any>;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at: string;
  updated_at: string;
  contact_name?: string;
  campaign_name?: string;
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
  // Enhanced fields for Meta integration
  meta_token?: string;
  meta_app_id?: string;
  meta_phone_number_id?: string;
  webhook_verify_token?: string;
  connection_health?: 'excellent' | 'good' | 'poor' | 'failed';
  last_health_check?: string;
  api_rate_limit?: {
    remaining: number;
    reset_time: string;
  };
  setup_completed?: boolean;
  validation_errors?: string[];
  created_at: string;
  updated_at: string;
}

export interface IntegrationSetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  required: boolean;
  validation_errors?: string[];
}

export interface IntegrationTestResult {
  test_name: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: Record<string, any>;
}

export interface BulkIntegrationOperation {
  operation: 'connect' | 'disconnect' | 'refresh' | 'test' | 'delete';
  integration_ids: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  results?: Array<{
    integration_id: string;
    success: boolean;
    message: string;
  }>;
}

export interface AuthData {
  user: User;
  token: string;
  company: {
    id: string;
    name: string;
    plan: string;
  };
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

export interface DashboardStats {
  contacts: {
    total: number;
    active: number;
    withEmail: number;
  };
  templates: {
    total: number;
    active: number;
    byCategory: Record<string, number>;
  };
  campaigns: {
    total: number;
    byStatus: Record<string, number>;
    totalMessages: number;
    successRate: number;
  };
  messages: {
    total: number;
    byStatus: Record<string, number>;
    successRate: number;
    deliveryRate: number;
    readRate: number;
  };
}