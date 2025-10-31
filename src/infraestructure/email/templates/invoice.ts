/**
 * Invoice Email Template
 */

import type { TemplateResult } from './types';
import { BaseTemplate } from './types';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceVariables {
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentLink?: string;
}

export class InvoiceTemplate extends BaseTemplate<InvoiceVariables> {
  getRequiredVariables(): string[] {
    return [
      'customerName',
      'invoiceNumber',
      'invoiceDate',
      'dueDate',
      'items',
      'subtotal',
      'tax',
      'total'
    ];
  }

  render(variables: InvoiceVariables): TemplateResult {
    this.validateVariables(variables);

    const itemsHtml = variables.items
      .map(
        item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(item.quantity * item.unitPrice).toFixed(2)}</td>
      </tr>
    `
      )
      .join('');

    const itemsText = variables.items
      .map(
        item =>
          `${item.description} - Qty: ${item.quantity} - Unit: $${item.unitPrice.toFixed(2)} - Total: $${(item.quantity * item.unitPrice).toFixed(2)}`
      )
      .join('\n');

    const paymentSection = variables.paymentLink
      ? `
        <p style="text-align: center; margin: 30px 0;">
          <a href="${variables.paymentLink}" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Pay Now</a>
        </p>
      `
      : '<p>Please process payment according to your usual method.</p>';

    const paymentTextSection = variables.paymentLink
      ? `\nPay Online: ${variables.paymentLink}\n`
      : '\nPlease process payment according to your usual method.\n';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${variables.invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6c757d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .invoice-info { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .items-table th { background: #343a40; color: white; padding: 10px; text-align: left; }
          .totals { text-align: right; margin: 20px 0; }
          .due-notice { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📄 Invoice</h1>
          </div>
          <div class="content">
            <h2>Dear ${variables.customerName},</h2>
            <p>Please find your invoice details below:</p>
            
            <div class="invoice-info">
              <p><strong>Invoice Number:</strong> ${variables.invoiceNumber}</p>
              <p><strong>Invoice Date:</strong> ${variables.invoiceDate}</p>
              <p><strong>Due Date:</strong> ${variables.dueDate}</p>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Unit Price</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="totals">
              <p><strong>Subtotal: $${variables.subtotal.toFixed(2)}</strong></p>
              <p><strong>Tax: $${variables.tax.toFixed(2)}</strong></p>
              <p style="font-size: 18px; color: #dc3545;"><strong>Total Due: $${variables.total.toFixed(2)}</strong></p>
            </div>

            <div class="due-notice">
              <strong>Payment Due:</strong> ${variables.dueDate}<br>
              Please ensure payment is made by the due date to avoid any late fees.
            </div>

            ${paymentSection}

            <p>Thank you for your business!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Invoice ${variables.invoiceNumber}

      Dear ${variables.customerName},

      Please find your invoice details below:

      Invoice Information:
      - Invoice Number: ${variables.invoiceNumber}
      - Invoice Date: ${variables.invoiceDate}
      - Due Date: ${variables.dueDate}

      Items:
      ${itemsText}

      Invoice Summary:
      - Subtotal: $${variables.subtotal.toFixed(2)}
      - Tax: $${variables.tax.toFixed(2)}
      - Total Due: $${variables.total.toFixed(2)}

      PAYMENT DUE: ${variables.dueDate}
      Please ensure payment is made by the due date to avoid any late fees.
      ${paymentTextSection}
      Thank you for your business!
    `;

    return {
      html,
      text: text.trim(),
      subject: `Invoice ${variables.invoiceNumber} - Due ${variables.dueDate}`
    };
  }
}
