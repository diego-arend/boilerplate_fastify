/**
 * Email Job Usage Examples
 * Demonstrates how to use the email job with different templates
 */

import type { EmailJobData, EmailTemplateType } from './emailSend.job.js';
import { EmailTemplateConstants } from './emailSend.job.js';
import { JobPriority, QueueJobType } from '../../queue.types.js';

/**
 * Example: Welcome email for new user registration
 */
export const welcomeEmailExample: EmailJobData = {
  to: 'newuser@example.com',
  subject: 'Welcome to Our Platform!',
  template: EmailTemplateConstants.WELCOME as EmailTemplateType,
  variables: {
    userName: 'John Doe',
    activationLink: 'https://app.example.com/activate?token=abc123xyz'
  },
  priority: 'high',
  trackOpens: true,
  trackClicks: true,
  userId: 'user_123',
  metadata: {
    registrationSource: 'web_signup',
    campaignId: 'welcome_series_2024'
  }
};

/**
 * Example: Password reset email
 */
export const passwordResetEmailExample: EmailJobData = {
  to: 'user@example.com',
  subject: 'Password Reset Request',
  template: EmailTemplateConstants.PASSWORD_RESET as EmailTemplateType,
  variables: {
    userName: 'Jane Smith',
    resetLink: 'https://app.example.com/reset?token=xyz789abc',
    expiresIn: '24 hours'
  },
  priority: 'high',
  trackOpens: true,
  userId: 'user_456',
  metadata: {
    requestedAt: new Date().toISOString(),
    ipAddress: '192.168.1.1'
  }
};

/**
 * Example: Order confirmation email with multiple items
 */
export const orderConfirmationEmailExample: EmailJobData = {
  to: 'customer@example.com',
  cc: 'sales@company.com',
  subject: 'Order Confirmation #ORD-2024-001',
  template: EmailTemplateConstants.ORDER_CONFIRMATION as EmailTemplateType,
  variables: {
    orderNumber: 'ORD-2024-001',
    customerName: 'Alice Johnson',
    orderItems: [
      { name: 'Premium Widget', quantity: 2, price: '29.99' },
      { name: 'Deluxe Gadget', quantity: 1, price: '49.99' },
      { name: 'Standard Tool', quantity: 3, price: '15.99' }
    ],
    totalAmount: '125.96'
  },
  priority: 'high',
  trackOpens: true,
  userId: 'customer_789',
  organizationId: 'org_123',
  metadata: {
    orderTotal: 125.96,
    paymentMethod: 'credit_card',
    shippingMethod: 'express'
  }
};

/**
 * Example: Invoice email with attachment
 */
export const invoiceEmailExample: EmailJobData = {
  to: 'client@company.com',
  bcc: 'accounting@ourcompany.com',
  subject: 'Invoice #INV-2024-0123',
  template: EmailTemplateConstants.INVOICE as EmailTemplateType,
  variables: {
    invoiceNumber: 'INV-2024-0123',
    customerName: 'ABC Corporation',
    amount: '2,499.00',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    downloadLink: 'https://invoices.ourcompany.com/download/INV-2024-0123.pdf'
  },
  attachments: [
    {
      filename: 'invoice_INV-2024-0123.pdf',
      path: '/invoices/INV-2024-0123.pdf',
      contentType: 'application/pdf'
    }
  ],
  priority: 'normal',
  trackOpens: true,
  organizationId: 'org_456',
  metadata: {
    invoiceAmount: 2499.0,
    clientId: 'client_abc_corp',
    billingPeriod: '2024-01'
  }
};

/**
 * Example: Newsletter email
 */
export const newsletterEmailExample: EmailJobData = {
  to: ['subscriber1@example.com', 'subscriber2@example.com', 'subscriber3@example.com'],
  subject: 'Weekly Newsletter - Tech Updates',
  template: EmailTemplateConstants.NEWSLETTER as EmailTemplateType,
  variables: {
    title: 'Weekly Tech Updates',
    content: `
      <h2>This Week's Highlights</h2>
      <ul>
        <li>New AI Features Released</li>
        <li>Security Update Available</li>
        <li>Community Event This Friday</li>
      </ul>
      <p>Read more on our <a href="https://blog.example.com">blog</a>.</p>
    `,
    textContent: `
This Week's Highlights:
- New AI Features Released
- Security Update Available  
- Community Event This Friday

Read more on our blog: https://blog.example.com
    `,
    unsubscribeLink: 'https://app.example.com/unsubscribe?token=newsletter_token',
    preferencesLink: 'https://app.example.com/preferences?token=newsletter_token'
  },
  priority: 'low',
  trackOpens: true,
  trackClicks: true,
  campaignId: 'weekly_newsletter_2024',
  metadata: {
    newsletterType: 'weekly_tech',
    sendDate: new Date().toISOString(),
    segmentId: 'tech_subscribers'
  }
};

