import type { FastifyInstance, FastifyPluginAsync, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import queueController from './queue.controller.js';

export interface QueuePluginOptions extends FastifyPluginOptions {
  // Plugin-specific options can be added here
}

const queuePlugin: FastifyPluginAsync<QueuePluginOptions> = async (
  fastify: FastifyInstance,
  opts: QueuePluginOptions
) => {
  // Register queue controller routes
  await fastify.register(queueController);
};

export default fp(queuePlugin, {
  fastify: '5.x',
  name: 'queue-plugin'
});