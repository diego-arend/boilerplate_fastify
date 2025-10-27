import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import healthController from './health.controller.js';

export default async function healthPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // Register health routes
  await healthController(fastify);
}
