#!/usr/bin/env node

/**
 * Queue Worker Entry Point
 * Standalone worker process for processing background jobs
 */

import 'dotenv/config';
import { config } from './lib/validators/validateEnv.js';
import { LoggerManager, LogLevel } from './lib/logger/index.js';
import { MongoConnectionManagerFactory } from './infraestructure/mongo/connectionManager.factory.js';
import { getQueueCache } from './infraestructure/cache/index.js';
import { getDefaultQueueManager } from './infraestructure/queue/index.js';
import { QueueWorker } from './infraestructure/queue/queue.worker.js';

/**
 * Main worker function
 */
async function main(): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('🔧 Starting Queue Worker...');
    console.log('✅ Environment variables validation passed!');

    // Create logger
    const loggerManager = new LoggerManager({
      level: LogLevel[config.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel],
      environment: config.NODE_ENV
    });

    const logger = loggerManager.child({ module: 'worker' });

    logger.info('🚀 Starting Queue Worker...');
    logger.info(`📊 Environment: ${config.NODE_ENV}`);
    logger.info(`🗄️  Database: ${config.MONGO_URI.split('@')[1] || 'localhost'}`);
    logger.info(`🔄 Redis: ${config.REDIS_HOST}:${config.REDIS_PORT}`);

    // Initialize database connection
    logger.info('🗄️  Connecting to MongoDB...');
    const connectionManager = await MongoConnectionManagerFactory.create();
    await connectionManager.connect();
    logger.info('✅ MongoDB connected successfully!');

    // Initialize queue cache (Redis db1)
    logger.info('🔄 Connecting to Queue Cache...');
    const queueCache = getQueueCache();
    await queueCache.connect();
    logger.info('✅ Queue Cache connected successfully!');

    // Initialize queue manager
    logger.info('🔄 Initializing Queue Manager...');
    const queueManager = await getDefaultQueueManager(config, logger);
    logger.info('✅ Queue Manager initialized!');

    // Create and start worker with email configuration
    const emailConfig = {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE || false,
      auth:
        config.SMTP_USER && config.SMTP_PASS
          ? {
              user: config.SMTP_USER,
              pass: config.SMTP_PASS
            }
          : undefined
    };

    const worker = new QueueWorker(
      queueManager,
      logger,
      2, // Number of jobs to process concurrently
      10, // Batch size for job loading
      5000, // Poll interval in milliseconds
      emailConfig // Email configuration for EmailService
    );

    // Setup graceful shutdown
    let isShuttingDown = false;
    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) {
        logger.warn('⚠️  Force shutdown signal received, exiting immediately...');
        process.exit(1);
      }

      isShuttingDown = true;
      logger.info(`📡 Received ${signal}, starting graceful shutdown...`);

      try {
        await worker.stop();
        await connectionManager.disconnect();

        // Close queue cache connection
        await queueCache.disconnect();
        logger.info('✅ Queue cache closed gracefully');

        const uptime = Date.now() - startTime;
        logger.info(`✅ Queue Worker stopped gracefully after ${uptime}ms`);
        process.exit(0);
      } catch (error) {
        logger.error({ error }, '❌ Error during graceful shutdown');
        process.exit(1);
      }
    };

    // Register signal handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions and rejections
    process.on('uncaughtException', error => {
      logger.fatal({ error }, '💥 Uncaught Exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal({ reason, promise }, '💥 Unhandled Promise Rejection');
      process.exit(1);
    });

    // Start the worker
    await worker.start();

    const initTime = Date.now() - startTime;
    logger.info(`🎯 Queue Worker started successfully in ${initTime}ms`);
    logger.info(`📊 Worker Stats: ${JSON.stringify(worker.getStats(), null, 2)}`);

    // Keep the process alive
    process.stdin.resume();
  } catch (error) {
    console.error('🚨 FATAL ERROR: Failed to start Queue Worker!');
    console.error(error instanceof Error ? error.message : error);

    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the worker if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Worker startup failed:', error);
    process.exit(1);
  });
}

export { main };
