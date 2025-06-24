import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { EvolutionAPIResponse } from '../types';

export interface CloudAPIConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken?: string;
}

export interface InstanceConfig {
  instanceName: string;
  instanceKey: string;
  integration: 'WHATSAPP-BAILEYS' | 'WHATSAPP-CLOUD-API';
  cloudApiConfig?: CloudAPIConfig;
  qrcode?: boolean;
  webhookUrl?: string;
  webhookByEvents?: boolean;
}

export interface MessageTemplate {
  name: string;
  language: string;
  parameters?: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    text?: string;
    currency?: { fallback_value: string; code: string; amount_1000: number };
    date_time?: { fallback_value: string };
    image?: { link: string };
    document?: { link: string; filename?: string };
    video?: { link: string };
  }>;
}

export interface CloudAPIMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'image' | 'document' | 'video' | 'audio' | 'template';
  text?: { body: string };
  image?: { link: string; caption?: string };
  document?: { link: string; caption?: string; filename?: string };
  video?: { link: string; caption?: string };
  audio?: { link: string };
  template?: {
    name: string;
    language: { code: string };
    components?: Array<{
      type: 'header' | 'body' | 'button';
      parameters?: Array<{
        type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
        text?: string;
        currency?: { fallback_value: string; code: string; amount_1000: number };
        date_time?: { fallback_value: string };
        image?: { link: string };
        document?: { link: string; filename?: string };
        video?: { link: string };
      }>;
    }>;
  };
}

class EvolutionAPIService {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;
  private maxRetries: number;
  private retryDelay: number;

