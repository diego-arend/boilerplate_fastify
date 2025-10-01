import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

/**
 * Multipart Plugin - File upload support
 */
async function multipartPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  fastify.log.info('Registering multipart plugin...');

  try {
    // Dynamic import to avoid module resolution issues
    const { default: fastifyMultipart } = await import('@fastify/multipart');

    await fastify.register(fastifyMultipart, {
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size
      }
    });

    fastify.log.info('Multipart plugin registered successfully');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to register multipart plugin');
    throw error;
  }
}

export default fastifyPlugin(multipartPlugin, {
  name: 'multipart-plugin'
});
