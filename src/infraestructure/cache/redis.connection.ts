import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import type { config } from '../../lib/validateEnv.js';

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

  /**
   * Private constructor to ensure singleton pattern
   */
  private constructor() {}

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
    if (this.client && this.client.isOpen) {
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

    try {
      // Create Redis client with configuration
      this.client = createClient({
        url: this.buildRedisUrl(appConfig),
        socket: {
          reconnectStrategy: (retries) => {
            if (retries >= this.maxReconnectAttempts) {
              console.error('Redis: Max reconnection attempts reached');
              return false;
            }
            const delay = Math.min(this.reconnectDelay * Math.pow(2, retries), 30000);
            console.log(`Redis: Reconnecting in ${delay}ms (attempt ${retries + 1})`);
            return delay;
          },
          connectTimeout: 10000, // 10 seconds
        },
      });

      // Setup event listeners
      this.setupEventListeners();

      // Connect to Redis
      await this.client.connect();
      
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      console.log('Redis: Successfully connected');
      return this.client;

    } catch (error) {
      this.isConnecting = false;
      this.reconnectAttempts++;
      
      console.error('Redis: Connection failed', error);
      
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
      try {
        await this.client.quit();
        console.log('Redis: Disconnected gracefully');
      } catch (error) {
        console.error('Redis: Error during disconnect', error);
      } finally {
        this.client = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
      }
    }
  }

  /**
   * Force destroy the Redis connection
   * Use this for immediate shutdown without waiting for pending operations
   * @returns {Promise<void>}
   */
  public async destroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
        console.log('Redis: Connection destroyed');
      } catch (error) {
        console.error('Redis: Error during destroy', error);
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
      return await this.client.ping();
    } catch (error) {
      console.error('Redis: Ping failed', error);
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

    this.client.on('error', (error) => {
      console.error('Redis: Client error', error);
    });

    this.client.on('connect', () => {
      console.log('Redis: Client connected');
    });

    this.client.on('ready', () => {
      console.log('Redis: Client ready');
    });

    this.client.on('end', () => {
      console.log('Redis: Connection ended');
    });

    this.client.on('reconnecting', () => {
      console.log('Redis: Reconnecting...');
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