  constructor() {
    this.baseURL = process.env.EVOLUTION_API_BASE_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    this.maxRetries = process.env.NODE_ENV === 'test' ? 0 : parseInt(process.env.EVOLUTION_API_MAX_RETRIES || '3');
    this.retryDelay = parseInt(process.env.EVOLUTION_API_RETRY_DELAY || '1000');
    
    // Validate API configuration
    if (!this.baseURL || !this.apiKey) {
      throw new Error('Evolution API configuration is missing. Please check EVOLUTION_API_BASE_URL and EVOLUTION_API_KEY.');
    }
    
    // Validate API key format (should be at least 32 characters for security)
    if (this.apiKey.length < 32) {
      console.warn('⚠️  Evolution API key appears to be weak. Consider using a stronger key.');
    }
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: parseInt(process.env.EVOLUTION_API_TIMEOUT || '30000'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'User-Agent': 'WhatsApp-SaaS-Worker/2.0.0',
        'X-Request-ID': this.generateRequestId(),
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    this.client.interceptors.request.use((config) => {
      // Add security headers
      if (config.headers) {
        config.headers['X-Request-ID'] = this.generateRequestId();
        config.headers['X-Request-Timestamp'] = new Date().toISOString();
      }
      
      // Validate request data
      if (config.data) {
        this.validateRequestData(config.data);
      }
      
      console.log(`🔗 Evolution API Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    }, (error) => {
      console.error('❌ Evolution API Request Interceptor Error:', error);
      return Promise.reject(error);
    });

    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ Evolution API Response: ${response.status} ${response.statusText}`);
        
        // Log response for audit purposes
        this.logApiResponse(response);
        
        return response;
      },
      (error) => {
        console.error(`❌ Evolution API Error: ${error.response?.status} ${error.response?.statusText}`);
        
        // Log error for security monitoring
        this.logApiError(error);
        
        // Handle specific error cases
        if (error.response?.status === 401) {
          console.error('🚨 Evolution API Authentication Failed - Check API Key');
        } else if (error.response?.status === 403) {
          console.error('🚨 Evolution API Access Forbidden - Check Permissions');
        } else if (error.response?.status === 429) {
          console.warn('⚠️  Evolution API Rate Limit Exceeded');
        }
        
        return Promise.reject(error);
      }
    );
  }

  async sendTextMessage(
    instanceKey: string,
    phone: string,
    message: string
  ): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      // Validate input parameters
      this.validateInstanceKey(instanceKey);
      this.validatePhoneNumber(phone);
      this.validateMessage(message);
      
      const payload = {
        number: this.formatPhoneNumber(phone),
        text: this.sanitizeMessage(message)
      };

      const response = await this.client.post(
        `/message/sendText/${this.sanitizeInstanceKey(instanceKey)}`,
        payload
      );

      return {
        success: true,
        data: response.data,
        messageId: response.data?.messageId || response.data?.key?.id
      };
    });
  }

  async sendMediaMessage(
    instanceKey: string,
    phone: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'video' | 'audio' | 'document' = 'image'
  ): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      // Validate input parameters
      this.validateInstanceKey(instanceKey);
      this.validatePhoneNumber(phone);
      this.validateMediaUrl(mediaUrl);
      if (caption) this.validateMessage(caption);
      
      const payload = {
        number: this.formatPhoneNumber(phone),
        mediaMessage: {
          mediaUrl: this.sanitizeUrl(mediaUrl),
          caption: caption ? this.sanitizeMessage(caption) : undefined,
          mediaType
        }
      };

      const response = await this.client.post(
        `/message/sendMedia/${this.sanitizeInstanceKey(instanceKey)}`,
        payload
      );

      return {
        success: true,
        data: response.data,
        messageId: response.data?.messageId || response.data?.key?.id
      };
    });
  }
  
  private validateMediaUrl(url: string): void {
    if (!url || typeof url !== 'string') {
      throw new Error('Media URL is required');
    }
    
    try {
      const urlObj = new URL(url);
      
      // Only allow HTTPS URLs for security
      if (urlObj.protocol !== 'https:') {
        throw new Error('Only HTTPS URLs are allowed for media');
      }
      
      // Check for suspicious domains
      const suspiciousDomains = ['localhost', '127.0.0.1', '0.0.0.0', '10.', '192.168.', '172.'];
      if (suspiciousDomains.some(domain => urlObj.hostname.includes(domain))) {
        throw new Error('Media URL contains suspicious domain');
      }
      
    } catch (error) {
      throw new Error('Invalid media URL format');
    }
  }
  
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.toString();
    } catch (error) {
      throw new Error('Invalid URL format');
    }
  }

  async getInstanceStatus(instanceKey: string): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get(`/instance/connectionState/${instanceKey}`);
      
      return {
        success: true,
        data: response.data
      };
    });
  }

  // Cloud API specific methods
  async createCloudAPIInstance(config: InstanceConfig): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      this.validateCloudAPIConfig(config);
      
      const payload = {
        instanceName: config.instanceName,
        token: this.apiKey,
        qrcode: config.qrcode || false,
        integration: config.integration,
        cloudApiConfig: config.cloudApiConfig,
        webhook: config.webhookUrl,
        webhookByEvents: config.webhookByEvents || false,
        events: [
          'MESSAGE_RECEIVED',
          'MESSAGE_STATUS_UPDATE',
          'INSTANCE_STATUS_UPDATE',
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE'
        ]
      };

      const response = await this.client.post('/instance/create', payload);
      
      console.log(`✅ Cloud API instance created: ${config.instanceName}`);
      
      return {
        success: true,
        data: response.data
      };
    });
  }

  async sendCloudAPIMessage(
    instanceKey: string,
    message: CloudAPIMessage
  ): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      this.validateInstanceKey(instanceKey);
      this.validateCloudAPIMessage(message);
      
      const response = await this.client.post(
        `/message/sendMessage/${this.sanitizeInstanceKey(instanceKey)}`,
        message
      );

      console.log(`✅ Cloud API message sent to ${message.to}`);
      
      return {
        success: true,
        data: response.data,
        messageId: response.data?.messageId || response.data?.messages?.[0]?.id
      };
    });
  }

  async sendCloudAPITemplate(
    instanceKey: string,
    phone: string,
    template: MessageTemplate
  ): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      this.validateInstanceKey(instanceKey);
      this.validatePhoneNumber(phone);
      this.validateMessageTemplate(template);
      
      const message: CloudAPIMessage = {
        messaging_product: 'whatsapp',
        to: this.formatPhoneNumber(phone),
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language },
          components: template.parameters ? [{
            type: 'body',
            parameters: template.parameters
          }] : undefined
        }
      };

      return this.sendCloudAPIMessage(instanceKey, message);
    });
  }

  async getCloudAPIInstanceStatus(instanceKey: string): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      this.validateInstanceKey(instanceKey);
      
      const response = await this.client.get(`/instance/status/${instanceKey}`);
      
      return {
        success: true,
        data: {
          ...response.data,
          isCloudAPI: response.data?.integration === 'WHATSAPP-CLOUD-API'
        }
      };
    });
  }

  async updateCloudAPIWebhook(
    instanceKey: string,
    webhookUrl: string,
    events?: string[]
  ): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      this.validateInstanceKey(instanceKey);
      this.validateWebhookUrl(webhookUrl);
      
      const payload = {
        webhook: webhookUrl,
        webhookByEvents: true,
        events: events || [
          'MESSAGE_RECEIVED',
          'MESSAGE_STATUS_UPDATE',
          'INSTANCE_STATUS_UPDATE'
        ]
      };

      const response = await this.client.put(`/webhook/set/${instanceKey}`, payload);
      
      return {
        success: true,
        data: response.data
      };
    });
  }

  // Legacy Baileys methods (backwards compatibility)
  async createInstance(instanceName: string): Promise<EvolutionAPIResponse> {
    const config: InstanceConfig = {
      instanceName,
      instanceKey: instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true
    };
    
    return this.createBaileysInstance(config);
  }

  async createBaileysInstance(config: InstanceConfig): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      const payload = {
        instanceName: config.instanceName,
        token: this.apiKey,
        qrcode: config.qrcode || true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: config.webhookUrl,
        webhookByEvents: config.webhookByEvents || false
      };

      const response = await this.client.post('/instance/create', payload);
      
      console.log(`✅ Baileys instance created: ${config.instanceName}`);
      
      return {
        success: true,
        data: response.data
      };
    });
  }

  async deleteInstance(instanceKey: string): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.delete(`/instance/delete/${instanceKey}`);
      
      return {
        success: true,
        data: response.data
      };
    });
  }

  async getQRCode(instanceKey: string): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get(`/instance/connect/${instanceKey}`);
      
      return {
        success: true,
        data: response.data
      };
    });
  }

  async logout(instanceKey: string): Promise<EvolutionAPIResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.delete(`/instance/logout/${instanceKey}`);
      
      return {
        success: true,
        data: response.data
      };
    });
  }

  formatPhoneNumber(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      throw new Error('Invalid phone number format');
    }
    
    let cleaned = phone.replace(/\D/g, '');
    
    // Validate phone number length
    if (cleaned.length < 10 || cleaned.length > 15) {
      throw new Error('Phone number must be between 10 and 15 digits');
    }
    
    if (cleaned.startsWith('55') && cleaned.length === 13) {
      return cleaned;
    }
    
    if (cleaned.startsWith('55') && cleaned.length === 12) {
      return cleaned;
    }
    
    if (cleaned.length === 11 && cleaned.startsWith('11')) {
      return '55' + cleaned;
    }
    
    if (cleaned.length === 10) {
      return '55' + cleaned;
    }
    
    return cleaned;
  }

  isValidPhone(phone: string): boolean {
    if (!phone || typeof phone !== 'string') {
      return false;
    }
    
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }
  
  // Security validation methods
  private validateInstanceKey(instanceKey: string): void {
    if (!instanceKey || typeof instanceKey !== 'string') {
      throw new Error('Instance key is required');
    }
    
    if (instanceKey.length < 3 || instanceKey.length > 100) {
      throw new Error('Instance key must be between 3 and 100 characters');
    }
    
    // Check for potentially dangerous characters
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceKey)) {
      throw new Error('Instance key contains invalid characters');
    }
  }
  
  private validatePhoneNumber(phone: string): void {
    if (!phone || typeof phone !== 'string') {
      throw new Error('Phone number is required');
    }
    
    if (!this.isValidPhone(phone)) {
      throw new Error('Invalid phone number format');
    }
    
    // Check for suspicious patterns
    if (phone.includes('..') || phone.includes('//')) {
      throw new Error('Phone number contains suspicious patterns');
    }
  }
  
  private validateMessage(message: string): void {
    if (!message || typeof message !== 'string') {
      throw new Error('Message is required');
    }
    
    if (message.length > 4096) {
      throw new Error('Message is too long (max 4096 characters)');
    }
    
    // Check for potentially dangerous content
    const dangerousPatterns = [
      /<script[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[\s\S]*?<\/iframe>/gi,
    ];
    
    if (dangerousPatterns.some(pattern => pattern.test(message))) {
      throw new Error('Message contains potentially dangerous content');
    }
  }
  
  private sanitizeInstanceKey(instanceKey: string): string {
    return instanceKey.replace(/[^a-zA-Z0-9_-]/g, '');
  }
  
  private sanitizeMessage(message: string): string {
    return message
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .trim();
  }
  
  private sanitizeErrorMessage(error: string): string {
    if (!error || typeof error !== 'string') {
      return 'Unknown error occurred';
    }
    
    // Remove sensitive information from error messages
    return error
      .replace(/Bearer\s+[A-Za-z0-9_-]+/gi, 'Bearer ***')
      .replace(/api[_-]?key["']?\s*[:=]\s*["']?[A-Za-z0-9_-]+/gi, 'api_key: ***')
      .replace(/password["']?\s*[:=]\s*["']?\w+/gi, 'password: ***')
      .replace(/secret["']?\s*[:=]\s*["']?\w+/gi, 'secret: ***')
      .substring(0, 500); // Limit error message length
  }
  
  private generateRequestId(): string {
    return crypto.randomBytes(8).toString('hex');
  }
  
  private validateRequestData(data: any): void {
    if (!data || typeof data !== 'object') {
      return;
    }
    
    // Check for injection attempts in request data
    const dataString = JSON.stringify(data);
    const dangerousPatterns = [
      /<script[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /function\s*\(/gi,
    ];
    
    if (dangerousPatterns.some(pattern => pattern.test(dataString))) {
      throw new Error('Request data contains potentially dangerous content');
    }
  }
  
  private logApiResponse(response: any): void {
    // Log successful API responses for audit purposes
    console.log('📊 Evolution API Response:', {
      status: response.status,
      url: response.config?.url,
      method: response.config?.method?.toUpperCase(),
      timestamp: new Date().toISOString(),
      requestId: response.config?.headers?.['X-Request-ID'],
    });
  }
  
  private logApiError(error: any): void {
    // Log API errors for security monitoring
    console.error('🚨 Evolution API Error:', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      error: this.sanitizeErrorMessage(error.message),
      timestamp: new Date().toISOString(),
      requestId: error.config?.headers?.['X-Request-ID'],
    });
  }

  // Retry mechanism with exponential backoff
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      console.error(`Evolution API operation failed (attempt ${retryCount + 1}/${this.maxRetries + 1}):`, error.response?.data || error.message);
      
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        const delay = this.retryDelay * Math.pow(2, retryCount); // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(operation, retryCount + 1);
      }
      
      // Return structured error response instead of throwing
      return {
        success: false,
        error: this.sanitizeErrorMessage(error.response?.data?.message || error.message),
        data: error.response?.data
      } as T;
    }
  }

  private isRetryableError(error: any): boolean {
    const status = error.response?.status;
    // Don't retry on validation errors (thrown by our own validation)
    if (error.message && (
      error.message.includes('is required') ||
      error.message.includes('Invalid') ||
      error.message.includes('must be') ||
      error.message.includes('contains')
    )) {
      return false;
    }
    // Retry on network errors, 5xx errors, and rate limits
    return !status || status >= 500 || status === 429 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
  }

  // Cloud API validation methods
  private validateCloudAPIConfig(config: InstanceConfig): void {
    if (config.integration === 'WHATSAPP-CLOUD-API') {
      if (!config.cloudApiConfig) {
        throw new Error('Cloud API configuration is required for WHATSAPP-CLOUD-API integration');
      }
      
      const { accessToken, phoneNumberId, businessAccountId } = config.cloudApiConfig;
      
      if (!accessToken || typeof accessToken !== 'string') {
        throw new Error('Cloud API access token is required');
      }
      
      if (!phoneNumberId || typeof phoneNumberId !== 'string') {
        throw new Error('Cloud API phone number ID is required');
      }
      
      if (!businessAccountId || typeof businessAccountId !== 'string') {
        throw new Error('Cloud API business account ID is required');
      }
      
      // Validate access token format (should start with EAA)
      if (!accessToken.startsWith('EAA')) {
        console.warn('⚠️  Cloud API access token may be invalid (should start with EAA)');
      }
    }
  }

  private validateCloudAPIMessage(message: CloudAPIMessage): void {
    if (!message.messaging_product || message.messaging_product !== 'whatsapp') {
      throw new Error('messaging_product must be "whatsapp"');
    }
    
    if (!message.to || typeof message.to !== 'string') {
      throw new Error('Recipient phone number is required');
    }
    
    if (!message.type || !['text', 'image', 'document', 'video', 'audio', 'template'].includes(message.type)) {
      throw new Error('Invalid message type');
    }
    
    // Validate message content based on type
    switch (message.type) {
      case 'text':
        if (!message.text?.body) {
          throw new Error('Text message body is required');
        }
        break;
      case 'template':
        if (!message.template?.name || !message.template?.language?.code) {
          throw new Error('Template name and language are required');
        }
        break;
      case 'image':
      case 'document':
      case 'video':
      case 'audio':
        const mediaField = message[message.type];
        if (!mediaField?.link) {
          throw new Error(`${message.type} link is required`);
        }
        this.validateMediaUrl(mediaField.link);
        break;
    }
  }

  private validateMessageTemplate(template: MessageTemplate): void {
    if (!template.name || typeof template.name !== 'string') {
      throw new Error('Template name is required');
    }
    
    if (!template.language || typeof template.language !== 'string') {
      throw new Error('Template language is required');
    }
    
    // Validate template name format
    if (!/^[a-z0-9_]+$/.test(template.name)) {
      throw new Error('Template name must contain only lowercase letters, numbers, and underscores');
    }
    
    // Validate language code format (e.g., en_US, pt_BR)
    if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(template.language)) {
      throw new Error('Template language must be in format: en_US, pt_BR, etc.');
    }
  }

  private validateWebhookUrl(url: string): void {
    if (!url || typeof url !== 'string') {
      throw new Error('Webhook URL is required');
    }
    
    try {
      const urlObj = new URL(url);
      
      // Only allow HTTPS URLs for security
      if (urlObj.protocol !== 'https:') {
        throw new Error('Webhook URL must use HTTPS');
      }
      
    } catch (error) {
      throw new Error('Invalid webhook URL format');
    }
  }

  // Utility methods for integration detection
  async detectInstanceIntegration(instanceKey: string): Promise<'WHATSAPP-BAILEYS' | 'WHATSAPP-CLOUD-API' | null> {
    try {
      const status = await this.getInstanceStatus(instanceKey);
      if (status.success && status.data?.integration) {
        return status.data.integration;
      }
      return null;
    } catch (error) {
      console.error('Error detecting instance integration:', error);
      return null;
    }
  }

  // Smart message sending that detects integration type
  async sendMessage(
    instanceKey: string,
    phone: string,
    message: string,
    integration?: 'WHATSAPP-BAILEYS' | 'WHATSAPP-CLOUD-API'
  ): Promise<EvolutionAPIResponse> {
    // Auto-detect integration if not provided
    if (!integration) {
      integration = await this.detectInstanceIntegration(instanceKey) || 'WHATSAPP-BAILEYS';
    }
    
    if (integration === 'WHATSAPP-CLOUD-API') {
      const cloudMessage: CloudAPIMessage = {
        messaging_product: 'whatsapp',
        to: this.formatPhoneNumber(phone),
        type: 'text',
        text: { body: this.sanitizeMessage(message) }
      };
      
      return this.sendCloudAPIMessage(instanceKey, cloudMessage);
    } else {
      return this.sendTextMessage(instanceKey, phone, message);
    }
  }
}

export default new EvolutionAPIService();