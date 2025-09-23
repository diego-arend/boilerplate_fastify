import 'fastify';
import type { config } from '../../lib/validators/validateEnv.ts';

declare module 'fastify' {
  interface FastifyInstance {
    config: typeof config;
  }
}
