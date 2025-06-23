import { z } from 'zod';

// Common validation patterns
const phoneRegex = /^\+?[1-9]\d{1,14}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Base schemas
export const UuidSchema = z.string().regex(uuidRegex, 'Invalid UUID format');
export const EmailSchema = z.string().regex(emailRegex, 'Invalid email format');
export const PhoneSchema = z.string().regex(phoneRegex, 'Invalid phone format');
export const DateStringSchema = z.string().datetime({ message: 'Invalid ISO date format' });

// Pagination schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const SortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Contact schemas
export const ContactCreateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim(),
  phone: PhoneSchema,
  email: EmailSchema.optional(),
  tags: z.array(z.string().trim().min(1)).max(20, 'Maximum 20 tags allowed').default([]),
  custom_fields: z.record(z.string(), z.any()).optional(),
}).strict();

export const ContactUpdateSchema = ContactCreateSchema.partial().strict();

export const ContactQuerySchema = z.object({
  search: z.string().min(1).max(255).optional(),
  tags: z.union([
    z.string().transform(str => str.split(',').map(tag => tag.trim())),
    z.array(z.string())
  ]).optional(),
  email_exists: z.coerce.boolean().optional(),
  created_after: DateStringSchema.optional(),
  created_before: DateStringSchema.optional(),
}).merge(PaginationSchema).merge(SortSchema);

export const ContactBulkCreateSchema = z.object({
  contacts: z.array(ContactCreateSchema)
    .min(1, 'At least one contact is required')
    .max(1000, 'Maximum 1000 contacts allowed per batch'),
}).strict();

// Template schemas
export const TemplateCreateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim(),
  content: z.string()
    .min(1, 'Content is required')
    .max(4096, 'Content must be less than 4096 characters'),
  category: z.enum(['marketing', 'notification', 'support']).default('marketing'),
  variables: z.array(z.string().trim().min(1)).max(50, 'Maximum 50 variables allowed').default([]),
}).strict();

export const TemplateUpdateSchema = TemplateCreateSchema.partial().strict();

export const TemplateQuerySchema = z.object({
  search: z.string().min(1).max(255).optional(),
  category: z.enum(['marketing', 'notification', 'support']).optional(),
  has_variables: z.coerce.boolean().optional(),
  created_after: DateStringSchema.optional(),
  created_before: DateStringSchema.optional(),
}).merge(PaginationSchema).merge(SortSchema);

export const TemplatePreviewSchema = z.object({
  variables: z.record(z.string(), z.string()).optional(),
}).strict();

// Campaign schemas
export const CampaignCreateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim(),
  template_id: UuidSchema,
  scheduled_at: DateStringSchema.optional(),
  variables: z.record(z.string(), z.string()).optional(),
  send_immediately: z.boolean().default(false),
}).strict().refine(
  (data) => {
    if (data.send_immediately && data.scheduled_at) {
      return false;
    }
    return true;
  },
  {
    message: 'Cannot set scheduled_at when send_immediately is true',
    path: ['scheduled_at'],
  }
);

export const CampaignUpdateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim()
    .optional(),
  template_id: UuidSchema.optional(),
  scheduled_at: DateStringSchema.optional(),
  variables: z.record(z.string(), z.string()).optional(),
  status: z.enum(['draft', 'scheduled', 'running', 'completed', 'paused', 'cancelled']).optional(),
}).strict();

export const CampaignQuerySchema = z.object({
  search: z.string().min(1).max(255).optional(),
  status: z.enum(['draft', 'scheduled', 'running', 'completed', 'paused', 'cancelled']).optional(),
  template_id: UuidSchema.optional(),
  created_after: DateStringSchema.optional(),
  created_before: DateStringSchema.optional(),
  scheduled_after: DateStringSchema.optional(),
  scheduled_before: DateStringSchema.optional(),
}).merge(PaginationSchema).merge(SortSchema);

export const CampaignContactsSchema = z.object({
  contact_ids: z.array(UuidSchema)
    .min(1, 'At least one contact ID is required')
    .max(10000, 'Maximum 10000 contacts allowed per campaign'),
}).strict();

export const CampaignSendSchema = z.object({
  integration_id: UuidSchema.optional(),
  force_send: z.boolean().default(false),
}).strict();

// Message schemas
export const SendMessageSchema = z.object({
  contact_id: UuidSchema,
  template_id: UuidSchema,
  variables: z.record(z.string(), z.string()).optional(),
  integration_id: UuidSchema.optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
}).strict();

