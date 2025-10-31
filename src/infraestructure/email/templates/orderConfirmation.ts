/**
 * Order Confirmation Email Template
 */

import type { TemplateResult } from './types';
import { BaseTemplate } from './types';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderConfirmationVariables {
  userName: string;
  orderNumber: string;
  orderDate: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  shippingAddress: string;
}

export class OrderConfirmationTemplate extends BaseTemplate<OrderConfirmationVariables> {
  getRequiredVariables(): string[] {
    return [
      'userName',
      'orderNumber',
      'orderDate',
      'items',
      'subtotal',
      'tax',
      'total',
      'shippingAddress'
    ];
  }

  render(variables: OrderConfirmationVariables): TemplateResult {
    this.validateVariables(variables);

    const itemsHtml = variables.items
      .map(
        item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(item.quantity * item.price).toFixed(2)}</td>
      </tr>
    `
      )
      .join('');

    const itemsText = variables.items
      .map(
        item =>
          `${item.name} - Qty: ${item.quantity} - Price: $${item.price.toFixed(2)} - Total: $${(item.quantity * item.price).toFixed(2)}`
      )
      .join('\n');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .order-info { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .items-table th { background: #343a40; color: white; padding: 10px; text-align: left; }
          .totals { text-align: right; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Order Confirmed!</h1>
          </div>
          <div class="content">
            <h2>Thank you ${variables.userName}!</h2>
            <p>Your order has been successfully placed and confirmed. Here are your order details:</p>
            
            <div class="order-info">
              <p><strong>Order Number:</strong> ${variables.orderNumber}</p>
              <p><strong>Order Date:</strong> ${variables.orderDate}</p>
              <p><strong>Shipping Address:</strong> ${variables.shippingAddress}</p>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Price</th>
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
              <p style="font-size: 18px; color: #28a745;"><strong>Total: $${variables.total.toFixed(2)}</strong></p>
            </div>

            <p>We'll send you another email with tracking information once your order ships.</p>
            <p>Thank you for your business!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Order Confirmation

      Thank you ${variables.userName}!

      Your order has been successfully placed and confirmed.

      Order Details:
      - Order Number: ${variables.orderNumber}
      - Order Date: ${variables.orderDate}
      - Shipping Address: ${variables.shippingAddress}

      Items Ordered:
      ${itemsText}

      Order Summary:
      - Subtotal: $${variables.subtotal.toFixed(2)}
      - Tax: $${variables.tax.toFixed(2)}
      - Total: $${variables.total.toFixed(2)}

      We'll send you another email with tracking information once your order ships.

      Thank you for your business!
    `;

    return {
      html,
      text: text.trim(),
      subject: `Order Confirmation - ${variables.orderNumber}`
    };
  }
}
