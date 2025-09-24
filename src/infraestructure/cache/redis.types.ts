/**
 * Redis configuration types and interfaces
 * Defines types for multiple Redis client configurations
 */

import type { config } from '../../lib/validators/validateEnv.js';

/**
 * Redis client types for different purposes
 */
export enum RedisClientType {
  CACHE = 'cache',
  QUEUE = 'queue'
}

/**
 * Redis connection configuration
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string | undefined;
  db: number;
  clientType: RedisClientType;
}

/**
 * Extract Redis configuration from app config for cache client
 */
export function getCacheRedisConfig(appConfig: typeof config): RedisConfig {
  return {
    host: appConfig.REDIS_HOST,
    port: appConfig.REDIS_PORT,
    password: appConfig.REDIS_PASSWORD,
    db: appConfig.REDIS_DB || 0,
    clientType: RedisClientType.CACHE
  };
}

/**
 * Extract Redis configuration from app config for queue client
 * Falls back to cache config if queue-specific config is not provided
 */
export function getQueueRedisConfig(appConfig: typeof config): RedisConfig {
  return {
    host: appConfig.QUEUE_REDIS_HOST || appConfig.REDIS_HOST,
    port: appConfig.QUEUE_REDIS_PORT || appConfig.REDIS_PORT,
    password: appConfig.QUEUE_REDIS_PASSWORD || appConfig.REDIS_PASSWORD,
    db: appConfig.QUEUE_REDIS_DB || 1, // Default to db1 for queue
    clientType: RedisClientType.QUEUE
  };
}

/**
 * Build Redis connection URL from configuration
 */
export function buildRedisUrl(config: RedisConfig): string {
  let url = 'redis://';

  if (config.password) {
    url += `:${config.password}@`;
  }

  url += `${config.host}:${config.port}`;

  if (config.db > 0) {
    url += `/${config.db}`;
  }

  return url;
}

/**
 * Redis connection status
 */
export interface RedisConnectionStatus {
  connected: boolean;
  ready: boolean;
  host: string;
  port: number;
  db: number;
  clientType: RedisClientType;
  lastConnected?: Date;
  lastError?: string;
}
