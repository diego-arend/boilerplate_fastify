import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { defaultLogger } from '../../lib/logger/index.js';
import type { config } from '../../lib/validators/validateEnv.js';
import {
  RedisClientType as ClientType,
  type RedisConfig,
  type RedisConnectionStatus,
  getCacheRedisConfig,
  getQueueRedisConfig,
  buildRedisUrl
} from './redis.types.js';

/**
 * Multi-Redis Connection Manager
 * Manages separate Redis clients for cache and queue operations
 * Maintains singleton pattern for each client type
 */
export class MultiRedisConnectionManager {
  private static instance: MultiRedisConnectionManager;
  private clients: Map<ClientType, any> = new Map();
  private connectionAttempts: Map<ClientType, number> = new Map();
  private isConnecting: Map<ClientType, boolean> = new Map();
  private configs: Map<ClientType, RedisConfig> = new Map();
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000;
  private logger: ReturnType<typeof defaultLogger.child>;

  /**
   * Private constructor to ensure singleton pattern
   */
  private constructor() {
    this.logger = defaultLogger.child({ module: 'multi-redis-connection' });
  }

  /**
   * Get the singleton instance of MultiRedisConnectionManager
   */
  public static getInstance(): MultiRedisConnectionManager {
    if (!MultiRedisConnectionManager.instance) {
      MultiRedisConnectionManager.instance = new MultiRedisConnectionManager();
    }
    return MultiRedisConnectionManager.instance;
  }

  /**
   * Initialize and connect both Redis clients
   * @param appConfig - Application configuration
   */
  public async initializeAll(appConfig: typeof config): Promise<void> {
    const cacheConfig = getCacheRedisConfig(appConfig);
    const queueConfig = getQueueRedisConfig(appConfig);

    this.configs.set(ClientType.CACHE, cacheConfig);
    this.configs.set(ClientType.QUEUE, queueConfig);

    // Connect both clients in parallel
    await Promise.all([this.connect(ClientType.CACHE), this.connect(ClientType.QUEUE)]);

    this.logger.info('All Redis clients initialized successfully');
  }

