import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { vi } from 'vitest';

// Mock data
export const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  name: 'Test User',
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  role: 'user' as const,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

export const mockCompany = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Company',
  email: 'company@example.com',
  phone: '+1234567890',
  plan: 'basic' as const,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

export const mockContact = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Contact',
  phone: '+1234567890',
  email: 'contact@example.com',
  tags: ['customer', 'vip'],
  custom_fields: { department: 'Sales' },
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

export const mockTemplate = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Template',
  content: 'Hello {{name}}, this is a test message!',
  category: 'marketing' as const,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

export const mockCampaign = {
  id: '123e4567-e89b-12d3-a456-426614174004',
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  template_id: '123e4567-e89b-12d3-a456-426614174003',
  name: 'Test Campaign',
  status: 'draft' as const,
  scheduled_at: null,
  variables: { product: 'WhatsApp SaaS' },
  total_contacts: 10,
  sent_count: 0,
  delivered_count: 0,
  read_count: 0,
  failed_count: 0,
  template_name: 'Test Template',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

export const mockMessageLog = {
  id: '123e4567-e89b-12d3-a456-426614174005',
  campaign_id: '123e4567-e89b-12d3-a456-426614174004',
  contact_id: '123e4567-e89b-12d3-a456-426614174002',
  phone: '+1234567890',
  message_content: 'Hello Test Contact, this is a test message!',
  status: 'sent' as const,
  whatsapp_message_id: 'wamid.test123',
  evolution_api_response: { success: true },
  contact_name: 'Test Contact',
  campaign_name: 'Test Campaign',
  created_at: '2024-01-01T00:00:00.000Z',
  sent_at: '2024-01-01T00:00:00.000Z',
  delivered_at: null,
  read_at: null,
  error_message: null,
};

// Mock API responses
export const mockApiResponses = {
  contacts: {
    success: true,
    data: [mockContact],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      pages: 1,
    },
  },
  templates: {
    success: true,
    data: [mockTemplate],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      pages: 1,
    },
  },
  campaigns: {
    success: true,
    data: [mockCampaign],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      pages: 1,
    },
  },
  messageLogs: {
    success: true,
    data: [mockMessageLog],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      pages: 1,
    },
  },
  stats: {
    success: true,
    data: {
      total: 100,
      active: 95,
      withEmail: 80,
      withTags: 60,
      recent: 15,
    },
  },
};

// Mock API service
export const mockApiService = {
  // Auth
  login: vi.fn(),
  register: vi.fn(),
  me: vi.fn(),
  changePassword: vi.fn(),

  // Contacts
  getContacts: vi.fn().mockResolvedValue(mockApiResponses.contacts),
  getContact: vi.fn().mockResolvedValue({ success: true, data: mockContact }),
  createContact: vi.fn().mockResolvedValue({ success: true, data: mockContact }),
  updateContact: vi.fn().mockResolvedValue({ success: true, data: mockContact }),
  deleteContact: vi.fn().mockResolvedValue({ success: true, message: 'Contact deleted' }),
  bulkCreateContacts: vi.fn().mockResolvedValue({ success: true, data: [mockContact] }),
  getContactStats: vi.fn().mockResolvedValue(mockApiResponses.stats),
  getContactTags: vi.fn().mockResolvedValue({ success: true, data: ['customer', 'vip'] }),

  // Templates
  getTemplates: vi.fn().mockResolvedValue(mockApiResponses.templates),
  getTemplate: vi.fn().mockResolvedValue({ success: true, data: mockTemplate }),
  createTemplate: vi.fn().mockResolvedValue({ success: true, data: mockTemplate }),
  updateTemplate: vi.fn().mockResolvedValue({ success: true, data: mockTemplate }),
  deleteTemplate: vi.fn().mockResolvedValue({ success: true, message: 'Template deleted' }),
  previewTemplate: vi.fn().mockResolvedValue({ success: true, content: 'Hello Test User, this is a test message!' }),
  getTemplateStats: vi.fn().mockResolvedValue(mockApiResponses.stats),

  // Campaigns
  getCampaigns: vi.fn().mockResolvedValue(mockApiResponses.campaigns),
  getCampaign: vi.fn().mockResolvedValue({ success: true, data: mockCampaign }),
  createCampaign: vi.fn().mockResolvedValue({ success: true, data: mockCampaign }),
  updateCampaign: vi.fn().mockResolvedValue({ success: true, data: mockCampaign }),
  deleteCampaign: vi.fn().mockResolvedValue({ success: true, message: 'Campaign deleted' }),
  sendCampaign: vi.fn().mockResolvedValue({ success: true, message: 'Campaign sent' }),
  pauseCampaign: vi.fn().mockResolvedValue({ success: true, message: 'Campaign paused' }),
  resumeCampaign: vi.fn().mockResolvedValue({ success: true, message: 'Campaign resumed' }),
  cancelCampaign: vi.fn().mockResolvedValue({ success: true, message: 'Campaign cancelled' }),
  addContactsToCampaign: vi.fn().mockResolvedValue({ success: true, message: 'Contacts added' }),
  sendSingleMessage: vi.fn().mockResolvedValue({ success: true, message: 'Message sent' }),
  getCampaignStats: vi.fn().mockResolvedValue(mockApiResponses.stats),

  // Message Logs
  getMessageLogs: vi.fn().mockResolvedValue(mockApiResponses.messageLogs),
  getMessageLog: vi.fn().mockResolvedValue({ success: true, data: mockMessageLog }),
  getCampaignLogs: vi.fn().mockResolvedValue(mockApiResponses.messageLogs),
  getMessageLogStats: vi.fn().mockResolvedValue({
    success: true,
    data: {
      total: 100,
      successRate: 95.5,
      deliveryRate: 90.2,
      readRate: 85.3,
      byStatus: {
        pending: 5,
        sent: 20,
        delivered: 60,
        read: 10,
        failed: 5,
      },
      byCampaign: {
        'Test Campaign': 50,
        'Other Campaign': 30,
        'Another Campaign': 20,
      },
    },
  }),
};

// Mock auth store
export const mockAuthStore = {
  user: mockUser,
  company: mockCompany,
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  loadUser: vi.fn(),
  setUser: vi.fn(),
  setCompany: vi.fn(),
};

// Test wrapper component
interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Helper functions
export const createMockEvent = (overrides: Partial<Event> = {}) => {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: { value: '' },
    ...overrides,
  } as unknown as Event;
};

export const createMockChangeEvent = (value: string) => {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: { value },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
};

export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};

// Mock modules
vi.mock('@/services/api', () => ({
  default: mockApiService,
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
  Toaster: () => null,
}));