import type { FastifyReply } from 'fastify';

/**
 * Classe utilitária para padronização de respostas da API
 * Centraliza o tratamento de respostas de sucesso e erro
 */
export class ApiResponseHandler {
  /**
   * Estrutura padrão de resposta da API
   */
  private static createResponse(success: boolean, code: number, message: string, data?: any, error?: string) {
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
   * Resposta de sucesso (200-299)
   */
  static success(reply: FastifyReply, message: string = 'Operação realizada com sucesso', data?: any, code: number = 200) {
    const response = this.createResponse(true, code, message, data);
    return reply.code(code).send(response);
  }

  /**
   * Resposta de criação bem-sucedida (201)
   */
  static created(reply: FastifyReply, message: string = 'Recurso criado com sucesso', data?: any) {
    return this.success(reply, message, data, 201);
  }

  /**
   * Resposta sem conteúdo (204)
   */
  static noContent(reply: FastifyReply, message: string = 'Operação realizada com sucesso') {
    const response = this.createResponse(true, 204, message);
    return reply.code(204).send(response);
  }

  /**
   * Erro de validação (400)
   */
  static validationError(reply: FastifyReply, message: string = 'Dados inválidos', details?: any) {
    const response = this.createResponse(false, 400, message, details, 'VALIDATION_ERROR');
    return reply.code(400).send(response);
  }

  /**
   * Erro de autenticação (401)
   */
  static authError(reply: FastifyReply, message: string = 'Não autorizado', details?: any) {
    const response = this.createResponse(false, 401, message, details, 'AUTHENTICATION_ERROR');
    return reply.code(401).send(response);
  }

  /**
   * Erro de autorização/forbidden (403)
   */
  static forbidden(reply: FastifyReply, message: string = 'Acesso negado', details?: any) {
    const response = this.createResponse(false, 403, message, details, 'FORBIDDEN_ERROR');
    return reply.code(403).send(response);
  }

  /**
   * Recurso não encontrado (404)
   */
  static notFound(reply: FastifyReply, message: string = 'Recurso não encontrado', details?: any) {
    const response = this.createResponse(false, 404, message, details, 'NOT_FOUND_ERROR');
    return reply.code(404).send(response);
  }

  /**
   * Conflito (409) - ex: email já existe
   */
  static conflict(reply: FastifyReply, message: string = 'Conflito de dados', details?: any) {
    const response = this.createResponse(false, 409, message, details, 'CONFLICT_ERROR');
    return reply.code(409).send(response);
  }

  /**
   * Erro interno do servidor (500)
   * Loga o erro internamente mas não expõe detalhes sensíveis
   */
  static internalError(reply: FastifyReply, error?: Error | string, logError: boolean = true) {
    if (logError && error) {
      const errorMessage = error instanceof Error ? error.message : error;
      console.error('Erro interno:', errorMessage);

      // Em produção, poderia enviar para serviço de logging
      // logger.error(errorMessage, { stack: error instanceof Error ? error.stack : undefined });
    }

    const response = this.createResponse(
      false,
      500,
      'Erro interno do servidor',
      undefined,
      'INTERNAL_ERROR'
    );

    return reply.code(500).send(response);
  }

  /**
   * Serviço indisponível (503)
   */
  static serviceUnavailable(reply: FastifyReply, message: string = 'Serviço temporariamente indisponível') {
    const response = this.createResponse(false, 503, message, undefined, 'SERVICE_UNAVAILABLE');
    return reply.code(503).send(response);
  }

  /**
   * Resposta customizada
   */
  static custom(reply: FastifyReply, success: boolean, code: number, message: string, data?: any, error?: string) {
    const response = this.createResponse(success, code, message, data, error);
    return reply.code(code).send(response);
  }

  /**
   * Resposta paginada
   */
  static paginated(reply: FastifyReply, data: any[], total: number, page: number, limit: number, message: string = 'Dados retornados com sucesso') {
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