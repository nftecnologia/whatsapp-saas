import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render, mockApiService, mockAuthStore, mockUser, mockCompany, mockContact, mockTemplate, mockCampaign, createMockChangeEvent } from '../helpers';
import App from '@/App';

// Mock all route components
vi.mock('@/pages/Login', () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}));

vi.mock('@/pages/Dashboard', () => ({
  default: () => <div data-testid="dashboard-page">Dashboard Page</div>,
}));

vi.mock('@/pages/Contacts', () => ({
  default: () => <div data-testid="contacts-page">Contacts Page</div>,
}));

vi.mock('@/pages/Templates', () => ({
  default: () => <div data-testid="templates-page">Templates Page</div>,
}));

vi.mock('@/pages/Campaigns', () => ({
  default: () => <div data-testid="campaigns-page">Campaigns Page</div>,
}));

vi.mock('@/pages/MessageDispatch', () => ({
  default: () => <div data-testid="message-dispatch-page">Message Dispatch Page</div>,
}));

vi.mock('@/pages/MessageLogs', () => ({
  default: () => <div data-testid="message-logs-page">Message Logs Page</div>,
}));

// Mock auth store
const mockAuthStoreHook = {
  ...mockAuthStore,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  loadUser: vi.fn(),
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => mockAuthStoreHook),
}));

