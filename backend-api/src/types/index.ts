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
  role: string;
}