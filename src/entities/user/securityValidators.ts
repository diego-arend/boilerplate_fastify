// Utilitários de segurança para validação de entrada
export class SecurityValidators {

  // Sanitiza entrada removendo caracteres perigosos
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      .replace(/[<>'"&]/g, '') // Remove caracteres HTML
      .replace(/javascript:/gi, '') // Remove javascript:
      .replace(/on\w+=/gi, '') // Remove event handlers
      .replace(/\.\./g, '.') // Previne path traversal
      .replace(/\/+/g, '/') // Normaliza barras
      .trim();
  }

  // Valida email com regras de segurança
  static isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    return emailRegex.test(email) &&
           email.length <= 254 &&
           !/\.\./.test(email) &&
           !email.includes('..') &&
           email.trim() === email;
  }

  // Valida senha forte
  static isStrongPassword(password: string): boolean {
    if (!password || typeof password !== 'string') return false;

    // Pelo menos 8 caracteres, uma letra minúscula, maiúscula, número e caractere especial
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

    return password.length >= 8 &&
           password.length <= 128 &&
           strongPasswordRegex.test(password);
  }

  // Detecta tentativas de injeção
  static hasInjectionAttempt(input: string): boolean {
    if (!input || typeof input !== 'string') return false;

    const injectionPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i,
      /union\s+select/i,
      /;\s*drop/i,
      /\.\./,
      /\/etc\/passwd/i,
      /eval\(/i,
      /document\./i,
      /window\./i
    ];

    return injectionPatterns.some(pattern => pattern.test(input));
  }

  // Limpa query parameters de MongoDB
  static sanitizeMongoQuery(query: any): any {
    if (!query || typeof query !== 'object') return query;

    const sanitized = { ...query };

    // Remove operadores MongoDB perigosos se não autorizados
    const dangerousOperators = ['$where', '$function', '$accumulator', '$function'];

    for (const key in sanitized) {
      if (dangerousOperators.includes(key)) {
        delete sanitized[key];
      }

      // Recursivamente sanitiza objetos aninhados
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeMongoQuery(sanitized[key]);
      }
    }

    return sanitized;
  }
}