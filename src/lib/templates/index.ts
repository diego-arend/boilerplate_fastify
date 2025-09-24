/**
 * Email Templates Index
 * Exports all available email templates for the job system
 */

// Base template types and interfaces
export { BaseTemplate, type TemplateResult, type EmailTemplate } from './types.js';

// Individual template classes
export { WelcomeTemplate } from './welcome.js';
export { RegistrationSuccessTemplate } from './registrationSuccess.js';
export { PasswordResetTemplate } from './passwordReset.js';
export { OrderConfirmationTemplate } from './orderConfirmation.js';
export { InvoiceTemplate } from './invoice.js';
export { NewsletterTemplate } from './newsletter.js';
export { SystemAlertTemplate, AlertSeverity } from './systemAlert.js';
export { CustomTemplate } from './custom.js';

// Import classes for internal use
import { BaseTemplate } from './types.js';
import { WelcomeTemplate } from './welcome.js';
import { RegistrationSuccessTemplate } from './registrationSuccess.js';
import { PasswordResetTemplate } from './passwordReset.js';
import { OrderConfirmationTemplate } from './orderConfirmation.js';
import { InvoiceTemplate } from './invoice.js';
import { NewsletterTemplate } from './newsletter.js';
import { SystemAlertTemplate } from './systemAlert.js';
import { CustomTemplate } from './custom.js';

// Template factory function for easy instantiation
export function createTemplate(templateType: string): BaseTemplate<any> | null {
  switch (templateType.toLowerCase()) {
    case 'welcome':
      return new WelcomeTemplate();
    case 'registration_success':
      return new RegistrationSuccessTemplate();
    case 'password_reset':
      return new PasswordResetTemplate();
    case 'order_confirmation':
      return new OrderConfirmationTemplate();
    case 'invoice':
      return new InvoiceTemplate();
    case 'newsletter':
      return new NewsletterTemplate();
    case 'system_alert':
      return new SystemAlertTemplate();
    case 'custom':
      return new CustomTemplate();
    default:
      return null;
  }
}

// Available template types enum for type safety
export enum AvailableTemplates {
  WELCOME = 'WELCOME',
  REGISTRATION_SUCCESS = 'REGISTRATION_SUCCESS',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ORDER_CONFIRMATION = 'ORDER_CONFIRMATION',
  INVOICE = 'INVOICE',
  NEWSLETTER = 'NEWSLETTER',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  CUSTOM = 'CUSTOM'
}

// Template registry for dynamic access
export const TEMPLATE_REGISTRY = {
  [AvailableTemplates.WELCOME]: WelcomeTemplate,
  [AvailableTemplates.REGISTRATION_SUCCESS]: RegistrationSuccessTemplate,
  [AvailableTemplates.PASSWORD_RESET]: PasswordResetTemplate,
  [AvailableTemplates.ORDER_CONFIRMATION]: OrderConfirmationTemplate,
  [AvailableTemplates.INVOICE]: InvoiceTemplate,
  [AvailableTemplates.NEWSLETTER]: NewsletterTemplate,
  [AvailableTemplates.SYSTEM_ALERT]: SystemAlertTemplate,
  [AvailableTemplates.CUSTOM]: CustomTemplate
} as const;
