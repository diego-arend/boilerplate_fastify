import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import authPlugin from './modules/auth/auth.plugin.js'
import { registerModule } from './lib/modules.js'

export default async function app(fastify: FastifyInstance, opts: FastifyPluginOptions) {

  // Register modules automatically with logging
  registerModule(fastify, authPlugin, '/auth', 'auth')
}

export const options = {}