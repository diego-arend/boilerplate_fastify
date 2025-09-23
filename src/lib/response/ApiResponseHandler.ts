import type { FastifyReply } from 'fastify';

/**
 * Utility class for API response standardization
 * Centralizes the handling of success and error responses
 */
export class ApiResponseHandler {
  /**
   * Standard API response structure
   */
  private static createResponse(
    success: boolean,
    code: number,
    message: string,
    data?: any,
    error?: string
  ) {
    const response: any = {
      success,
      message,
      code
    };

    if (data !== undefined) {
      response.data = data;
    }

    if (error) {
      response.error = error;
    }

    return response;
  }

  /**
   * Success response (200-299)
   */
  static success(
    reply: FastifyReply,
    message: string = 'Operation completed successfully',
    data?: any,
    code: number = 200
  ) {
    const response = this.createResponse(true, code, message, data);
    return reply.code(code).send(response);
  }

  /**
   * Successful creation response (201)
   */
  static created(
    reply: FastifyReply,
    message: string = 'Resource created successfully',
    data?: any
  ) {
    return this.success(reply, message, data, 201);
  }

  /**
   * No content response (204)
   */
  static noContent(reply: FastifyReply, message: string = 'Operation completed successfully') {
    const response = this.createResponse(true, 204, message);
    return reply.code(204).send(response);
  }

  /**
   * Validation error (400)
   */
  static validationError(reply: FastifyReply, message: string = 'Invalid data', details?: any) {
    const response = this.createResponse(false, 400, message, details, 'VALIDATION_ERROR');
    return reply.code(400).send(response);
  }

  /**
   * Authentication error (401)
   */
  static authError(reply: FastifyReply, message: string = 'Unauthorized', details?: any) {
    const response = this.createResponse(false, 401, message, details, 'AUTHENTICATION_ERROR');
    return reply.code(401).send(response);
  }

  /**
   * Authorization/forbidden error (403)
   */
  static forbidden(reply: FastifyReply, message: string = 'Access denied', details?: any) {
    const response = this.createResponse(false, 403, message, details, 'FORBIDDEN_ERROR');
    return reply.code(403).send(response);
  }

  /**
   * Resource not found (404)
   */
  static notFound(reply: FastifyReply, message: string = 'Resource not found', details?: any) {
    const response = this.createResponse(false, 404, message, details, 'NOT_FOUND_ERROR');
    return reply.code(404).send(response);
  }

  /**
   * Conflict (409) - e.g., email already exists
   */
  static conflict(reply: FastifyReply, message: string = 'Data conflict', details?: any) {
    const response = this.createResponse(false, 409, message, details, 'CONFLICT_ERROR');
    return reply.code(409).send(response);
  }

  /**
   * Internal server error (500)
   * Logs the error internally but does not expose sensitive details
   */
  static internalError(reply: FastifyReply, error?: Error | string, logError: boolean = true) {
    if (logError && error) {
      const errorMessage = error instanceof Error ? error.message : error;
      console.error('Erro interno:', errorMessage);

      // In production, could send to logging service
      // logger.error(errorMessage, { stack: error instanceof Error ? error.stack : undefined });
    }

    const response = this.createResponse(
      false,
      500,
      'Internal server error',
      undefined,
      'INTERNAL_ERROR'
    );

    return reply.code(500).send(response);
  }

  /**
   * Service unavailable (503)
   */
  static serviceUnavailable(
    reply: FastifyReply,
    message: string = 'Service temporarily unavailable'
  ) {
    const response = this.createResponse(false, 503, message, undefined, 'SERVICE_UNAVAILABLE');
    return reply.code(503).send(response);
  }

  /**
   * Custom response
   */
  static custom(
    reply: FastifyReply,
    success: boolean,
    code: number,
    message: string,
    data?: any,
    error?: string
  ) {
    const response = this.createResponse(success, code, message, data, error);
    return reply.code(code).send(response);
  }

  /**
   * Paginated response
   */
  static paginated(
    reply: FastifyReply,
    data: any[],
    total: number,
    page: number,
    limit: number,
    message: string = 'Data returned successfully'
  ) {
    const pagination = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    };

    const responseData = {
      items: data,
      pagination
    };

    return this.success(reply, message, responseData);
  }
}
