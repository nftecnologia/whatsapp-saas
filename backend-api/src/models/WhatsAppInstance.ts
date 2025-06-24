import { z } from 'zod';

// Database model for WhatsApp instances
export interface WhatsAppInstance {
  id: string;
  company_id: string;
  instance_name: string;
  integration_type: 'WHATSAPP-BUSINESS';
  meta_access_token: string; // Encrypted
  meta_phone_number_id: string;
  meta_business_id: string;
  status: 'connected' | 'disconnected' | 'error';
  created_at: Date;
  updated_at: Date;
}

// Create WhatsApp instance schema
export const CreateWhatsAppInstanceSchema = z.object({
  company_id: z.string().uuid('Company ID must be a valid UUID'),
  instance_name: z.string()
    .min(1, 'Instance name is required')
    .max(255, 'Instance name must be less than 255 characters'),
  integration_type: z.literal('WHATSAPP-BUSINESS'),
  meta_access_token: z.string().min(1, 'Meta access token is required'),
  meta_phone_number_id: z.string().min(1, 'Meta phone number ID is required'),
  meta_business_id: z.string().min(1, 'Meta business ID is required'),
  status: z.enum(['connected', 'disconnected', 'error']).default('disconnected')
});

// Update WhatsApp instance schema
export const UpdateWhatsAppInstanceSchema = z.object({
  instance_name: z.string()
    .min(1, 'Instance name is required')
    .max(255, 'Instance name must be less than 255 characters')
    .optional(),
  meta_access_token: z.string().min(1, 'Meta access token is required').optional(),
  meta_phone_number_id: z.string().min(1, 'Meta phone number ID is required').optional(),
  meta_business_id: z.string().min(1, 'Meta business ID is required').optional(),
  status: z.enum(['connected', 'disconnected', 'error']).optional()
});

// Query WhatsApp instances schema
export const QueryWhatsAppInstancesSchema = z.object({
  company_id: z.string().uuid().optional(),
  status: z.enum(['connected', 'disconnected', 'error']).optional(),
  integration_type: z.literal('WHATSAPP-BUSINESS').optional(),
  page: z.string().transform(val => parseInt(val, 10)).default('1'),
  limit: z.string().transform(val => parseInt(val, 10)).default('20')
});

// Type exports
export type CreateWhatsAppInstanceInput = z.infer<typeof CreateWhatsAppInstanceSchema>;
export type UpdateWhatsAppInstanceInput = z.infer<typeof UpdateWhatsAppInstanceSchema>;
export type QueryWhatsAppInstancesInput = z.infer<typeof QueryWhatsAppInstancesSchema>;

// Response type for API
export interface WhatsAppInstanceResponse extends Omit<WhatsAppInstance, 'meta_access_token'> {
  meta_access_token: string; // This will be masked in API responses
}

// Database operations interface
export interface WhatsAppInstanceRepository {
  create(data: CreateWhatsAppInstanceInput): Promise<WhatsAppInstance>;
  findById(id: string): Promise<WhatsAppInstance | null>;
  findByCompanyId(companyId: string): Promise<WhatsAppInstance[]>;
  findByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppInstance | null>;
  update(id: string, data: UpdateWhatsAppInstanceInput): Promise<WhatsAppInstance | null>;
  delete(id: string): Promise<boolean>;
  list(query: QueryWhatsAppInstancesInput): Promise<{
    instances: WhatsAppInstance[];
    total: number;
    page: number;
    limit: number;
  }>;
}