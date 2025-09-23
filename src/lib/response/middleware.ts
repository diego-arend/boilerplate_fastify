import type { FastifyInstance } from 'fastify';
import { ApiResponseHandler } from './ApiResponseHandler.js';

/**
 * Global middleware for handling uncaught errors
 * Centralizes error handling in a single location
 */
export function errorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, request, reply) => {
    // Log do erro para monitoramento
    fastify.log.error({
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      ip: request.ip
    });

    // Specific handling for validation errors
    if (error.validation) {
      return ApiResponseHandler.validationError(
        reply,
        'Invalid input data',
        error.validation
      );
    }

    // Tratamento para erros de sintaxe JSON
    if (error instanceof SyntaxError && 'body' in error) {
      return ApiResponseHandler.validationError(
        reply,
        'Malformed JSON in request'
      );
    }

    // Handling for authentication/authorization errors
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return ApiResponseHandler.authError(reply, error.message);
    }

    // Tratamento para erros de banco de dados
    if (error.name === 'MongoError' || error.name === 'ValidationError') {
      return ApiResponseHandler.validationError(reply, 'Erro de dados');
    }

    // Generic internal error (does not expose sensitive details)
    return ApiResponseHandler.internalError(reply, error);
  });
}

/**
 * Hook for handling not found responses (404)
 */
export function notFoundHandler(fastify: FastifyInstance) {
  fastify.setNotFoundHandler((request, reply) => {
    return ApiResponseHandler.notFound(reply, `Route ${request.method} ${request.url} not found`);
  });
}

/**
 * Hook for handling method not allowed
 * Note: This functionality can be implemented in the future
 * with more specific route-based checks
 */
export function methodNotAllowedHandler(fastify: FastifyInstance) {
  // Hook can be implemented in the future for specific
  // checks of allowed methods per route
}
