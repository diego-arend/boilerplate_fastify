/**
 * Email Infrastructure Module
 * Provides email services, plugins and templates for the Fastify application
 */

export { default as emailPlugin } from './email.plugin';
export type { EmailConfig, EmailAttachment, EmailSendOptions } from './email.plugin';
export { EmailService } from './email.plugin';

// Re-export email templates
export * from './templates/index';