export const MessageLogQuerySchema = z.object({
  campaign_id: UuidSchema.optional(),
  contact_id: UuidSchema.optional(),
  phone: PhoneSchema.optional(),
  status: z.enum(['pending', 'sent', 'delivered', 'read', 'failed']).optional(),
  start_date: DateStringSchema.optional(),
  end_date: DateStringSchema.optional(),
  has_error: z.coerce.boolean().optional(),
}).merge(PaginationSchema).merge(SortSchema);

export const MessageStatsQuerySchema = z.object({
  campaign_id: UuidSchema.optional(),
  start_date: DateStringSchema.optional(),
  end_date: DateStringSchema.optional(),
  group_by: z.enum(['status', 'campaign', 'date', 'hour']).default('status'),
}).strict();

// Company schemas
export const CompanyUpdateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim()
    .optional(),
  email: EmailSchema.optional(),
  phone: PhoneSchema.optional(),
  plan: z.enum(['basic', 'premium', 'enterprise']).optional(),
  settings: z.record(z.string(), z.any()).optional(),
}).strict();

// User schemas
export const UserCreateSchema = z.object({
  email: EmailSchema,
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  role: z.enum(['admin', 'user']).default('user'),
}).strict();

export const UserUpdateSchema = z.object({
  email: EmailSchema.optional(),
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim()
    .optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number')
    .optional(),
  role: z.enum(['admin', 'user']).optional(),
  is_active: z.boolean().optional(),
}).strict();

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  confirm_password: z.string(),
}).strict().refine(
  (data) => data.new_password === data.confirm_password,
  {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  }
);

// Auth schemas
export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
  remember_me: z.boolean().default(false),
}).strict();

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim(),
  company_name: z.string()
    .min(1, 'Company name is required')
    .max(255, 'Company name must be less than 255 characters')
    .trim(),
  company_email: EmailSchema,
  company_phone: PhoneSchema.optional(),
}).strict();

// File upload schemas
export const FileUploadSchema = z.object({
  file_type: z.enum(['image', 'document', 'video', 'audio']),
  max_size: z.number().int().min(1).max(100 * 1024 * 1024).default(10 * 1024 * 1024), // 10MB default
  allowed_extensions: z.array(z.string()).optional(),
}).strict();

// Integration schemas
export const IntegrationCreateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim(),
  type: z.enum(['evolution_api', 'whatsapp_business', 'custom']),
  config: z.record(z.string(), z.any()),
  is_active: z.boolean().default(true),
}).strict();

export const IntegrationUpdateSchema = IntegrationCreateSchema.partial().strict();

// Common response schemas
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.any().optional(),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
  }).optional(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.string().optional(),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
  })).optional(),
});

// Type exports for TypeScript inference
export type ContactCreate = z.infer<typeof ContactCreateSchema>;
export type ContactUpdate = z.infer<typeof ContactUpdateSchema>;
export type ContactQuery = z.infer<typeof ContactQuerySchema>;
export type ContactBulkCreate = z.infer<typeof ContactBulkCreateSchema>;

export type TemplateCreate = z.infer<typeof TemplateCreateSchema>;
export type TemplateUpdate = z.infer<typeof TemplateUpdateSchema>;
export type TemplateQuery = z.infer<typeof TemplateQuerySchema>;
export type TemplatePreview = z.infer<typeof TemplatePreviewSchema>;

export type CampaignCreate = z.infer<typeof CampaignCreateSchema>;
export type CampaignUpdate = z.infer<typeof CampaignUpdateSchema>;
export type CampaignQuery = z.infer<typeof CampaignQuerySchema>;
export type CampaignContacts = z.infer<typeof CampaignContactsSchema>;
export type CampaignSend = z.infer<typeof CampaignSendSchema>;

export type SendMessage = z.infer<typeof SendMessageSchema>;
export type MessageLogQuery = z.infer<typeof MessageLogQuerySchema>;
export type MessageStatsQuery = z.infer<typeof MessageStatsQuerySchema>;

export type CompanyUpdate = z.infer<typeof CompanyUpdateSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;

export type Login = z.infer<typeof LoginSchema>;
export type Register = z.infer<typeof RegisterSchema>;

export type FileUpload = z.infer<typeof FileUploadSchema>;
export type IntegrationCreate = z.infer<typeof IntegrationCreateSchema>;
export type IntegrationUpdate = z.infer<typeof IntegrationUpdateSchema>;