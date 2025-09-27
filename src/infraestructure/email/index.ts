/**
 * Email Infrastructure Module
 * Provides email services and plugins for the Fastify application
 */

export { default as emailPlugin } from './email.plugin.js';
export type { EmailConfig, EmailAttachment, EmailSendOptions } from './email.plugin.js';
export { EmailService } from './email.plugin.js';
