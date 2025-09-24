/**
 * Base Email Template Types and Interfaces
 */

export interface TemplateResult {
  html: string;
  text: string;
  subject: string;
}

export interface EmailTemplate {
  render(variables: Record<string, any>): TemplateResult;
  getRequiredVariables(): string[];
}

export abstract class BaseTemplate<T extends Record<string, any>> implements EmailTemplate {
  abstract getRequiredVariables(): string[];
  abstract render(variables: T): TemplateResult;

  protected validateVariables(variables: T): void {
    const required = this.getRequiredVariables();
    const missing = required.filter(
      key => variables[key] === undefined || variables[key] === null || variables[key] === ''
    );

    if (missing.length > 0) {
      throw new Error(`Missing required variables: ${missing.join(', ')}`);
    }
  }
}
