/**
 * WhatsApp Controller - Example implementation
 * Demonstrates how to use Evolution API integration
 */

import type { FastifyInstance } from 'fastify';
import { ApiResponseHandler } from '../../lib/response/index.js';
import { WhatsAppValidators } from '../../lib/validators/whatsapp.validators.js';
import { defaultLogger } from '../../lib/logger/index.js';

const logger = defaultLogger.child({ context: 'whatsapp-controller' });

export default async function whatsappController(fastify: FastifyInstance) {
  // POST /whatsapp/send-message - Send text message
  fastify.post(
    '/send-message',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Send WhatsApp text message via Evolution API',
        tags: ['WhatsApp'],
        summary: 'Send Text Message',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['number', 'message'],
          properties: {
            number: {
              type: 'string',
              description: 'Phone number with country code (digits only)',
              example: '5511999999999'
            },
            message: {
              type: 'string',
              description: 'Message text content',
              example: 'Hello! This is a test message.'
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'urgent'],
              default: 'normal'
            },
            options: {
              type: 'object',
              properties: {
                delay: { type: 'number', minimum: 0, maximum: 30000 },
                presence: { type: 'string', enum: ['composing', 'recording', 'paused'] },
                linkPreview: { type: 'boolean' }
              }
            }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Message sent successfully' },
              code: { type: 'number', example: 201 },
              data: {
                type: 'object',
                properties: {
                  messageId: { type: 'string', example: 'BAE594145F4C59B4' },
                  status: { type: 'string', example: 'PENDING' },
                  timestamp: { type: 'string', example: '1717689097' },
                  number: { type: 'string', example: '5511****9999' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);

      try {
        // Validate input data
        const validationResult = WhatsAppValidators.safeParse.sendMessage(request.body);
        if (!validationResult.success) {
          return ApiResponseHandler.validationError(
            reply,
            'Invalid input data',
            validationResult.error.issues
          );
        }

        const { number, message, priority = 'normal', options } = validationResult.data;

        // Send message using pre-configured Evolution API service
        const messageData: any = {
          number,
          text: message
        };

        // Only add options if they exist and have valid values
        if (options) {
          const validOptions: any = {};
          if (options.delay !== undefined) validOptions.delay = options.delay;
          if (options.presence !== undefined) validOptions.presence = options.presence;
          if (options.linkPreview !== undefined) validOptions.linkPreview = options.linkPreview;

          if (Object.keys(validOptions).length > 0) {
            messageData.options = validOptions;
          }
        }

        const result = await request.server.evolutionApi.sendTextMessage(messageData);

        logger.info(
          {
            requestId,
            messageId: result.key.id,
            number: number.replace(/(\d{4})(\d*)(\d{4})/, '$1****$3'),
            priority,
            userId: request.authenticatedUser?.id
          },
          'WhatsApp message sent successfully'
        );

        return ApiResponseHandler.created(reply, 'Message sent successfully', {
          messageId: result.key.id,
          status: result.status,
          timestamp: result.messageTimestamp,
          number: number.replace(/(\d{4})(\d*)(\d{4})/, '$1****$3')
        });
      } catch (error) {
        logger.error(
          {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            userId: request.authenticatedUser?.id
          },
          'Failed to send WhatsApp message'
        );

        if (error instanceof Error && error.message.includes('Evolution API error')) {
          return ApiResponseHandler.serviceUnavailable(
            reply,
            'WhatsApp service temporarily unavailable'
          );
        }

        return ApiResponseHandler.internalError(reply, 'Failed to send message');
      }
    }
  );

  // POST /whatsapp/send-via-queue - Send message via queue (recommended)
  fastify.post(
    '/send-via-queue',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Schedule WhatsApp message via queue system',
        tags: ['WhatsApp'],
        summary: 'Schedule Message via Queue',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['number', 'message'],
          properties: {
            number: { type: 'string', example: '5511999999999' },
            message: { type: 'string', example: 'Hello from queue!' },
            messageType: {
              type: 'string',
              enum: ['notification', 'alert', 'info', 'marketing', 'support'],
              default: 'notification'
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'urgent'],
              default: 'normal'
            },
            delay: { type: 'number', minimum: 0, description: 'Delay in milliseconds' }
          }
        }
      }
    },
    async (request, reply) => {
      const requestId = request.id || Math.random().toString(36).substr(2, 9);

      try {
        const validationResult = WhatsAppValidators.safeParse.sendMessage(request.body);
        if (!validationResult.success) {
          return ApiResponseHandler.validationError(
            reply,
            'Invalid input data',
            validationResult.error.issues
          );
        }

        const {
          number,
          message,
          messageType = 'notification',
          priority = 'normal'
        } = validationResult.data;
        const { delay } = request.body as any;

        // Prepare job data
        const jobData = {
          number,
          message,
          userId: request.authenticatedUser?.id,
          messageType,
          priority,
          ...((request.body as any).options && { options: (request.body as any).options })
        };

        // Add job to queue
        const jobOptions: any = {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: 10,
          removeOnFail: 5
        };

        if (delay && delay > 0) {
          jobOptions.delay = delay;
        }

        // Set priority in queue
        switch (priority) {
          case 'urgent':
            jobOptions.priority = 10;
            break;
          case 'high':
            jobOptions.priority = 5;
            break;
          case 'normal':
            jobOptions.priority = 1;
            break;
          case 'low':
            jobOptions.priority = 0;
            break;
        }

        const job = (await fastify.persistentQueueManager.addJob(
          'whatsapp:send',
          jobData,
          jobOptions
        )) as any;

        logger.info(
          {
            requestId,
            jobId: job.id,
            number: number.replace(/(\d{4})(\d*)(\d{4})/, '$1****$3'),
            messageType,
            priority,
            userId: request.authenticatedUser?.id
          },
          'WhatsApp message queued successfully'
        );

        return ApiResponseHandler.created(reply, 'Message queued successfully', {
          jobId: job.id,
          priority,
          messageType,
          estimatedDelay: delay || 0,
          queuePosition: await job.getPosition()
        });
      } catch (error) {
        logger.error(
          {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            userId: request.authenticatedUser?.id
          },
          'Failed to queue WhatsApp message'
        );

        return ApiResponseHandler.internalError(reply, 'Failed to queue message');
      }
    }
  );

  // GET /whatsapp/connection-status - Check Evolution API connection
  fastify.get(
    '/connection-status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Check Evolution API connection status',
        tags: ['WhatsApp'],
        summary: 'Check Connection Status',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  connected: { type: 'boolean' },
                  status: { type: 'string' },
                  instance: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        // Get status from connection manager with fresh check
        const connectionStatus = await request.server.evolutionConnectionManager.forceCheck();

        return ApiResponseHandler.success(reply, 'Connection status retrieved', {
          connected: connectionStatus.connected,
          status: connectionStatus.status
        });
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error)
          },
          'Failed to check Evolution API connection'
        );

        return ApiResponseHandler.internalError(reply, 'Failed to check connection status');
      }
    }
  );
}
