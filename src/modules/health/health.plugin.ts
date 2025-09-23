import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import healthController from './health.controller.js';

export default async function healthPlugin(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
) {
  // Register health routes
  await healthController(fastify);
}
