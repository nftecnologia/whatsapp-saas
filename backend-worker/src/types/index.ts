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
  integration_type: 'WHATSAPP-BAILEYS' | 'WHATSAPP-CLOUD-API';
  qr_code?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  phone_number?: string;
  profile_name?: string;
  evolution_api_data?: Record<string, any>;
  cloud_api_config?: {
    access_token: string;
    phone_number_id: string;
    business_account_id: string;
    webhook_verify_token?: string;
  };
  webhook_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EvolutionAPIResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  messageId?: string;
}

export interface WorkerStats {
  processedMessages: number;
  successfulMessages: number;
  failedMessages: number;
  retryMessages: number;
  startTime: Date;
  uptime: number;
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