import "fastify";
import type { config } from "../lib/validateEnv";

declare module "fastify" {
  interface FastifyInstance {
    config: typeof config;
  }
}
