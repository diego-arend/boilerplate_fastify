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
  // Other configuration options
}

export default config