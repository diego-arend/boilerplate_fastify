/**
 * Worker Entry Point
 *
 * Inicializa o worker standalone usando configurações do ambiente
 * Reutiliza validação de ambiente e logger do projeto
 */

import dotenv from 'dotenv';
import { StandaloneWorker, type WorkerConfig } from './worker.js';
import { validateCriticalEnvs } from '../../lib/validators/validateEnv.js';
import { defaultLogger } from '../../lib/logger/index.js';

// Carregar variáveis de ambiente
dotenv.config();

// Validar variáveis críticas
console.log('🔧 Validating worker environment variables...');
validateCriticalEnvs();
console.log('✅ Worker environment variables validation passed!');

const logger = defaultLogger.child({ component: 'WorkerMain' });

// Configuração do worker baseada em variáveis de ambiente
const workerConfig: WorkerConfig = {
  queueName: process.env.QUEUE_NAME || 'app-queue',
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
  batchSize: parseInt(process.env.WORKER_BATCH_SIZE || '50'),
  processingInterval: parseInt(process.env.WORKER_PROCESSING_INTERVAL || '5000')
};

let worker: StandaloneWorker;

async function startWorker(): Promise<void> {
  try {
    console.log('🚀 Starting Standalone Worker...');
    console.log(`📊 Worker Config:`, workerConfig);

    worker = new StandaloneWorker(workerConfig, logger);
    await worker.initialize();

    console.log('✅ Worker started successfully');
    logger.info('Worker is now processing jobs from MongoDB batches');

    // Log worker stats periodically
    setInterval(async () => {
      try {
        const stats = await worker.getStats();
        logger.info('Worker stats:', stats);
      } catch (error) {
        logger.error(
          `Failed to get worker stats: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }, 30000); // A cada 30 segundos
  } catch (error) {
    console.error('🚨 Worker failed to start:', error);
    logger.error(
      `Worker startup failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Worker received ${signal}. Shutting down gracefully...`);
  console.log(`🛑 Worker received ${signal}. Shutting down gracefully...`);

  try {
    if (worker) {
      await worker.stop();
    }

    logger.info('Worker shutdown completed successfully');
    console.log('✅ Worker stopped successfully. Exiting process.');
    process.exit(0);
  } catch (error) {
    logger.error(
      `Error during worker shutdown: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error(
      `🚨 Error during shutdown: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
};

// Registrar handlers de sinal
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handler para uncaught exceptions
process.on('uncaughtException', error => {
  logger.error(`Uncaught exception in worker: ${error.message}`);
  console.error('🚨 Uncaught exception:', error);
  process.exit(1);
});

// Handler para unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection in worker: ${String(reason)}`);
  console.error('🚨 Unhandled rejection:', reason);
  process.exit(1);
});

// Iniciar worker
startWorker();
