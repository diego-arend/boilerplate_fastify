import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

export async function registerModule(
  fastify: FastifyInstance,
  plugin: FastifyPluginAsync,
  prefix: string,
  moduleName: string
) {
  await fastify.register(plugin, { prefix });
  fastify.log.info(`Module registered: ${moduleName}`);
}
