/**
 * WhatsApp Validators
 * Validation schemas for WhatsApp integration with Evolution API
 */

import { z } from 'zod';
import { sanitizeInput, hasInjectionAttempt } from './globalValidators.js';

/**
 * Phone number validation for WhatsApp
 * Format: Country code + area code + number (without symbols)
 * Examples: 5511999999999, 1234567890
 */
export const WhatsAppPhoneSchema = z
  .string()
  .min(10, 'Phone number too short')
  .max(15, 'Phone number too long')
  .regex(/^\d+$/, 'Phone number must contain only digits')
  .transform(val => val.replace(/\D/g, '')) // Remove any non-digit characters
  .refine(val => val.length >= 10 && val.length <= 15, {
    message: 'Phone number must be between 10 and 15 digits'
  })
  .refine(val => !val.startsWith('0'), {
    message: 'Phone number cannot start with 0 (include country code)'
  });

/**
 * WhatsApp message text validation
 * Includes XSS protection and length limits
 */
export const WhatsAppMessageSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(4096, 'Message too long (max 4096 characters)')
  .transform(val => sanitizeInput(val))
  .refine(val => !hasInjectionAttempt(val), {
    message: 'Message contains potentially dangerous content'
  });

/**
 * WhatsApp message priority validation
 */
export const WhatsAppPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']).default('normal');

/**
 * WhatsApp message type validation
 */
export const WhatsAppMessageTypeSchema = z
  .enum(['notification', 'alert', 'info', 'marketing', 'support'])
  .default('notification');

/**
 * WhatsApp presence status validation
 */
export const WhatsAppPresenceSchema = z.enum(['composing', 'recording', 'paused']).optional();

/**
 * Complete WhatsApp send message validation schema
 */
export const WhatsAppSendMessageSchema = z.object({
  number: WhatsAppPhoneSchema,
  message: WhatsAppMessageSchema,
  userId: z.string().optional(),
  messageType: WhatsAppMessageTypeSchema.optional(),
  priority: WhatsAppPrioritySchema.optional(),
  options: z
    .object({
      delay: z.number().min(0).max(30000).optional(), // Max 30 seconds delay
      presence: WhatsAppPresenceSchema,
      linkPreview: z.boolean().optional()
    })
    .optional()
});

/**
 * WhatsApp media message validation
 */
export const WhatsAppMediaSchema = z.object({
  number: WhatsAppPhoneSchema,
  mediaType: z.enum(['image', 'video', 'audio', 'document']),
  fileName: z.string().min(1).max(255).optional(),
  caption: z
    .string()
    .max(1024)
    .transform(val => sanitizeInput(val))
    .optional(),
  media: z.string().min(1, 'Media content is required'), // base64 or URL
  userId: z.string().optional(),
  options: z
    .object({
      delay: z.number().min(0).max(30000).optional(),
      presence: WhatsAppPresenceSchema
    })
    .optional()
});

/**
 * Validation functions for easy use
 */
export const WhatsAppValidators = {
  /**
   * Validates WhatsApp phone number
   */
  validatePhone: (phone: unknown) => WhatsAppPhoneSchema.parse(phone),

  /**
   * Validates WhatsApp message text
   */
  validateMessage: (message: unknown) => WhatsAppMessageSchema.parse(message),

  /**
   * Validates complete send message data
   */
  validateSendMessage: (data: unknown) => WhatsAppSendMessageSchema.parse(data),

  /**
   * Validates media message data
   */
  validateMediaMessage: (data: unknown) => WhatsAppMediaSchema.parse(data),

  /**
   * Safe validation that returns result with error info
   */
  safeParse: {
    phone: (phone: unknown) => WhatsAppPhoneSchema.safeParse(phone),
    message: (message: unknown) => WhatsAppMessageSchema.safeParse(message),
    sendMessage: (data: unknown) => WhatsAppSendMessageSchema.safeParse(data),
    mediaMessage: (data: unknown) => WhatsAppMediaSchema.safeParse(data)
  }
};
