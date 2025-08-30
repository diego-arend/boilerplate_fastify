import type { FastifyInstance, FastifyPluginAsync } from 'fastify'

export function registerModule(
  fastify: FastifyInstance,
  plugin: FastifyPluginAsync,
  prefix: string,
  moduleName: string
) {
  fastify.register(plugin, { prefix })
  fastify.log.info(`Module registered: ${moduleName}`)
}

