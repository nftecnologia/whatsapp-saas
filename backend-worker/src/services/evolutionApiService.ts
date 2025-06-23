import axios, { AxiosInstance } from 'axios';
import { EvolutionAPIResponse } from '@/types';

class EvolutionAPIService {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = process.env.EVOLUTION_API_BASE_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    this.client.interceptors.request.use((config) => {
      console.log(`🔗 Evolution API Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ Evolution API Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        console.error(`❌ Evolution API Error: ${error.response?.status} ${error.response?.statusText}`);
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
      const payload = {
        number: phone.replace(/\D/g, ''),
        text: message
      };

      const response = await this.client.post(
        `/message/sendText/${instanceKey}`,
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
        error: error.response?.data?.message || error.message,
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
      const payload = {
        number: phone.replace(/\D/g, ''),
        mediaMessage: {
          mediaUrl,
          caption,
          mediaType
        }
      };

      const response = await this.client.post(
        `/message/sendMedia/${instanceKey}`,
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
        error: error.response?.data?.message || error.message,
        data: error.response?.data
      };
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
    let cleaned = phone.replace(/\D/g, '');
    
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
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }
}

export default new EvolutionAPIService();