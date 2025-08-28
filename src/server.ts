import { fastify } from 'fastify'
import config from './fastify.config.js'
import app from './app.js'

const server = fastify(config)

server.register(app)

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' })
    server.log.info('Server running on http://localhost:3000')
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