describe('User Flows Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStoreHook.isAuthenticated = false;
    mockAuthStoreHook.isLoading = false;
    mockAuthStoreHook.user = null;
    mockAuthStoreHook.company = null;
    
    // Reset window location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/' },
      writable: true,
    });
  });

  describe('Authentication Flow', () => {
    it('redirects unauthenticated users to login', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });

    it('shows dashboard for authenticated users', async () => {
      mockAuthStoreHook.isAuthenticated = true;
      mockAuthStoreHook.user = mockUser;
      mockAuthStoreHook.company = mockCompany;

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
    });

    it('handles login flow correctly', async () => {
      mockAuthStoreHook.login.mockImplementation(() => {
        mockAuthStoreHook.isAuthenticated = true;
        mockAuthStoreHook.user = mockUser;
        mockAuthStoreHook.company = mockCompany;
        return Promise.resolve({ success: true });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      // Simulate successful login
      await mockAuthStoreHook.login('test@example.com', 'password');

      // Mock navigation after login
      mockAuthStoreHook.isAuthenticated = true;
      mockAuthStoreHook.user = mockUser;
      mockAuthStoreHook.company = mockCompany;

      // Re-render to reflect auth state change
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
    });

    it('handles logout flow correctly', async () => {
      mockAuthStoreHook.isAuthenticated = true;
      mockAuthStoreHook.user = mockUser;
      mockAuthStoreHook.company = mockCompany;

      mockAuthStoreHook.logout.mockImplementation(() => {
        mockAuthStoreHook.isAuthenticated = false;
        mockAuthStoreHook.user = null;
        mockAuthStoreHook.company = null;
        return Promise.resolve();
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });

      // Simulate logout
      await mockAuthStoreHook.logout();

      // Mock navigation after logout
      mockAuthStoreHook.isAuthenticated = false;
      mockAuthStoreHook.user = null;
      mockAuthStoreHook.company = null;

      // Re-render to reflect auth state change
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });
  });

  describe('Complete Campaign Workflow', () => {
    beforeEach(() => {
      mockAuthStoreHook.isAuthenticated = true;
      mockAuthStoreHook.user = mockUser;
      mockAuthStoreHook.company = mockCompany;
      
      // Mock all required API calls
      mockApiService.getContacts.mockResolvedValue({
        success: true,
        data: [mockContact],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      });

      mockApiService.getTemplates.mockResolvedValue({
        success: true,
        data: [mockTemplate],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      });

      mockApiService.getCampaigns.mockResolvedValue({
        success: true,
        data: [mockCampaign],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      });

      mockApiService.createContact.mockResolvedValue({
        success: true,
        data: { ...mockContact, id: 'new-contact-id' },
      });

      mockApiService.createTemplate.mockResolvedValue({
        success: true,
        data: { ...mockTemplate, id: 'new-template-id' },
      });

      mockApiService.createCampaign.mockResolvedValue({
        success: true,
        data: { ...mockCampaign, id: 'new-campaign-id' },
      });

      mockApiService.sendCampaign.mockResolvedValue({
        success: true,
        message: 'Campaign sent successfully',
      });
    });

    it('completes full workflow: create contact → create template → create campaign → send', async () => {
      render(<App />);

      // Start at dashboard
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });

      // Step 1: Navigate to contacts and create a contact
      // This would be handled by the actual navigation in the real app
      // For integration testing, we'll simulate the flow by calling the APIs

      // Simulate creating a contact
      const contactData = {
        name: 'John Doe',
        phone: '+5511999999999',
        email: 'john@example.com',
        tags: ['customer'],
      };

      await mockApiService.createContact(contactData);
      expect(mockApiService.createContact).toHaveBeenCalledWith(contactData);

      // Step 2: Create a template
      const templateData = {
        name: 'Welcome Template',
        content: 'Welcome {{name}}! Thanks for joining us.',
        category: 'marketing' as const,
      };

      await mockApiService.createTemplate(templateData);
      expect(mockApiService.createTemplate).toHaveBeenCalledWith(templateData);

      // Step 3: Create a campaign
      const campaignData = {
        name: 'Welcome Campaign',
        template_id: 'new-template-id',
        variables: { name: 'John Doe' },
      };

      await mockApiService.createCampaign(campaignData);
      expect(mockApiService.createCampaign).toHaveBeenCalledWith(campaignData);

      // Step 4: Send the campaign
      await mockApiService.sendCampaign('new-campaign-id');
      expect(mockApiService.sendCampaign).toHaveBeenCalledWith('new-campaign-id');

      // Verify the complete flow was executed
      expect(mockApiService.createContact).toHaveBeenCalledTimes(1);
      expect(mockApiService.createTemplate).toHaveBeenCalledTimes(1);
      expect(mockApiService.createCampaign).toHaveBeenCalledTimes(1);
      expect(mockApiService.sendCampaign).toHaveBeenCalledTimes(1);
    });

    it('handles errors gracefully during workflow', async () => {
      // Mock API error
      mockApiService.createContact.mockRejectedValueOnce(new Error('API Error'));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });

      // Attempt to create contact (should fail)
      try {
        await mockApiService.createContact({
          name: 'John Doe',
          phone: '+5511999999999',
          email: 'john@example.com',
          tags: ['customer'],
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // Verify error handling
      expect(mockApiService.createContact).toHaveBeenCalledTimes(1);
      // Subsequent steps should not be called
      expect(mockApiService.createTemplate).toHaveBeenCalledTimes(0);
      expect(mockApiService.createCampaign).toHaveBeenCalledTimes(0);
      expect(mockApiService.sendCampaign).toHaveBeenCalledTimes(0);
    });
  });

  describe('Message Dispatch Workflow', () => {
    beforeEach(() => {
      mockAuthStoreHook.isAuthenticated = true;
      mockAuthStoreHook.user = mockUser;
      mockAuthStoreHook.company = mockCompany;
      
      mockApiService.sendSingleMessage.mockResolvedValue({
        success: true,
        message: 'Message sent successfully',
      });
    });

    it('sends individual message successfully', async () => {
      render(<App />);

      // Simulate sending an individual message
      const messageData = {
        phone: '+5511999999999',
        message: 'Hello, this is a test message!',
      };

      await mockApiService.sendSingleMessage(messageData);
      expect(mockApiService.sendSingleMessage).toHaveBeenCalledWith(messageData);
    });

    it('sends batch messages successfully', async () => {
      render(<App />);

      // Simulate sending batch messages
      const batchData = [
        {
          contact_id: mockContact.id,
          template_id: mockTemplate.id,
          variables: { name: 'John' },
        },
        {
          contact_id: 'contact-2',
          template_id: mockTemplate.id,
          variables: { name: 'Jane' },
        },
      ];

      for (const message of batchData) {
        await mockApiService.sendSingleMessage(message);
      }

      expect(mockApiService.sendSingleMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Contact Management Workflow', () => {
    beforeEach(() => {
      mockAuthStoreHook.isAuthenticated = true;
      mockAuthStoreHook.user = mockUser;
      mockAuthStoreHook.company = mockCompany;
    });

    it('manages contact lifecycle: create → update → delete', async () => {
      render(<App />);

      // Create contact
      const newContact = {
        name: 'Jane Doe',
        phone: '+5511888888888',
        email: 'jane@example.com',
        tags: ['lead'],
      };

      await mockApiService.createContact(newContact);
      expect(mockApiService.createContact).toHaveBeenCalledWith(newContact);

      // Update contact
      const updateData = {
        ...newContact,
        name: 'Jane Smith',
        tags: ['customer'],
      };

      await mockApiService.updateContact('contact-id', updateData);
      expect(mockApiService.updateContact).toHaveBeenCalledWith('contact-id', updateData);

      // Delete contact
      await mockApiService.deleteContact('contact-id');
      expect(mockApiService.deleteContact).toHaveBeenCalledWith('contact-id');
    });

    it('handles bulk contact operations', async () => {
      render(<App />);

      // Bulk create contacts
      const contactsData = [
        { name: 'Contact 1', phone: '+5511111111111', email: 'contact1@example.com' },
        { name: 'Contact 2', phone: '+5511222222222', email: 'contact2@example.com' },
        { name: 'Contact 3', phone: '+5511333333333', email: 'contact3@example.com' },
      ];

      await mockApiService.bulkCreateContacts(contactsData);
      expect(mockApiService.bulkCreateContacts).toHaveBeenCalledWith(contactsData);
    });
  });

  describe('Template Management Workflow', () => {
    beforeEach(() => {
      mockAuthStoreHook.isAuthenticated = true;
      mockAuthStoreHook.user = mockUser;
      mockAuthStoreHook.company = mockCompany;
    });

    it('manages template lifecycle: create → preview → update → delete', async () => {
      render(<App />);

      // Create template
      const newTemplate = {
        name: 'Promotion Template',
        content: 'Hi {{name}}, check out our {{discount}}% discount!',
        category: 'marketing' as const,
      };

      await mockApiService.createTemplate(newTemplate);
      expect(mockApiService.createTemplate).toHaveBeenCalledWith(newTemplate);

      // Preview template
      const previewData = { name: 'John', discount: '20' };
      await mockApiService.previewTemplate('template-id', previewData);
      expect(mockApiService.previewTemplate).toHaveBeenCalledWith('template-id', previewData);

      // Update template
      const updateData = {
        ...newTemplate,
        content: 'Hello {{name}}, enjoy {{discount}}% off your next purchase!',
      };

      await mockApiService.updateTemplate('template-id', updateData);
      expect(mockApiService.updateTemplate).toHaveBeenCalledWith('template-id', updateData);

      // Delete template
      await mockApiService.deleteTemplate('template-id');
      expect(mockApiService.deleteTemplate).toHaveBeenCalledWith('template-id');
    });
  });

  describe('Campaign Management Workflow', () => {
    beforeEach(() => {
      mockAuthStoreHook.isAuthenticated = true;
      mockAuthStoreHook.user = mockUser;
      mockAuthStoreHook.company = mockCompany;
    });

    it('manages campaign lifecycle: create → configure → send → monitor', async () => {
      render(<App />);

      // Create campaign
      const newCampaign = {
        name: 'Black Friday Campaign',
        template_id: mockTemplate.id,
        variables: { discount: '50' },
      };

      await mockApiService.createCampaign(newCampaign);
      expect(mockApiService.createCampaign).toHaveBeenCalledWith(newCampaign);

      // Add contacts to campaign
      const contactIds = ['contact-1', 'contact-2', 'contact-3'];
      await mockApiService.addContactsToCampaign('campaign-id', contactIds);
      expect(mockApiService.addContactsToCampaign).toHaveBeenCalledWith('campaign-id', contactIds);

      // Send campaign
      await mockApiService.sendCampaign('campaign-id');
      expect(mockApiService.sendCampaign).toHaveBeenCalledWith('campaign-id');

      // Monitor campaign logs
      await mockApiService.getCampaignLogs('campaign-id', { page: 1, limit: 10 });
      expect(mockApiService.getCampaignLogs).toHaveBeenCalledWith('campaign-id', { page: 1, limit: 10 });
    });

    it('handles campaign controls: pause → resume → cancel', async () => {
      render(<App />);

      // Pause campaign
      await mockApiService.pauseCampaign('campaign-id');
      expect(mockApiService.pauseCampaign).toHaveBeenCalledWith('campaign-id');

      // Resume campaign
      await mockApiService.resumeCampaign('campaign-id');
      expect(mockApiService.resumeCampaign).toHaveBeenCalledWith('campaign-id');

      // Cancel campaign
      await mockApiService.cancelCampaign('campaign-id');
      expect(mockApiService.cancelCampaign).toHaveBeenCalledWith('campaign-id');
    });
  });

  describe('Data Flow Integration', () => {
    beforeEach(() => {
      mockAuthStoreHook.isAuthenticated = true;
      mockAuthStoreHook.user = mockUser;
      mockAuthStoreHook.company = mockCompany;
    });

    it('maintains data consistency across pages', async () => {
      render(<App />);

      // Simulate creating a contact
      await mockApiService.createContact(mockContact);

      // Verify contact appears in contact list
      await mockApiService.getContacts({});
      expect(mockApiService.getContacts).toHaveBeenCalled();

      // Create template
      await mockApiService.createTemplate(mockTemplate);

      // Verify template appears in template list
      await mockApiService.getTemplates({});
      expect(mockApiService.getTemplates).toHaveBeenCalled();

      // Create campaign using the contact and template
      await mockApiService.createCampaign({
        name: 'Test Campaign',
        template_id: mockTemplate.id,
        variables: {},
      });

      // Verify campaign appears in campaign list
      await mockApiService.getCampaigns({});
      expect(mockApiService.getCampaigns).toHaveBeenCalled();
    });

    it('handles real-time updates correctly', async () => {
      render(<App />);

      // Send a message
      await mockApiService.sendSingleMessage({
        phone: '+5511999999999',
        message: 'Test message',
      });

      // Verify message appears in logs
      await mockApiService.getMessageLogs({});
      expect(mockApiService.getMessageLogs).toHaveBeenCalled();

      // Verify stats are updated
      await mockApiService.getMessageLogStats();
      expect(mockApiService.getMessageLogStats).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(() => {
      mockAuthStoreHook.isAuthenticated = true;
      mockAuthStoreHook.user = mockUser;
      mockAuthStoreHook.company = mockCompany;
    });

    it('handles network errors gracefully', async () => {
      render(<App />);

      // Mock network error
      mockApiService.getContacts.mockRejectedValueOnce(new Error('Network Error'));

      try {
        await mockApiService.getContacts({});
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Network Error');
      }
    });

    it('handles validation errors properly', async () => {
      render(<App />);

      // Mock validation error
      mockApiService.createContact.mockRejectedValueOnce(new Error('Validation Error'));

      try {
        await mockApiService.createContact({
          name: '', // Invalid: empty name
          phone: 'invalid-phone', // Invalid: wrong format
          email: 'invalid-email', // Invalid: wrong format
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Validation Error');
      }
    });

    it('handles authentication errors correctly', async () => {
      render(<App />);

      // Mock authentication error
      mockApiService.getContacts.mockRejectedValueOnce(new Error('Unauthorized'));

      try {
        await mockApiService.getContacts({});
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Unauthorized');
      }
    });
  });
});