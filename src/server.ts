import dotenv from 'dotenv';
import { fastify } from "fastify";
import configFastify from "./infraestructure/server/fastify.config.js";
import app from "./app.js";
import { config, validateCriticalEnvs } from "./lib/validators/validateEnv.js";

// Load environment variables first
dotenv.config({ debug: false });

// Validate critical environment variables before starting the server
// This will exit the process if validation fails
console.log('🔧 Validating environment variables...');
validateCriticalEnvs();
console.log('✅ Environment variables validation passed!');

const server = fastify(configFastify);

server.decorate("config", config);

server.register(app);

const start = async () => {
  try {
    console.log('🚀 Starting server...');
    console.log(`📊 Environment: ${config.NODE_ENV}`);
    console.log(`🌐 Port: ${config.PORT}`);
    
    await server.listen({ port: config.PORT, host: "0.0.0.0" });
    
    server.log.info(`🎉 Server successfully running on http://localhost:${config.PORT}`);
    
    if (config.NODE_ENV === 'development') {
      server.log.info(`📚 API Documentation available at http://localhost:${config.PORT}/docs`);
    }
    
  } catch (err) {
    server.log.error({
      message: 'Failed to start server',
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      port: config.PORT,
      environment: config.NODE_ENV
    });
    
    console.error('🚨 FATAL ERROR: Failed to start server!');
    console.error(err instanceof Error ? err.message : String(err));
    
    process.exit(1);
  }
};

start();

// Graceful shutdown
const shutdown = async (signal: string) => {
  server.log.info({
    message: 'Graceful shutdown initiated',
    signal,
    environment: config.NODE_ENV,
    uptime: process.uptime()
  });
  
  console.log(`🛑 Received ${signal}. Shutting down gracefully...`);
  
  try {
    await server.close();
    
    server.log.info({
      message: 'Server shutdown completed successfully',
      signal
    });
    
    console.log("✅ Server closed successfully. Exiting process.");
    process.exit(0);
    
  } catch (err) {
    server.log.error({
      message: 'Error during graceful shutdown',
      signal,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    
    console.error(`🚨 Error during shutdown: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
