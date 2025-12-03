/**
 * Evolution API Service - WhatsApp Integration
 * Official documentation: https://doc.evolution-api.com
 *
 * Uses native Node.js Fetch API (Node.js 18+)
 *
 * Endpoints encontrados na documentação oficial:
 * - POST /message/sendText/{instance} - Envio de texto simples
 * - POST /message/sendMedia/{instance} - Envio de mídia
 * - POST /message/sendTemplate/{instance} - Envio de templates (WhatsApp Business)
 */

import { defaultLogger } from '../../lib/logger/index.js';
import { config } from '../../lib/validators/validateEnv.js';

export interface EvolutionApiConfig {
  baseUrl?: string; // Optional - reads from EVOLUTION_API_URL if not provided
  apiKey?: string; // Optional - reads from EVOLUTION_API_KEY if not provided
  instance?: string; // Optional - reads from EVOLUTION_INSTANCE if not provided
}

export interface SendTextMessageData {
  number: string; // Formato: 5511999999999 (sem símbolos)
  text: string;
  options?: {
    delay?: number;
    presence?: 'composing' | 'recording' | 'paused';
    linkPreview?: boolean;
  };
}

export interface SendMediaMessageData {
  number: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  fileName?: string;
  caption?: string;
  media: string; // base64 ou URL pública
  options?: {
    delay?: number;
    presence?: 'composing' | 'recording' | 'paused';
  };
}

export interface EvolutionApiResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: any;
  messageTimestamp: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ';
}

export class EvolutionApiService {
  private logger = defaultLogger.child({ context: 'evolution-api-service' });
  private baseUrl: string;
  private apiKey: string;
  private instance: string;

  constructor(overrides: EvolutionApiConfig = {}) {
    // Read from validated environment config with override support
    this.baseUrl = overrides.baseUrl || config.EVOLUTION_API_URL || '';
    this.apiKey = overrides.apiKey || config.EVOLUTION_API_KEY || '';
    this.instance = overrides.instance || config.EVOLUTION_INSTANCE || '';

    // Validate required configuration
    if (!this.baseUrl) {
      throw new Error(
        'Evolution API base URL is required (EVOLUTION_API_URL environment variable or config.baseUrl)'
      );
    }
    if (!this.apiKey) {
      throw new Error(
        'Evolution API key is required (EVOLUTION_API_KEY environment variable or config.apiKey)'
      );
    }
    if (!this.instance) {
      throw new Error(
        'Evolution API instance is required (EVOLUTION_INSTANCE environment variable or config.instance)'
      );
    }

    this.logger.info(
      {
        baseUrl: this.baseUrl,
        instance: this.instance
      },
      'Evolution API Service initialized'
    );
  }

  /**
   * Sends a text message via Evolution API
   * Endpoint: POST /message/sendText/{instance}
   * @param data - Message data containing number and text
   * @returns Evolution API response
   */
  async sendTextMessage(data: SendTextMessageData): Promise<EvolutionApiResponse> {
    const url = `${this.baseUrl}/message/sendText/${this.instance}`;

    const payload = {
      number: data.number,
      textMessage: {
        text: data.text
      },
      ...(data.options && { options: data.options })
    };

    this.logger.info(
      {
        number: this.maskNumber(data.number),
        textLength: data.text.length
      },
      'Sending text message via Evolution API'
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
      }

      const result: EvolutionApiResponse = await response.json();

      this.logger.info(
        {
          messageId: result.key.id,
          number: this.maskNumber(data.number),
          status: result.status
        },
        'Text message sent successfully'
      );

      return result;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          number: this.maskNumber(data.number)
        },
        'Failed to send text message'
      );
      throw error;
    }
  }

  /**
   * Sends a media message via Evolution API
   * Endpoint: POST /message/sendMedia/{instance}
   * @param data - Media message data
   * @returns Evolution API response
   */
  async sendMediaMessage(data: SendMediaMessageData): Promise<EvolutionApiResponse> {
    const url = `${this.baseUrl}/message/sendMedia/${this.instance}`;

    const payload = {
      number: data.number,
      mediaMessage: {
        mediaType: data.mediaType,
        ...(data.fileName && { fileName: data.fileName }),
        ...(data.caption && { caption: data.caption }),
        media: data.media
      },
      ...(data.options && { options: data.options })
    };

    this.logger.info(
      {
        number: this.maskNumber(data.number),
        mediaType: data.mediaType,
        hasCaption: !!data.caption
      },
      'Sending media message via Evolution API'
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
      }

      const result: EvolutionApiResponse = await response.json();

      this.logger.info(
        {
          messageId: result.key.id,
          number: this.maskNumber(data.number),
          mediaType: data.mediaType,
          status: result.status
        },
        'Media message sent successfully'
      );

      return result;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          number: this.maskNumber(data.number),
          mediaType: data.mediaType
        },
        'Failed to send media message'
      );
      throw error;
    }
  }

  /**
   * Checks if the Evolution API instance is connected
   * @returns Connection status
   */
  async checkConnection(): Promise<{ connected: boolean; status?: string }> {
    const url = `${this.baseUrl}/instance/connect/${this.instance}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: this.apiKey
        }
      });

      if (!response.ok) {
        return { connected: false, status: `HTTP ${response.status}` };
      }

      const result = await response.json();
      return { connected: true, status: result.instance?.state || 'connected' };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'Failed to check Evolution API connection'
      );
      return { connected: false, status: 'error' };
    }
  }

  /**
   * Masks phone number for logging (security)
   * @param number - Phone number to mask
   * @returns Masked phone number
   */
  private maskNumber(number: string): string {
    if (number.length < 8) return number;
    const start = number.slice(0, 4);
    const end = number.slice(-4);
    const middle = '*'.repeat(number.length - 8);
    return `${start}${middle}${end}`;
  }
}

/**
 * Factory function to create Evolution API service with environment configuration
 * @param overrides - Optional configuration overrides
 * @returns Configured Evolution API service instance
 */
export function createEvolutionApiService(overrides: EvolutionApiConfig = {}): EvolutionApiService {
  return new EvolutionApiService(overrides);
}
