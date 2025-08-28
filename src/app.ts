import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function app(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.get('/', async (request, reply) => {
    return { hello: 'world' }
  })
}

export const options = {}