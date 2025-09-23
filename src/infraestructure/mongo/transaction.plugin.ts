import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { TransactionManager } from './transactionManager.js';
import type { TransactionOptions } from './transaction.types.js';
import type { ClientSession } from 'mongoose';

// Extensões de tipos para adicionar session ao request
declare module 'fastify' {
  interface FastifyRequest {
    mongoSession?: ClientSession | undefined;
    transactionId?: string | undefined;
    routeConfig?: any;
  }
}

// Configurações do plugin de transação
export interface TransactionPluginOptions extends FastifyPluginOptions {
  // Timeout padrão para transações (em ms)
  defaultTimeout?: number;

  // Se deve logar transações
  enableLogging?: boolean;

  // Configurações de isolamento padrão
  defaultOptions?: Partial<TransactionOptions>;

  // Rotas que devem usar transações automaticamente
  autoTransactionRoutes?: string[] | RegExp[];

  // Se deve abortar transação em caso de erro de validação
  abortOnValidationError?: boolean;
}

// Símbolos para identificar configuração de transação em rotas
export const TRANSACTION_ROUTE_CONFIG = Symbol('transactionRouteConfig');

// Configuração de transação para rotas específicas
export interface RouteTransactionConfig {
  enabled: boolean;
  options?: Partial<TransactionOptions>;
  rollbackOnError?: boolean;
  rollbackOnStatusCode?: number[];
}

/**
 * Plugin do Fastify para gerenciamento automático de transações MongoDB
 *
 * Este plugin adiciona suporte para transações automáticas em rotas,
 * seguindo o padrão de arquitetura do Fastify
 */
async function transactionPlugin(
  fastify: FastifyInstance,
  options: TransactionPluginOptions = {}
): Promise<void> {
  const {
    defaultTimeout = 30000,
    enableLogging = true,
    defaultOptions = {},
    autoTransactionRoutes = [],
    abortOnValidationError = true
  } = options;

  // Registra helper para configurar transações em rotas
  fastify.decorate('withTransaction', (routeConfig: RouteTransactionConfig) => {
    return {
      [TRANSACTION_ROUTE_CONFIG]: routeConfig
    };
  });

  // Hook que executa antes de processar a requisição
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const routeConfig = getRouteTransactionConfig(request);

    // Verifica se deve usar transação para esta rota
    if (shouldUseTransaction(request, routeConfig, autoTransactionRoutes)) {
      try {
        const transactionOptions: Partial<TransactionOptions> = {
          ...defaultOptions,
          ...routeConfig?.options,
          maxTimeMS: defaultTimeout
        };

        // Inicia nova transação
        const transactionManager = TransactionManager.getInstance();
        const session = await transactionManager.startTransaction(transactionOptions as TransactionOptions);

        request.mongoSession = session;
        request.transactionId = session.id?.toString();

        if (enableLogging) {
          fastify.log.info({
            transactionId: request.transactionId,
            method: request.method,
            url: request.url
          }, 'Transaction started for route');
        }

      } catch (error) {
        fastify.log.error({
          method: request.method,
          url: request.url,
          error: error instanceof Error ? error.message : String(error)
        }, 'Failed to start transaction');

        throw error;
      }
    }
  });

  // Hook executado após processamento bem-sucedido
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.mongoSession) {
      const routeConfig = getRouteTransactionConfig(request);

      try {
        // Verifica se deve fazer rollback baseado no status code
        const shouldRollback = shouldRollbackOnStatusCode(
          reply.statusCode,
          routeConfig?.rollbackOnStatusCode
        );

        if (shouldRollback) {
          const transactionManager = TransactionManager.getInstance();
          await transactionManager.rollbackTransaction(request.mongoSession);

          if (enableLogging) {
            fastify.log.warn({
              transactionId: request.transactionId,
              statusCode: reply.statusCode,
              method: request.method,
              url: request.url
            }, 'Transaction rolled back due to status code');
          }
        } else {
          // Commit da transação
          const transactionManager = TransactionManager.getInstance();
          await transactionManager.commitTransaction(request.mongoSession);

          if (enableLogging) {
            fastify.log.info({
              transactionId: request.transactionId,
              statusCode: reply.statusCode,
              method: request.method,
              url: request.url
            }, 'Transaction committed successfully');
          }
        }

      } catch (error) {
        fastify.log.error({
          transactionId: request.transactionId,
          method: request.method,
          url: request.url,
          error: error instanceof Error ? error.message : String(error)
        }, 'Error during transaction finalization');

        // Tenta fazer rollback em caso de erro
        try {
          const transactionManager = TransactionManager.getInstance();
          await transactionManager.rollbackTransaction(request.mongoSession);
        } catch (rollbackError) {
          fastify.log.error({
            transactionId: request.transactionId,
            rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          }, 'Failed to rollback transaction after error');
        }
      } finally {
        // Limpa a sessão do request
        request.mongoSession = undefined;
        request.transactionId = undefined;
      }
    }
  });

  // Hook executado em caso de erro
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    if (request.mongoSession) {
      try {
        const transactionManager = TransactionManager.getInstance();
        await transactionManager.rollbackTransaction(request.mongoSession);

        if (enableLogging) {
          fastify.log.info({
            transactionId: request.transactionId,
            method: request.method,
            url: request.url,
            error: error.message
          }, 'Transaction rolled back due to error');
        }

      } catch (rollbackError) {
        fastify.log.error({
          transactionId: request.transactionId,
          rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          originalError: error.message
        }, 'Failed to rollback transaction after error');
      } finally {
        // Limpa a sessão do request
        request.mongoSession = undefined;
        request.transactionId = undefined;
      }
    }
  });

  // Hook para tratar erros de validação
  if (abortOnValidationError) {
    fastify.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
      // Este hook permite interceptar erros de validação antes do handler
      // Se houver erro de validação e uma transação ativa, ela será abortada automaticamente
    });
  }
}

/**
 * Obtém configuração de transação da rota
 */
function getRouteTransactionConfig(request: FastifyRequest): RouteTransactionConfig | undefined {
  const context = request.routeConfig;
  return context?.[TRANSACTION_ROUTE_CONFIG] as RouteTransactionConfig;
}

/**
 * Determina se deve usar transação para a requisição atual
 */
function shouldUseTransaction(
  request: FastifyRequest,
  routeConfig?: RouteTransactionConfig,
  autoRoutes: string[] | RegExp[] = []
): boolean {
  // Configuração explícita da rota tem precedência
  if (routeConfig) {
    return routeConfig.enabled;
  }

  // Verifica rotas configuradas para transação automática
  const url = request.url;
  const method = request.method;
  const routePattern = `${method} ${url}`;

  return autoRoutes.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(routePattern) || pattern.test(url);
    }
    return routePattern.includes(pattern) || url.includes(pattern);
  });
}

/**
 * Determina se deve fazer rollback baseado no status code
 */
function shouldRollbackOnStatusCode(
  statusCode: number,
  rollbackCodes: number[] = [400, 401, 403, 404, 422, 500, 502, 503]
): boolean {
  return rollbackCodes.includes(statusCode);
}

// Exporta o plugin usando fastify-plugin para encapsulamento correto
export default fp(transactionPlugin, {
  fastify: '4.x',
  name: 'transaction-plugin'
});

// Exporta também função nomeada para flexibilidade
export { transactionPlugin };
