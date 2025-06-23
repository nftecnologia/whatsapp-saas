import { jest } from '@jest/globals';
import axios from 'axios';
import evolutionApiService from '@/services/evolutionApiService';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// Create a mock axios instance
const mockAxiosInstance = {
  post: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

describe('EvolutionAPIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios.create to return our mock instance
    mockAxios.create.mockReturnValue(mockAxiosInstance as any);
    
    // Reset environment variables
    process.env.EVOLUTION_API_BASE_URL = 'http://test-api.com';
    process.env.EVOLUTION_API_KEY = 'test-api-key';
  });

  describe('sendTextMessage', () => {
    it('should successfully send a text message', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+5511999999999';
      const message = 'Test message';
      const mockResponse = {
        status: 200,
        data: {
          messageId: 'msg-123',
          key: { id: 'msg-123' },
          status: 'sent'
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.sendTextMessage(instanceKey, phone, message);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/message/sendText/${instanceKey}`,
        {
          number: phone.replace(/\D/g, ''),
          text: message
        }
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data,
        messageId: 'msg-123'
      });
    });

    it('should handle API error response', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+5511999999999';
      const message = 'Test message';
      const mockError = {
        response: {
          status: 400,
          data: {
            message: 'Instance not found'
          }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      // Act
      const result = await evolutionApiService.sendTextMessage(instanceKey, phone, message);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Instance not found',
        data: mockError.response.data
      });
    });

    it('should handle network error', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+5511999999999';
      const message = 'Test message';
      const mockError = new Error('Network error');

      mockAxiosInstance.post.mockRejectedValue(mockError);

      // Act
      const result = await evolutionApiService.sendTextMessage(instanceKey, phone, message);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Network error',
        data: undefined
      });
    });

    it('should clean phone number before sending', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+55 (11) 99999-9999';
      const message = 'Test message';
      const mockResponse = { status: 200, data: { messageId: 'msg-123' } };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      await evolutionApiService.sendTextMessage(instanceKey, phone, message);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/message/sendText/${instanceKey}`,
        {
          number: '5511999999999', // Should be cleaned
          text: message
        }
      );
    });
  });

  describe('sendMediaMessage', () => {
    it('should successfully send a media message', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+5511999999999';
      const mediaUrl = 'https://example.com/image.jpg';
      const caption = 'Test caption';
      const mediaType = 'image' as const;
      const mockResponse = {
        status: 200,
        data: {
          messageId: 'msg-123',
          key: { id: 'msg-123' }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.sendMediaMessage(
        instanceKey, 
        phone, 
        mediaUrl, 
        caption, 
        mediaType
      );

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/message/sendMedia/${instanceKey}`,
        {
          number: phone.replace(/\D/g, ''),
          mediaMessage: {
            mediaUrl,
            caption,
            mediaType
          }
        }
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data,
        messageId: 'msg-123'
      });
    });

    it('should handle media message error', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const phone = '+5511999999999';
      const mediaUrl = 'https://example.com/image.jpg';
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Invalid media URL' }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      // Act
      const result = await evolutionApiService.sendMediaMessage(instanceKey, phone, mediaUrl);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Invalid media URL',
        data: mockError.response.data
      });
    });
  });

  describe('getInstanceStatus', () => {
    it('should successfully get instance status', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const mockResponse = {
        status: 200,
        data: {
          instance: instanceKey,
          state: 'open'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.getInstanceStatus(instanceKey);

      // Assert
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/instance/connectionState/${instanceKey}`
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });
    });

    it('should handle instance status error', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const mockError = {
        response: {
          status: 404,
          data: { message: 'Instance not found' }
        }
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      // Act
      const result = await evolutionApiService.getInstanceStatus(instanceKey);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Instance not found',
        data: mockError.response.data
      });
    });
  });

  describe('createInstance', () => {
    it('should successfully create instance', async () => {
      // Arrange
      const instanceName = 'new-instance';
      const mockResponse = {
        status: 201,
        data: {
          instance: {
            instanceName,
            status: 'created'
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.createInstance(instanceName);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/instance/create', {
        instanceName,
        token: 'test-api-key',
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      });
      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });
    });
  });

  describe('deleteInstance', () => {
    it('should successfully delete instance', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const mockResponse = {
        status: 200,
        data: { message: 'Instance deleted' }
      };

      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.deleteInstance(instanceKey);

      // Assert
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        `/instance/delete/${instanceKey}`
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });
    });
  });

  describe('getQRCode', () => {
    it('should successfully get QR code', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const mockResponse = {
        status: 200,
        data: {
          qrcode: 'data:image/png;base64,iVBORw0KGgo...',
          code: 'qr-code-string'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.getQRCode(instanceKey);

      // Assert
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/instance/connect/${instanceKey}`
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });
    });
  });

  describe('logout', () => {
    it('should successfully logout instance', async () => {
      // Arrange
      const instanceKey = 'test-instance';
      const mockResponse = {
        status: 200,
        data: { message: 'Logout successful' }
      };

      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      // Act
      const result = await evolutionApiService.logout(instanceKey);

      // Assert
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        `/instance/logout/${instanceKey}`
      );
      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format Brazilian phone numbers correctly', () => {
      // Test cases for different Brazilian phone number formats
      const testCases = [
        { input: '11999999999', expected: '5511999999999' },
        { input: '1199999999', expected: '551199999999' },
        { input: '5511999999999', expected: '5511999999999' },
        { input: '551199999999', expected: '551199999999' },
        { input: '+55 11 99999-9999', expected: '5511999999999' },
        { input: '(11) 99999-9999', expected: '5511999999999' },
        { input: '9999999999', expected: '559999999999' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = evolutionApiService.formatPhoneNumber(input);
        expect(result).toBe(expected);
      });
    });

    it('should return cleaned number for international formats', () => {
      const internationalNumber = '+1234567890123';
      const result = evolutionApiService.formatPhoneNumber(internationalNumber);
      expect(result).toBe('1234567890123');
    });
  });

  describe('isValidPhone', () => {
    it('should validate phone numbers correctly', () => {
      const validNumbers = [
        '11999999999',
        '+5511999999999',
        '5511999999999',
        '+1234567890',
        '123456789012345'
      ];

      const invalidNumbers = [
        '123456789', // too short
        '1234567890123456', // too long
        '', // empty
        'abc123', // contains letters
      ];

      validNumbers.forEach(phone => {
        expect(evolutionApiService.isValidPhone(phone)).toBe(true);
      });

      invalidNumbers.forEach(phone => {
        expect(evolutionApiService.isValidPhone(phone)).toBe(false);
      });
    });
  });
});