/**
 * Example: System alert email for critical issues
 */
export const systemAlertEmailExample: EmailJobData = {
  to: ['admin@company.com', 'devops@company.com', 'oncall@company.com'],
  subject: 'CRITICAL: Database Connection Issues Detected',
  template: EmailTemplateConstants.SYSTEM_ALERT as EmailTemplateType,
  variables: {
    alertType: 'critical',
    message: 'Database connection pool exhausted. Multiple connection timeouts detected.',
    timestamp: new Date().toISOString(),
    actionRequired: true,
    contactInfo: 'Slack: #alerts, Phone: +1-555-ON-CALL'
  },
  priority: 'high',
  trackOpens: true,
  metadata: {
    alertId: 'alert_db_conn_001',
    severity: 'critical',
    affectedServices: ['api', 'web', 'worker'],
    detectedAt: new Date().toISOString()
  }
};

/**
 * Example: Custom email with HTML content
 */
export const customEmailExample: EmailJobData = {
  to: 'recipient@example.com',
  subject: 'Custom Promotional Email',
  template: EmailTemplateConstants.CUSTOM as EmailTemplateType,
  customHtml: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Special Offer</title>
      <style>
        body { font-family: Arial, sans-serif; }
        .offer { background: #e3f2fd; padding: 20px; border-radius: 8px; }
        .button { background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="offer">
        <h2>🎉 Special Offer Just for You!</h2>
        <p>Get 50% off your next purchase with code: <strong>SAVE50</strong></p>
        <p><a href="https://shop.example.com/?coupon=SAVE50" class="button">Shop Now</a></p>
        <p><em>Offer expires in 48 hours!</em></p>
      </div>
    </body>
    </html>
  `,
  customText: `
    🎉 Special Offer Just for You!
    
    Get 50% off your next purchase with code: SAVE50
    
    Shop now: https://shop.example.com/?coupon=SAVE50
    
    Offer expires in 48 hours!
  `,
  priority: 'normal',
  trackOpens: true,
  trackClicks: true,
  campaignId: 'promo_save50_2024',
  metadata: {
    promoCode: 'SAVE50',
    discount: 0.5,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  }
};

/**
 * Example: Scheduled email (send at specific time)
 */
export const scheduledEmailExample: EmailJobData = {
  to: 'user@example.com',
  subject: 'Happy Birthday! 🎂',
  template: EmailTemplateConstants.CUSTOM as EmailTemplateType,
  customHtml: `
    <h1>Happy Birthday! 🎂</h1>
    <p>Wishing you a wonderful day filled with joy and celebration!</p>
    <p>As a birthday gift, enjoy 20% off your next purchase with code: <strong>BIRTHDAY20</strong></p>
  `,
  customText: `
    Happy Birthday! 🎂
    
    Wishing you a wonderful day filled with joy and celebration!
    
    As a birthday gift, enjoy 20% off your next purchase with code: BIRTHDAY20
  `,
  sendAt: new Date('2024-03-15T09:00:00Z'), // Send at 9 AM on user's birthday
  timezone: 'America/New_York',
  priority: 'normal',
  trackOpens: true,
  userId: 'user_birthday_123',
  metadata: {
    emailType: 'birthday',
    promoCode: 'BIRTHDAY20',
    userTimezone: 'America/New_York'
  }
};

/**
 * How to add these jobs to the queue
 */
export const emailJobExamples = {
  welcome: welcomeEmailExample,
  passwordReset: passwordResetEmailExample,
  orderConfirmation: orderConfirmationEmailExample,
  invoice: invoiceEmailExample,
  newsletter: newsletterEmailExample,
  systemAlert: systemAlertEmailExample,
  custom: customEmailExample,
  scheduled: scheduledEmailExample
};

/**
 * Example of adding an email job to the queue
 */
export async function addEmailJobExample(
  queueManager: any,
  exampleType: keyof typeof emailJobExamples
) {
  const jobData = emailJobExamples[exampleType];

  const job = await queueManager.addJob({
    type: QueueJobType.EMAIL_SEND,
    data: jobData,
    priority: JobPriority.HIGH,
    maxAttempts: 3,
    scheduledFor: jobData.sendAt || new Date()
  });

  console.log(`Added ${exampleType} email job: ${job.jobId}`);
  return job;
}
