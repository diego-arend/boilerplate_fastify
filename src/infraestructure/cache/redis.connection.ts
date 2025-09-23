import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import type { config } from '../../lib/validators/validateEnv.js';
import { defaultLogger } from '../../lib/logger/index.js';

/**
 * Redis connection singleton class
 * Manages a single Redis connection throughout the application lifecycle
 */
export class RedisConnection {
  private static instance: RedisConnection;
  private client: RedisClientType | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000; // 1 second
  private logger: ReturnType<typeof defaultLogger.child>;

  /**
   * Private constructor to ensure singleton pattern
   */
  private constructor() {
    this.logger = defaultLogger.child({ module: 'redis-connection' });
  }

  /**
   * Get the singleton instance of RedisConnection
   * @returns {RedisConnection} The singleton instance
   */
  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  /**
   * Connect to Redis server
   * @param {typeof config} appConfig - Application configuration containing Redis settings
   * @returns {Promise<RedisClientType>} The connected Redis client
   * @throws {Error} If connection fails after max attempts
   */
  public async connect(appConfig: typeof config): Promise<RedisClientType> {
    const connectionInfo = {
      host: appConfig.REDIS_HOST,
      port: appConfig.REDIS_PORT,
      db: appConfig.REDIS_DB,
      environment: process.env.NODE_ENV || 'development'
    };

    if (this.client && this.client.isOpen) {
      this.logger.info(connectionInfo, 'Redis connection already established');
      return this.client;
    }

    if (this.isConnecting) {
      // Wait for existing connection attempt
      await this.waitForConnection();
      if (this.client && this.client.isOpen) {
        return this.client;
      }
    }

    this.isConnecting = true;

    this.logger.info(
      {
        ...connectionInfo,
        attempt: this.reconnectAttempts + 1,
        maxAttempts: this.maxReconnectAttempts
      },
      'Attempting to connect to Redis'
    );

    try {
      // Create Redis client with configuration
      this.client = createClient({
        url: this.buildRedisUrl(appConfig),
        socket: {
          reconnectStrategy: retries => {
            if (retries >= this.maxReconnectAttempts) {
              this.logger.error(
                {
                  ...connectionInfo,
                  attempts: retries + 1
                },
                'Redis max reconnection attempts reached'
              );
              return false;
            }
            const delay = Math.min(this.reconnectDelay * Math.pow(2, retries), 30000);
            this.logger.warn(
              {
                ...connectionInfo,
                attempt: retries + 1,
                delayMs: delay
              },
              'Redis reconnecting...'
            );
            return delay;
          },
          connectTimeout: 10000 // 10 seconds
        }
      });

      // Setup event listeners
      this.setupEventListeners();

      // Connect to Redis
      await this.client.connect();

      this.isConnecting = false;
      this.reconnectAttempts = 0;

      this.logger.info(
        {
          ...connectionInfo,
          status: 'connected',
          clientReady: this.client.isReady
        },
        'Successfully connected to Redis'
      );

      return this.client;
    } catch (error) {
      this.isConnecting = false;
      this.reconnectAttempts++;

      this.logger.error(
        {
          ...connectionInfo,
          attempt: this.reconnectAttempts,
          error: error instanceof Error ? error : new Error(String(error))
        },
        'Redis connection failed'
      );

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error(`Redis: Failed to connect after ${this.maxReconnectAttempts} attempts`);
      }

      // Retry connection after delay
      await this.delay(this.reconnectDelay);
      return this.connect(appConfig);
    }
  }

  /**
   * Get the current Redis client instance
   * @returns {RedisClientType | null} The Redis client or null if not connected
   */
  public getClient(): RedisClientType | null {
    return this.client;
  }

  /**
   * Check if Redis is connected and ready
   * @returns {boolean} True if connected and ready
   */
  public isConnected(): boolean {
    return this.client !== null && this.client.isOpen;
  }

  /**
   * Disconnect from Redis server
   * @returns {Promise<void>}
   */
  public async disconnect(): Promise<void> {
    if (this.client && this.client.isOpen) {
      this.logger.info('Attempting to disconnect from Redis');
      try {
        await this.client.quit();
        this.logger.info('Redis disconnected gracefully');
      } catch (error) {
        this.logger.error(
          {
            error: error instanceof Error ? error : new Error(String(error))
          },
          'Error during Redis disconnect'
        );
      } finally {
        this.client = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
      }
    } else {
      this.logger.info('Redis already disconnected');
    }
  }

  /**
   * Force destroy the Redis connection
   * Use this for immediate shutdown without waiting for pending operations
   * @returns {Promise<void>}
   */
  public async destroy(): Promise<void> {
    if (this.client) {
      this.logger.info('Destroying Redis connection');
      try {
        await this.client.disconnect();
        this.logger.info('Redis connection destroyed');
      } catch (error) {
        this.logger.error(
          {
            error: error instanceof Error ? error : new Error(String(error))
          },
          'Error during Redis destroy'
        );
      } finally {
        this.client = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
      }
    }
  }

  /**
   * Ping Redis server to check connectivity
   * @returns {Promise<string>} PONG response from Redis
   * @throws {Error} If not connected or ping fails
   */
  public async ping(): Promise<string> {
    if (!this.client || !this.client.isOpen) {
      throw new Error('Redis: Not connected');
    }

    try {
      const result = await this.client.ping();
      this.logger.debug('Redis ping successful');
      return result;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error : new Error(String(error))
        },
        'Redis ping failed'
      );
      throw new Error('Redis: Ping failed');
    }
  }

  /**
   * Build Redis connection URL from configuration
   * @param {typeof config} appConfig - Application configuration
   * @returns {string} Redis connection URL
   * @private
   */
  private buildRedisUrl(appConfig: typeof config): string {
    const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB } = appConfig;

    let url = 'redis://';

    if (REDIS_PASSWORD) {
      url += `:${REDIS_PASSWORD}@`;
    }

    url += `${REDIS_HOST}:${REDIS_PORT}`;

    if (REDIS_DB && REDIS_DB > 0) {
      url += `/${REDIS_DB}`;
    }

    return url;
  }

  /**
   * Setup Redis client event listeners
   * @private
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('error', error => {
      this.logger.error({ error }, 'Redis client error');
    });

    this.client.on('connect', () => {
      this.logger.debug('Redis client connected');
    });

    this.client.on('ready', () => {
      this.logger.debug('Redis client ready');
    });

    this.client.on('end', () => {
      this.logger.info('Redis connection ended');
    });

    this.client.on('reconnecting', () => {
      this.logger.info('Redis reconnecting...');
    });
  }

  /**
   * Wait for existing connection attempt to complete
   * @private
   */
  private async waitForConnection(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds with 100ms intervals

    while (this.isConnecting && attempts < maxAttempts) {
      await this.delay(100);
      attempts++;
    }
  }

  /**
   * Delay utility function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Get the Redis connection singleton instance
 * @returns {RedisConnection} The singleton instance
 */
export const getRedisConnection = (): RedisConnection => {
  return RedisConnection.getInstance();
};

/**
 * Export Redis client type for external use
 */
export type { RedisClientType };
