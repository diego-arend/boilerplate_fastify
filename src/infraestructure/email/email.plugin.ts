/**
 * Email Plugin for Fastify
 * Provides email service with Nodemailer integration
 */

import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions, SentMessageInfo } from 'nodemailer';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Email configuration interface
 */
export interface EmailConfig {
  // SMTP Configuration
  host?: string | undefined;
  port?: number | undefined;
  secure?: boolean | undefined;
  auth?: { user: string; pass: string } | undefined;
  from?: string | undefined;
  pool?: boolean | undefined;
  maxConnections?: number | undefined;
  maxMessages?: number | undefined;
  rateDelta?: number | undefined;
  rateLimit?: number | undefined;
  tls?: { rejectUnauthorized?: boolean | undefined } | undefined;
}

/**
 * Email attachment interface
 */
export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
  encoding?: string;
  cid?: string;
}

/**
 * Email send options
 */
export interface EmailSendOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  from?: string;
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
  headers?: Record<string, string>;
}

/**
 * Email service class
 */
export class EmailService {
  private transporter: Transporter;
  private logger: FastifyBaseLogger;
  private config: EmailConfig;

  constructor(config: EmailConfig, logger: FastifyBaseLogger) {
    this.config = config;
    this.logger = logger.child({ component: 'email-service' });
    this.transporter = this.createTransporter(config);
  }

  /**
   * Create nodemailer transporter
   */
  private createTransporter(config: EmailConfig): Transporter {
    const transporterConfig: any = {};

    if (!config.host) {
      throw new Error('SMTP_HOST is required for email configuration');
    }

    // Use SMTP settings
    transporterConfig.host = config.host;
    transporterConfig.port = config.port || 587;
    transporterConfig.secure = config.secure || false;

    if (config.auth) {
      transporterConfig.auth = config.auth;
    }

    if (config.pool !== undefined) {
      transporterConfig.pool = config.pool;
    }

    if (config.maxConnections) {
      transporterConfig.maxConnections = config.maxConnections;
    }

    if (config.maxMessages) {
      transporterConfig.maxMessages = config.maxMessages;
    }

    if (config.rateDelta || config.rateLimit) {
      transporterConfig.rateDelta = config.rateDelta;
      transporterConfig.rateLimit = config.rateLimit;
    }

    if (config.tls) {
      transporterConfig.tls = config.tls;
    }

    this.logger.info({ host: config.host }, 'Creating email transporter');

    return nodemailer.createTransport(transporterConfig);
  }

  /**
   * Verify email transporter connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      this.logger.info('Verifying email transporter connection');
      await this.transporter.verify();
      this.logger.info('Email transporter connection verified');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ error: errorMessage }, 'Email connection failed');
      return false;
    }
  }

  /**
   * Send email
   */
  async sendMail(options: EmailSendOptions): Promise<{
    messageId: string;
    accepted: string[];
    rejected: string[];
    pending: string[];
    response: string;
  }> {
    const startTime = Date.now();
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    this.logger.info(
      {
        to: recipients.length,
        subject: options.subject?.substring(0, 100),
        hasHtml: !!options.html,
        hasAttachments: (options.attachments?.length || 0) > 0
      },
      'Sending email'
    );

    try {
      const mailOptions: SendMailOptions = {
        from: options.from || this.config.from,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        replyTo: options.replyTo,
        headers: options.headers
      };

      if (options.priority) {
        switch (options.priority) {
          case 'high':
            mailOptions.priority = 'high';
            mailOptions.headers = {
              ...mailOptions.headers,
              'X-Priority': '1',
              'X-MSMail-Priority': 'High',
              Importance: 'High'
            };
            break;
          case 'low':
            mailOptions.priority = 'low';
            mailOptions.headers = {
              ...mailOptions.headers,
              'X-Priority': '5',
              'X-MSMail-Priority': 'Low',
              Importance: 'Low'
            };
            break;
        }
      }

      const result: SentMessageInfo = await this.transporter.sendMail(mailOptions);
      const processingTime = Date.now() - startTime;

      this.logger.info(
        {
          messageId: result.messageId,
          accepted: result.accepted?.length || 0,
          rejected: result.rejected?.length || 0,
          processingTime
        },
        'Email sent successfully'
      );

      return {
        messageId: result.messageId,
        accepted: result.accepted || [],
        rejected: result.rejected || [],
        pending: result.pending || [],
        response: result.response
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        {
          error: errorMessage,
          processingTime,
          recipients: recipients.length
        },
        'Failed to send email'
      );

      throw new Error(`Email sending failed: ${errorMessage}`);
    }
  }

  /**
   * Close email transporter
   */
  async close(): Promise<void> {
    this.logger.info('Closing email transporter');
    this.transporter.close();
  }
}

/**
 * Email plugin declaration
 */
declare module 'fastify' {
  interface FastifyInstance {
    emailService: EmailService;
  }
}

/**
 * Email plugin function
 */
async function emailPluginFunction(fastify: FastifyInstance): Promise<void> {
  const emailConfig: EmailConfig = {
    host: process.env.SMTP_HOST || undefined,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    from: process.env.EMAIL_FROM || undefined,
    pool: process.env.EMAIL_POOL === 'true',
    maxConnections: process.env.EMAIL_MAX_CONNECTIONS
      ? parseInt(process.env.EMAIL_MAX_CONNECTIONS, 10)
      : 5,
    maxMessages: process.env.EMAIL_MAX_MESSAGES
      ? parseInt(process.env.EMAIL_MAX_MESSAGES, 10)
      : 100,
    rateLimit: process.env.EMAIL_RATE_LIMIT ? parseInt(process.env.EMAIL_RATE_LIMIT, 10) : 5,
    tls: { rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false' }
  };

  const emailService = new EmailService(emailConfig, fastify.log);

  setImmediate(async () => {
    try {
      await emailService.verifyConnection();
    } catch (error) {
      fastify.log.warn(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Email service connection verification failed'
      );
    }
  });

  fastify.decorate('emailService', emailService);

  fastify.addHook('onClose', async () => {
    await emailService.close();
  });
}

/**
 * Export plugin
 */
export default fp(emailPluginFunction, {
  name: 'email',
  dependencies: []
});
