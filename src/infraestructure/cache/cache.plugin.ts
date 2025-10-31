import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { getDataCache } from './index';

/**
 * Simplified Cache plugin for Fastify using DataCache (Redis db0)
 * Provides automatic caching capabilities for GET requests
 */
async function cachePlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  // Initialize simplified data cache
  const cache = getDataCache();
  await cache.connect();

  // Add cache to Fastify instance
  fastify.decorate('cache', cache);

  // Cache configuration options
  const cacheOptions = {
    defaultTTL: _opts.defaultTTL || 300, // Use _opts or fallback to 5 minutes
    enableAutoCache: true,
    // Skip cache for routes that are dynamic or shouldn't be cached:
    // - /health: monitoring endpoint, always fresh
    // - /auth/login: authentication, always fresh
    // - /auth/register: registration, always fresh
    skipRoutes: ['/health', '/auth/login', '/auth/register'],
    ..._opts
  };

  /**
   * Generate cache key for request
   */
  function generateCacheKey(request: FastifyRequest): string {
    const { method, url } = request;
    const userId = request.authenticatedUser?.id || 'anonymous';
    return `cache:${method}:${url}:${userId}`;
  }

  /**
   * Check if request should be cached
   */
  function shouldCache(request: FastifyRequest): boolean {
    if (request.method !== 'GET') return false;
    if (cacheOptions.skipRoutes.some((route: string) => request.url.startsWith(route))) {
      return false;
    }
    if (Object.keys(request.query as object).length > 0 && !request.cacheWithQuery) return false;
    return cacheOptions.enableAutoCache;
  }

  /**
   * Pre-handler hook to check cache
   */
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!shouldCache(request)) return;

    try {
      const cacheKey = generateCacheKey(request);
      const cached = await cache.get(cacheKey);

      if (cached) {
        reply.header('X-Cache', 'HIT');
        reply.send(cached);
        return;
      }

      request.cacheKey = cacheKey;
    } catch (error) {
      fastify.log.error(`Cache error: ${(error as Error).message}`);
    }
  });

  /**
   * OnSend hook to save responses
   */
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
    if (!request.cacheKey || reply.statusCode !== 200) return payload;

    try {
      const ttl = request.cacheTTL || cacheOptions.defaultTTL;
      await cache.set(request.cacheKey, payload, { ttl });
      reply.header('X-Cache', 'MISS');
    } catch (error) {
      fastify.log.error(`Cache save error: ${(error as Error).message}`);
    }

    return payload;
  }); // Utility methods
  fastify.decorate('setCacheForRoute', (key: string, data: any, ttl?: number) => {
    return cache.set(key, data, { ttl: ttl || cacheOptions.defaultTTL });
  });

  fastify.decorate('getCacheForRoute', (key: string) => {
    return cache.get(key);
  });

  fastify.decorate('invalidateCache', (key: string) => {
    return cache.del(key);
  });

  fastify.log.info('Simplified cache plugin registered successfully');
}

// Extend types
declare module 'fastify' {
  interface FastifyInstance {
    cache: import('./cache').DataCache;
    setCacheForRoute: (key: string, data: any, ttl?: number) => Promise<boolean>;
    getCacheForRoute: (key: string) => Promise<any>;
    invalidateCache: (key: string) => Promise<boolean>;
  }

  interface FastifyRequest {
    cacheKey?: string;
    cacheTTL?: number;
    cacheWithQuery?: boolean;
  }
}

export default fp(cachePlugin, {
  name: 'cache',
  fastify: '>=5.0.0'
});
