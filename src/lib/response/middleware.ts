import type { FastifyInstance } from 'fastify';
import { ApiResponseHandler } from './ApiResponseHandler.js';

/**
 * Middleware global para tratamento de erros não capturados
 * Centraliza o tratamento de erros em um único local
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

    // Tratamento específico para erros de validação
    if (error.validation) {
      return ApiResponseHandler.validationError(
        reply,
        'Dados de entrada inválidos',
        error.validation
      );
    }

    // Tratamento para erros de sintaxe JSON
    if (error instanceof SyntaxError && 'body' in error) {
      return ApiResponseHandler.validationError(
        reply,
        'JSON malformado na requisição'
      );
    }

    // Tratamento para erros de autenticação/autorização
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return ApiResponseHandler.authError(reply, error.message);
    }

    // Tratamento para erros de banco de dados
    if (error.name === 'MongoError' || error.name === 'ValidationError') {
      return ApiResponseHandler.validationError(reply, 'Erro de dados');
    }

    // Erro interno genérico (não expõe detalhes sensíveis)
    return ApiResponseHandler.internalError(reply, error);
  });
}

/**
 * Hook para tratamento de respostas não encontradas (404)
 */
export function notFoundHandler(fastify: FastifyInstance) {
  fastify.setNotFoundHandler((request, reply) => {
    return ApiResponseHandler.notFound(reply, `Rota ${request.method} ${request.url} não encontrada`);
  });
}

/**
 * Hook para tratamento de métodos não permitidos
 * Nota: Esta funcionalidade pode ser implementada no futuro
 * com verificações mais específicas por rota
 */
export function methodNotAllowedHandler(fastify: FastifyInstance) {
  // Hook pode ser implementado futuramente para verificações específicas
  // de métodos permitidos por rota
}