  /**
   * Connect to specific Redis client type
   * @param clientType - Type of Redis client to connect
   */
  public async connect(clientType: ClientType): Promise<RedisClientType> {
    const config = this.configs.get(clientType);
    if (!config) {
      throw new Error(`No configuration found for Redis client type: ${clientType}`);
    }

    const existingClient = this.clients.get(clientType);
    if (existingClient && existingClient.isOpen) {
      this.logger.info(
        {
          clientType,
          host: config.host,
          port: config.port,
          db: config.db
        },
        'Redis client already connected'
      );
      return existingClient;
    }

    if (this.isConnecting.get(clientType)) {
      await this.waitForConnection(clientType);
      const client = this.clients.get(clientType);
      if (client && client.isOpen) {
        return client;
      }
    }

    this.isConnecting.set(clientType, true);
    const attempts = this.connectionAttempts.get(clientType) || 0;

    this.logger.info(
      {
        clientType,
        host: config.host,
        port: config.port,
        db: config.db,
        attempt: attempts + 1,
        maxAttempts: this.maxReconnectAttempts
      },
      'Attempting to connect to Redis'
    );

    try {
      // Create Redis client with configuration
      const client = createClient({
        url: buildRedisUrl(config),
        socket: {
          reconnectStrategy: retries => {
            if (retries >= this.maxReconnectAttempts) {
              this.logger.error(
                {
                  clientType,
                  host: config.host,
                  port: config.port,
                  db: config.db,
                  attempts: retries + 1
                },
                'Redis max reconnection attempts reached'
              );
              return false;
            }
            const delay = Math.min(this.reconnectDelay * Math.pow(2, retries), 30000);
            this.logger.warn(
              {
                clientType,
                host: config.host,
                port: config.port,
                db: config.db,
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
      this.setupEventListeners(client as any, clientType, config);

      // Connect to Redis
      await client.connect();

      this.clients.set(clientType, client as any);
      this.isConnecting.set(clientType, false);
      this.connectionAttempts.set(clientType, 0);

      this.logger.info(
        {
          clientType,
          host: config.host,
          port: config.port,
          db: config.db,
          status: 'connected',
          clientReady: client.isReady
        },
        'Successfully connected to Redis'
      );

      return client as RedisClientType;
    } catch (error) {
      this.isConnecting.set(clientType, false);
      const newAttempts = attempts + 1;
      this.connectionAttempts.set(clientType, newAttempts);

      this.logger.error(
        {
          clientType,
          host: config.host,
          port: config.port,
          db: config.db,
          attempt: newAttempts,
          error: error instanceof Error ? error : new Error(String(error))
        },
        'Redis connection failed'
      );

      if (newAttempts >= this.maxReconnectAttempts) {
        throw new Error(
          `Redis ${clientType}: Failed to connect after ${this.maxReconnectAttempts} attempts`
        );
      }

      // Retry connection after delay
      await this.delay(this.reconnectDelay);
      return this.connect(clientType);
    }
  }

  /**
   * Get specific Redis client
   * @param clientType - Type of Redis client to get
   */
  public getClient(clientType: ClientType): RedisClientType | null {
    return this.clients.get(clientType) || null;
  }

  /**
   * Get cache client (convenience method)
   */
  public getCacheClient(): RedisClientType | null {
    return this.getClient(ClientType.CACHE);
  }

  /**
   * Get queue client (convenience method)
   */
  public getQueueClient(): RedisClientType | null {
    return this.getClient(ClientType.QUEUE);
  }

  /**
   * Check if specific client is connected and ready
   * @param clientType - Type of Redis client to check
   */
  public isConnected(clientType: ClientType): boolean {
    const client = this.clients.get(clientType);
    return client !== null && client.isOpen;
  }

  /**
   * Get connection status for specific client
   * @param clientType - Type of Redis client to check
   */
  public getConnectionStatus(clientType: ClientType): RedisConnectionStatus {
    const client = this.clients.get(clientType);
    const config = this.configs.get(clientType);

    if (!config) {
      throw new Error(`No configuration found for Redis client type: ${clientType}`);
    }

    return {
      connected: client ? client.isOpen : false,
      ready: client?.isReady || false,
      host: config.host,
      port: config.port,
      db: config.db,
      clientType,
      ...(client && { lastConnected: new Date() })
    };
  }

  /**
   * Get status for all clients
   */
  public getAllConnectionStatus(): Record<ClientType, RedisConnectionStatus> {
    return {
      [ClientType.CACHE]: this.getConnectionStatus(ClientType.CACHE),
      [ClientType.QUEUE]: this.getConnectionStatus(ClientType.QUEUE)
    };
  }

  /**
   * Ping specific Redis client to check connectivity
   * @param clientType - Type of Redis client to ping
   */
  public async ping(clientType: ClientType): Promise<string> {
    const client = this.clients.get(clientType);
    if (!client || !client.isOpen) {
      throw new Error(`Redis ${clientType} client: Not connected`);
    }

    try {
      const result = await client.ping();
      this.logger.debug(`Redis ${clientType} ping successful`);
      return result;
    } catch (error) {
      this.logger.error(
        {
          clientType,
          error: error instanceof Error ? error : new Error(String(error))
        },
        `Redis ${clientType} ping failed`
      );
      throw new Error(`Redis ${clientType} client: Ping failed`);
    }
  }

  /**
   * Disconnect specific client
   * @param clientType - Type of Redis client to disconnect
   */
  public async disconnect(clientType: ClientType): Promise<void> {
    const client = this.clients.get(clientType);
    if (client && client.isOpen) {
      this.logger.info(`Attempting to disconnect Redis ${clientType} client`);
      try {
        await client.quit();
        this.clients.delete(clientType);
        this.logger.info(`Redis ${clientType} client disconnected gracefully`);
      } catch (error) {
        this.logger.error(
          {
            clientType,
            error: error instanceof Error ? error : new Error(String(error))
          },
          `Error during Redis ${clientType} disconnect`
        );
      }
    } else {
      this.logger.info(`Redis ${clientType} client already disconnected`);
    }
  }

  /**
   * Disconnect all clients gracefully
   */
  public async disconnectAll(): Promise<void> {
    await Promise.all([this.disconnect(ClientType.CACHE), this.disconnect(ClientType.QUEUE)]);

    this.connectionAttempts.clear();
    this.isConnecting.clear();
    this.configs.clear();

    this.logger.info('All Redis clients disconnected');
  }

  /**
   * Force destroy all connections
   */
  public async destroyAll(): Promise<void> {
    const clients = Array.from(this.clients.entries());

    await Promise.all(
      clients.map(async ([clientType, client]) => {
        if (client) {
          this.logger.info(`Destroying Redis ${clientType} connection`);
          try {
            await client.disconnect();
          } catch (error) {
            this.logger.error(
              {
                clientType,
                error: error instanceof Error ? error : new Error(String(error))
              },
              `Error during Redis ${clientType} destroy`
            );
          }
        }
      })
    );

    this.clients.clear();
    this.connectionAttempts.clear();
    this.isConnecting.clear();
    this.configs.clear();

    this.logger.info('All Redis connections destroyed');
  }

  /**
   * Setup Redis client event listeners
   * @private
   */
  private setupEventListeners(client: any, clientType: ClientType, config: RedisConfig): void {
    client.on('error', (error: any) => {
      this.logger.error({ clientType, error }, `Redis ${clientType} client error`);
    });

    client.on('connect', () => {
      this.logger.debug(`Redis ${clientType} client connected`);
    });

    client.on('ready', () => {
      this.logger.debug(`Redis ${clientType} client ready`);
    });

    client.on('end', () => {
      this.logger.info(`Redis ${clientType} connection ended`);
    });

    client.on('reconnecting', () => {
      this.logger.info(`Redis ${clientType} reconnecting...`);
    });
  }

  /**
   * Wait for existing connection attempt to complete
   * @private
   */
  private async waitForConnection(clientType: ClientType): Promise<void> {
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds with 100ms intervals

    while (this.isConnecting.get(clientType) && attempts < maxAttempts) {
      await this.delay(100);
      attempts++;
    }
  }

  /**
   * Delay utility function
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Get the multi-Redis connection manager singleton instance
 */
export const getMultiRedisConnectionManager = (): MultiRedisConnectionManager => {
  return MultiRedisConnectionManager.getInstance();
};

/**
 * Convenience functions for getting specific clients
 */
export const getCacheRedisClient = (): RedisClientType | null => {
  return getMultiRedisConnectionManager().getCacheClient();
};

export const getQueueRedisClient = (): RedisClientType | null => {
  return getMultiRedisConnectionManager().getQueueClient();
};
