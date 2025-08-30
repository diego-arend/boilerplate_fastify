import dotenv from 'dotenv';
import { fastify } from "fastify";
import configFastify from "./fastify.config.js";
import app from "./app.js";
import { config } from "./lib/validateEnv.js";

dotenv.config({ debug: false });

const server = fastify(configFastify);

server.decorate("config", config);

server.register(app);

const start = async () => {
  try {
    await server.listen({ port: config.PORT, host: "0.0.0.0" });
    server.log.info(`Server running on http://localhost:${config.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
const shutdown = async (signal: string) => {
  server.log.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    await server.close();
    server.log.info("Server closed. Exiting process.");
    process.exit(0);
  } catch (err) {
  server.log.error(`Error during shutdown: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
