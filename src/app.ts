import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import authPlugin from './modules/auth/auth.plugin.js'
import { registerModule } from './infraestructure/server/modules.js'
import MongoConnection from './infraestructure/mongo/connection.js'

export default async function app(fastify: FastifyInstance, opts: FastifyPluginOptions) {

  // Connect to MongoDB
  const mongoConnection = MongoConnection.getInstance();
  await mongoConnection.connect();

  // Decorate fastify with mongo connection for potential use
  fastify.decorate('mongo', mongoConnection);

  // Register modules automatically with logging
  registerModule(fastify, authPlugin, '/auth', 'auth')

  // Graceful shutdown for MongoDB
  fastify.addHook('onClose', async () => {
    await mongoConnection.disconnect();
  });
}

export const options = {}