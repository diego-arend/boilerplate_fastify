import type { FastifyServerOptions } from 'fastify'

const config: FastifyServerOptions = {
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  pluginTimeout: 30000, // 30 seconds timeout for plugins
}

export default config