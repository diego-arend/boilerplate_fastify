import type { FastifyBaseLogger } from 'fastify';
import type { UserNotificationJobData, JobResult } from '../../queue.types.js';

/**
 * Handler for USER_NOTIFICATION jobs
 * Processes user notification delivery across multiple channels (push, email, sms)
 *
 * @param data - User notification job data containing userId, message, channels, etc.
 * @param jobId - Unique identifier for the job
 * @param logger - Logger instance with job context
 * @returns Promise<JobResult> - Success/failure result with delivery details
 */
export async function handleUserNotification(
  data: UserNotificationJobData,
  jobId: string,
  logger: FastifyBaseLogger
): Promise<JobResult> {
  const startTime = Date.now();

  logger.info(
    {
      userId: data.userId,
      title: data.title,
      type: data.type,
      channels: data.channels || ['push'],
      hasMetadata: !!data.metadata && Object.keys(data.metadata).length > 0
    },
    'Processing user notification job'
  );

  try {
    // Validate notification data
    validateNotificationData(data);

    // Get notification channels (default to push if not specified)
    const channels = data.channels || ['push'];

    // Process notification for each channel
    const deliveryResults = await Promise.allSettled(
      channels.map(channel => deliverNotification(data, channel, logger))
    );

    const successfulDeliveries = deliveryResults
      .map((result, index) => ({ result, channel: channels[index] }))
      .filter(({ result }) => result.status === 'fulfilled')
      .map(({ result, channel }) => ({
        channel,
        ...(result as PromiseFulfilledResult<any>).value
      }));

    const failedDeliveries = deliveryResults
      .map((result, index) => ({ result, channel: channels[index] }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, channel }) => ({
        channel,
        error: (result as PromiseRejectedResult).reason.message
      }));

    const processingTime = Date.now() - startTime;
    const allChannelsSuccess = failedDeliveries.length === 0;
    const hasPartialSuccess = successfulDeliveries.length > 0;

    if (allChannelsSuccess) {
      logger.info(
        {
          userId: data.userId,
          successfulChannels: successfulDeliveries.length,
          processingTime
        },
        'All notification channels delivered successfully'
      );
    } else if (hasPartialSuccess) {
      logger.warn(
        {
          userId: data.userId,
          successfulChannels: successfulDeliveries.length,
          failedChannels: failedDeliveries.length,
          processingTime
        },
        'Partial notification delivery success'
      );
    } else {
      logger.error(
        {
          userId: data.userId,
          failedChannels: failedDeliveries.length,
          processingTime
        },
        'All notification channels failed'
      );
    }

    return {
      success: hasPartialSuccess, // Success if at least one channel succeeded
      data: {
        notificationId: `notif_${jobId}_${Date.now()}`,
        userId: data.userId,
        title: data.title,
        type: data.type,
        totalChannels: channels.length,
        successfulDeliveries,
        failedDeliveries,
        deliveredAt: new Date().toISOString()
      },
      processedAt: Date.now(),
      processingTime
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown notification error';

    logger.error(
      {
        error,
        processingTime,
        userId: data.userId,
        title: data.title
      },
      'Failed to process notification'
    );

    return {
      success: false,
      error: errorMessage,
      processedAt: Date.now(),
      processingTime
    };
  }
}

/**
 * Validates notification job data
 */
function validateNotificationData(data: UserNotificationJobData): void {
  if (!data.userId || typeof data.userId !== 'string') {
    throw new Error('Valid userId is required for notification');
  }

  if (!data.title || typeof data.title !== 'string') {
    throw new Error('Notification title is required');
  }

  if (!data.message || typeof data.message !== 'string') {
    throw new Error('Notification message is required');
  }

  if (!['info', 'warning', 'success', 'error'].includes(data.type)) {
    throw new Error('Invalid notification type. Must be: info, warning, success, or error');
  }

  // Validate channels if provided
  if (data.channels) {
    const validChannels = ['push', 'email', 'sms'];
    const invalidChannels = data.channels.filter(channel => !validChannels.includes(channel));

    if (invalidChannels.length > 0) {
      throw new Error(
        `Invalid notification channels: ${invalidChannels.join(', ')}. Valid channels: ${validChannels.join(', ')}`
      );
    }
  }

  // Security validation - prevent XSS in notification content
  const dangerousPatterns = ['<script', 'javascript:', 'data:text/html', 'onclick=', 'onerror='];
  const contentToCheck = [data.title, data.message];

  for (const content of contentToCheck) {
    for (const pattern of dangerousPatterns) {
      if (content.toLowerCase().includes(pattern)) {
        throw new Error(`Potentially malicious content detected: ${pattern}`);
      }
    }
  }

  // Length validation
  if (data.title.length > 100) {
    throw new Error('Notification title cannot exceed 100 characters');
  }

  if (data.message.length > 500) {
    throw new Error('Notification message cannot exceed 500 characters');
  }
}

/**
 * Delivers notification through specific channel
 */
async function deliverNotification(
  data: UserNotificationJobData,
  channel: 'push' | 'email' | 'sms',
  logger: FastifyBaseLogger
): Promise<{
  deliveryId: string;
  channel: string;
  deliveredAt: string;
  deliveryTime: number;
}> {
  const deliveryStart = Date.now();

  logger.debug(
    {
      userId: data.userId,
      channel
    },
    `Delivering notification via ${channel}`
  );

  try {
    // Simulate channel-specific delivery
    switch (channel) {
      case 'push':
        await simulatePushNotification(data);
        break;
      case 'email':
        await simulateEmailNotification(data);
        break;
      case 'sms':
        await simulateSmsNotification(data);
        break;
      default:
        throw new Error(`Unsupported notification channel: ${channel}`);
    }

    const deliveryTime = Date.now() - deliveryStart;

    return {
      deliveryId: `${channel}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      channel,
      deliveredAt: new Date().toISOString(),
      deliveryTime
    };
  } catch (error) {
    logger.error(
      {
        userId: data.userId,
        channel,
        error
      },
      `Failed to deliver notification via ${channel}`
    );
    throw error;
  }
}

/**
 * Simulates push notification delivery
 */
async function simulatePushNotification(data: UserNotificationJobData): Promise<void> {
  // Simulate push notification processing time
  const processingTime = 300 + Math.random() * 500;
  await new Promise(resolve => setTimeout(resolve, processingTime));

  // Simulate 1% failure rate for push notifications
  if (Math.random() < 0.01) {
    throw new Error('Push notification service temporarily unavailable');
  }
}

/**
 * Simulates email notification delivery
 */
async function simulateEmailNotification(data: UserNotificationJobData): Promise<void> {
  // Simulate email notification processing time (longer than push)
  const processingTime = 800 + Math.random() * 1200;
  await new Promise(resolve => setTimeout(resolve, processingTime));

  // Simulate 3% failure rate for email notifications
  if (Math.random() < 0.03) {
    throw new Error('Email notification service temporarily unavailable');
  }
}

/**
 * Simulates SMS notification delivery
 */
async function simulateSmsNotification(data: UserNotificationJobData): Promise<void> {
  // Simulate SMS notification processing time (variable based on provider)
  const processingTime = 1000 + Math.random() * 2000;
  await new Promise(resolve => setTimeout(resolve, processingTime));

  // Simulate 5% failure rate for SMS notifications (highest failure rate)
  if (Math.random() < 0.05) {
    throw new Error('SMS notification service temporarily unavailable');
  }

  // Additional SMS-specific validation
  if (data.message.length > 160) {
    throw new Error('SMS message too long (max 160 characters)');
  }
}
