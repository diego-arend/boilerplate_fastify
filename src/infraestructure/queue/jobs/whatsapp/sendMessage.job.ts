/**
 * WhatsApp Message Send Job Handler - Specialized & Self-Contained
 * Sends WhatsApp messages via Evolution API through the queue system
 */

import type { FastifyBaseLogger } from 'fastify';
import { EvolutionApiService } from '../../../evolution/index.js';
import type { SendTextMessageData } from '../../../evolution/index.js';

export interface WhatsAppMessageJobData {
  number: string; // Formato: 5511999999999
  message: string;
  userId?: string;
  messageType?: 'notification' | 'alert' | 'info' | 'marketing';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  options?: {
    delay?: number;
    presence?: 'composing' | 'recording' | 'paused';
    linkPreview?: boolean;
  };
}

export interface WhatsAppMessageJobResult {
  success: boolean;
  jobId: string;
  messageId?: string;
  error?: string;
  processingTime: number;
  userId?: string;
  movedToDLQ?: boolean;
  dlqReason?: string;
}

/**
 * Specialized WhatsApp message job handler - handles everything internally
 */
export async function handleWhatsAppMessageJob(
  data: WhatsAppMessageJobData,
  jobId: string,
  logger: FastifyBaseLogger
): Promise<WhatsAppMessageJobResult> {
  const startTime = Date.now();
  const {
    number,
    message,
    userId,
    messageType = 'notification',
    priority = 'normal',
    options
  } = data;

  logger.info(
    {
      jobId,
      number: maskNumber(number),
      messageType,
      priority,
      userId
    },
    'Starting WhatsApp message job processing'
  );

  try {
    // Create Evolution API service instance
    const evolutionService = new EvolutionApiService();

    // Prepare message data
    const messageData: SendTextMessageData = {
      number,
      text: message,
      ...(options && { options })
    };

    // Send message using Evolution API service
    const result = await evolutionService.sendTextMessage(messageData);

    // Log success
    logger.info(
      {
        jobId,
        messageId: result.key.id,
        number: maskNumber(number),
        status: result.status,
        messageType,
        userId,
        processingTime: Date.now() - startTime
      },
      'WhatsApp message sent successfully'
    );

    // Return result for job completion
    return {
      success: true,
      jobId,
      messageId: result.key.id,
      processingTime: Date.now() - startTime,
      ...(userId && { userId })
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        jobId,
        error: errorMessage,
        number: maskNumber(number),
        messageType,
        userId,
        processingTime
      },
      'Failed to send WhatsApp message'
    );

    // Return error result
    return {
      success: false,
      jobId,
      error: errorMessage,
      processingTime,
      ...(userId && { userId })
    };
  }
}

/**
 * Masks phone number for logging (security)
 * @param number - Phone number to mask
 * @returns Masked phone number
 */
function maskNumber(number: string): string {
  if (number.length < 8) return number;
  const start = number.slice(0, 4);
  const end = number.slice(-4);
  const middle = '*'.repeat(number.length - 8);
  return `${start}${middle}${end}`;
}
