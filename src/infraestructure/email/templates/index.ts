/**
 * Email Templates Index
 * Exports all available email templates for the job system
 */

// Base template types and interfaces
export { BaseTemplate, type TemplateResult, type EmailTemplate } from './types';

// Individual template classes
export { WelcomeTemplate } from './welcome';
export { RegistrationSuccessTemplate } from './registrationSuccess';
export { PasswordResetTemplate } from './passwordReset';
export { OrderConfirmationTemplate } from './orderConfirmation';
export { InvoiceTemplate } from './invoice';
export { NewsletterTemplate } from './newsletter';
export { SystemAlertTemplate, AlertSeverity } from './systemAlert';
export { CustomTemplate } from './custom';

// Import classes for internal use
import { BaseTemplate } from './types';
import { WelcomeTemplate } from './welcome';
import { RegistrationSuccessTemplate } from './registrationSuccess';
import { PasswordResetTemplate } from './passwordReset';
import { OrderConfirmationTemplate } from './orderConfirmation';
import { InvoiceTemplate } from './invoice';
import { NewsletterTemplate } from './newsletter';
import { SystemAlertTemplate } from './systemAlert';
import { CustomTemplate } from './custom';

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
