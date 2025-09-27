/**
 * Email Infrastructure Module
 * Provides email services, plugins and templates for the Fastify application
 */

export { default as emailPlugin } from './email.plugin.js';
export type { EmailConfig, EmailAttachment, EmailSendOptions } from './email.plugin.js';
export { EmailService } from './email.plugin.js';

// Re-export email templates
export * from './templates/index.js';
