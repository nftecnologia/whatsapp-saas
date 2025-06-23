import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { EvolutionAPIResponse } from '@/types';

class EvolutionAPIService {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = process.env.EVOLUTION_API_BASE_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    
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
        'User-Agent': 'WhatsApp-SaaS-Worker/1.0.0',
        'X-Request-ID': this.generateRequestId(),
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    this.client.interceptors.request.use((config) => {
      // Add security headers
      config.headers = {
        ...config.headers,
        'X-Request-ID': this.generateRequestId(),
        'X-Request-Timestamp': new Date().toISOString(),
      };
      
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
    try {
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
    } catch (error: any) {
      console.error('Evolution API sendTextMessage error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: this.sanitizeErrorMessage(error.response?.data?.message || error.message),
        data: error.response?.data
      };
    }
  }

  async sendMediaMessage(
    instanceKey: string,
    phone: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'video' | 'audio' | 'document' = 'image'
  ): Promise<EvolutionAPIResponse> {
    try {
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
    } catch (error: any) {
      console.error('Evolution API sendMediaMessage error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: this.sanitizeErrorMessage(error.response?.data?.message || error.message),
        data: error.response?.data
      };
    }
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
    try {
      const response = await this.client.get(`/instance/connectionState/${instanceKey}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Evolution API getInstanceStatus error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        data: error.response?.data
      };
    }
  }

  async createInstance(instanceName: string): Promise<EvolutionAPIResponse> {
    try {
      const payload = {
        instanceName,
        token: this.apiKey,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      };

      const response = await this.client.post('/instance/create', payload);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Evolution API createInstance error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        data: error.response?.data
      };
    }
  }

  async deleteInstance(instanceKey: string): Promise<EvolutionAPIResponse> {
    try {
      const response = await this.client.delete(`/instance/delete/${instanceKey}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Evolution API deleteInstance error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        data: error.response?.data
      };
    }
  }

  async getQRCode(instanceKey: string): Promise<EvolutionAPIResponse> {
    try {
      const response = await this.client.get(`/instance/connect/${instanceKey}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Evolution API getQRCode error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        data: error.response?.data
      };
    }
  }

  async logout(instanceKey: string): Promise<EvolutionAPIResponse> {
    try {
      const response = await this.client.delete(`/instance/logout/${instanceKey}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Evolution API logout error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        data: error.response?.data
      };
    }
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
}

export default new EvolutionAPIService();