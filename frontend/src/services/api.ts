import axios, { AxiosInstance, AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadToken();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error: AxiosError) => {
        const message = (error.response?.data as any)?.message || error.message;
        
        if (error.response?.status === 401) {
          this.clearToken();
          window.location.href = '/login';
          toast.error('Session expired. Please login again.');
        } else if (error.response?.status >= 500) {
          toast.error('Server error. Please try again later.');
        } else if (error.response?.status >= 400) {
          toast.error(message);
        }

        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  private loadToken() {
    const token = localStorage.getItem('token');
    if (token) {
      this.token = token;
    }
  }

  getToken() {
    return this.token;
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async register(data: {
    email: string;
    password: string;
    name: string;
    companyName: string;
    companyEmail: string;
    companyPhone?: string;
  }) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async me() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  }

  // Contacts endpoints
  async getContacts(params?: {
    search?: string;
    tags?: string[];
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/contacts', { params });
    return response.data;
  }

  async getContact(id: string) {
    const response = await this.client.get(`/contacts/${id}`);
    return response.data;
  }

  async createContact(data: {
    name: string;
    phone: string;
    email?: string;
    tags?: string[];
    custom_fields?: Record<string, any>;
  }) {
    const response = await this.client.post('/contacts', data);
    return response.data;
  }

  async updateContact(id: string, data: Partial<{
    name: string;
    phone: string;
    email: string;
    tags: string[];
    custom_fields: Record<string, any>;
  }>) {
    const response = await this.client.put(`/contacts/${id}`, data);
    return response.data;
  }

  async deleteContact(id: string) {
    const response = await this.client.delete(`/contacts/${id}`);
    return response.data;
  }

  async bulkCreateContacts(contacts: Array<{
    name: string;
    phone: string;
    email?: string;
    tags?: string[];
    custom_fields?: Record<string, any>;
  }>) {
    const response = await this.client.post('/contacts/bulk', { contacts });
    return response.data;
  }

  async getContactTags() {
    const response = await this.client.get('/contacts/tags');
    return response.data;
  }

  async getContactStats() {
    const response = await this.client.get('/contacts/stats');
    return response.data;
  }

  // Templates endpoints
  async getTemplates(params?: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/templates', { params });
    return response.data;
  }

  async getTemplate(id: string) {
    const response = await this.client.get(`/templates/${id}`);
    return response.data;
  }

  async createTemplate(data: {
    name: string;
    content: string;
    category?: 'marketing' | 'notification' | 'support';
  }) {
    const response = await this.client.post('/templates', data);
    return response.data;
  }

  async updateTemplate(id: string, data: Partial<{
    name: string;
    content: string;
    category: 'marketing' | 'notification' | 'support';
  }>) {
    const response = await this.client.put(`/templates/${id}`, data);
    return response.data;
  }

  async deleteTemplate(id: string) {
    const response = await this.client.delete(`/templates/${id}`);
    return response.data;
  }

  async previewTemplate(id: string, variables?: Record<string, string>) {
    const response = await this.client.post(`/templates/${id}/preview`, { variables });
    return response.data;
  }

  async getTemplateStats() {
    const response = await this.client.get('/templates/stats');
    return response.data;
  }

  // Campaigns endpoints
  async getCampaigns(params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/campaigns', { params });
    return response.data;
  }

  async getCampaign(id: string) {
    const response = await this.client.get(`/campaigns/${id}`);
    return response.data;
  }

  async createCampaign(data: {
    name: string;
    template_id: string;
    scheduled_at?: string;
    variables?: Record<string, string>;
  }) {
    const response = await this.client.post('/campaigns', data);
    return response.data;
  }

  async updateCampaign(id: string, data: Partial<{
    name: string;
    template_id: string;
    scheduled_at: string;
    variables: Record<string, string>;
    status: string;
  }>) {
    const response = await this.client.put(`/campaigns/${id}`, data);
    return response.data;
  }

  async deleteCampaign(id: string) {
    const response = await this.client.delete(`/campaigns/${id}`);
    return response.data;
  }

  async addContactsToCampaign(id: string, contactIds: string[]) {
    const response = await this.client.post(`/campaigns/${id}/contacts`, {
      contact_ids: contactIds,
    });
    return response.data;
  }

  async removeContactFromCampaign(campaignId: string, contactId: string) {
    const response = await this.client.delete(`/campaigns/${campaignId}/contacts/${contactId}`);
    return response.data;
  }

  async getCampaignContacts(id: string, params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get(`/campaigns/${id}/contacts`, { params });
    return response.data;
  }

  async sendCampaign(id: string, integrationId?: string) {
    const response = await this.client.post(`/campaigns/${id}/send`, {
      integration_id: integrationId,
    });
    return response.data;
  }

  async pauseCampaign(id: string) {
    const response = await this.client.post(`/campaigns/${id}/pause`);
    return response.data;
  }

  async resumeCampaign(id: string) {
    const response = await this.client.post(`/campaigns/${id}/resume`);
    return response.data;
  }

  async cancelCampaign(id: string) {
    const response = await this.client.post(`/campaigns/${id}/cancel`);
    return response.data;
  }

  async sendSingleMessage(data: {
    contact_id: string;
    template_id: string;
    variables?: Record<string, string>;
    integration_id?: string;
  }) {
    const response = await this.client.post('/campaigns/send-message', data);
    return response.data;
  }

  async getCampaignStats() {
    const response = await this.client.get('/campaigns/stats');
    return response.data;
  }

  // Message logs endpoints
  async getMessageLogs(params?: {
    campaign_id?: string;
    status?: string;
    phone?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/logs', { params });
    return response.data;
  }

  async getMessageLog(id: string) {
    const response = await this.client.get(`/logs/${id}`);
    return response.data;
  }

  async getCampaignLogs(campaignId: string, params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get(`/logs/campaign/${campaignId}`, { params });
    return response.data;
  }

  async getMessageLogStats(params?: {
    campaign_id?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const response = await this.client.get('/logs/stats', { params });
    return response.data;
  }

  // Company endpoints
  async getCompanyProfile() {
    const response = await this.client.get('/companies/profile');
    return response.data;
  }

  async updateCompanyProfile(data: Partial<{
    name: string;
    email: string;
    phone: string;
    plan: string;
  }>) {
    const response = await this.client.put('/companies/profile', data);
    return response.data;
  }

  // Users endpoints
  async getUsers() {
    const response = await this.client.get('/users');
    return response.data;
  }

  async createUser(data: {
    email: string;
    name: string;
    password: string;
    role?: 'admin' | 'user';
  }) {
    const response = await this.client.post('/users', data);
    return response.data;
  }

  async updateUser(id: string, data: Partial<{
    email: string;
    name: string;
    password: string;
    role: 'admin' | 'user';
  }>) {
    const response = await this.client.put(`/users/${id}`, data);
    return response.data;
  }

  async deactivateUser(id: string) {
    const response = await this.client.delete(`/users/${id}`);
    return response.data;
  }

  // WhatsApp Integrations endpoints
  async getWhatsAppIntegrations(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/integrations/whatsapp', { params });
    return response.data;
  }

  async getWhatsAppIntegration(id: string) {
    const response = await this.client.get(`/integrations/whatsapp/${id}`);
    return response.data;
  }

  async createWhatsAppIntegration(data: {
    instance_name: string;
    instance_key: string;
    meta_token?: string;
    meta_app_id?: string;
    meta_phone_number_id?: string;
    webhook_verify_token?: string;
  }) {
    const response = await this.client.post('/integrations/whatsapp', data);
    return response.data;
  }

  async updateWhatsAppIntegration(id: string, data: Partial<{
    instance_name: string;
    instance_key: string;
    meta_token: string;
    meta_app_id: string;
    meta_phone_number_id: string;
    webhook_verify_token: string;
    is_active: boolean;
  }>) {
    const response = await this.client.put(`/integrations/whatsapp/${id}`, data);
    return response.data;
  }

  async deleteWhatsAppIntegration(id: string) {
    const response = await this.client.delete(`/integrations/whatsapp/${id}`);
    return response.data;
  }

  async connectWhatsAppIntegration(id: string) {
    const response = await this.client.post(`/integrations/whatsapp/${id}/connect`);
    return response.data;
  }

  async disconnectWhatsAppIntegration(id: string) {
    const response = await this.client.post(`/integrations/whatsapp/${id}/disconnect`);
    return response.data;
  }

  async getWhatsAppIntegrationQRCode(id: string) {
    const response = await this.client.get(`/integrations/whatsapp/${id}/qr`);
    return response.data;
  }

  async refreshWhatsAppIntegrationStatus(id: string) {
    const response = await this.client.post(`/integrations/whatsapp/${id}/refresh`);
    return response.data;
  }

  async getWhatsAppIntegrationStats() {
    const response = await this.client.get('/integrations/whatsapp/stats');
    return response.data;
  }

  // Enhanced WhatsApp Integration methods
  async validateMetaToken(token: string) {
    const response = await this.client.post('/integrations/whatsapp/validate-token', { token });
    return response.data;
  }

  async testWhatsAppIntegration(id: string) {
    const response = await this.client.post(`/integrations/whatsapp/${id}/test`);
    return response.data;
  }

  async getIntegrationSetupSteps(id: string) {
    const response = await this.client.get(`/integrations/whatsapp/${id}/setup-steps`);
    return response.data;
  }

  async updateSetupStep(id: string, stepId: string, data: any) {
    const response = await this.client.put(`/integrations/whatsapp/${id}/setup-steps/${stepId}`, data);
    return response.data;
  }

  async getIntegrationHealth(id: string) {
    const response = await this.client.get(`/integrations/whatsapp/${id}/health`);
    return response.data;
  }

  async bulkIntegrationOperation(data: {
    operation: 'connect' | 'disconnect' | 'refresh' | 'test' | 'delete';
    integration_ids: string[];
  }) {
    const response = await this.client.post('/integrations/whatsapp/bulk', data);
    return response.data;
  }

  async getBulkOperationStatus(operationId: string) {
    const response = await this.client.get(`/integrations/whatsapp/bulk/${operationId}`);
    return response.data;
  }
}

export default new ApiService();