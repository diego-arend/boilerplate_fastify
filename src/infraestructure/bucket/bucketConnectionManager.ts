/**
 * Bucket Connection Manager
 *
 * Manages S3/MinIO connections with health monitoring and reconnection logic
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { defaultLogger } from '../../lib/logger/index';
import type { Logger } from 'pino';
import type { IBucketConnectionManager } from './bucketConnectionManager.interface';
import type { BucketConfig, BucketConnectionStatus } from './bucket.types';

export class BucketConnectionManager implements IBucketConnectionManager {
  private client: S3Client | null = null;
  private config: BucketConfig | null = null;
  private logger: Logger;
  private connectionStatus: BucketConnectionStatus;

  constructor(logger?: Logger) {
    this.logger = logger || defaultLogger.child({ component: 'BucketConnectionManager' });
    this.connectionStatus = {
      isConnected: false,
      endpoint: '',
      region: '',
      lastChecked: new Date()
    };
  }

  /**
   * Initialize bucket connection
   */
  async connect(config: BucketConfig): Promise<void> {
    try {
      this.config = config;
      this.logger.info(`Connecting to bucket service: ${config.endpoint || 'AWS S3'}`);

      // Build client configuration
      const clientConfig: any = {
        region: config.region,
        forcePathStyle: config.forcePathStyle || false
      };

      if (config.endpoint) {
        clientConfig.endpoint = config.endpoint;
      }

      if (config.credentials) {
        clientConfig.credentials = config.credentials;
      }

      this.client = new S3Client(clientConfig);

      // Test connection
      const isHealthy = await this.testConnection();
      if (!isHealthy) {
        throw new Error('Failed to establish healthy connection to bucket service');
      }

      this.connectionStatus = {
        isConnected: true,
        endpoint: config.endpoint || 'AWS S3',
        region: config.region,
        lastChecked: new Date()
      };

      this.logger.info('Successfully connected to bucket service');
    } catch (error) {
      this.logger.error(`Failed to connect to bucket service: ${error}`);
      this.connectionStatus.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from bucket service
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        // S3Client doesn't have explicit disconnect method
        this.client = null;
        this.config = null;
        this.connectionStatus.isConnected = false;
        this.logger.info('Disconnected from bucket service');
      }
    } catch (error) {
      this.logger.error(`Error during bucket service disconnect: ${error}`);
      throw error;
    }
  }

  /**
   * Check if connected to bucket service
   */
  isConnected(): boolean {
    return this.connectionStatus.isConnected && this.client !== null;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): BucketConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Test connection health
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      // Try to list objects from a non-existent bucket to test connection
      // This will fail with NoSuchBucket but indicates service is reachable
      await this.client.send(
        new ListObjectsV2Command({
          Bucket: 'health-check-bucket-test',
          MaxKeys: 1
        })
      );

      this.connectionStatus.lastChecked = new Date();
      return true;
    } catch (error: any) {
      // If error is NoSuchBucket, service is reachable
      if (error.name === 'NoSuchBucket') {
        this.connectionStatus.lastChecked = new Date();
        return true;
      }

      this.logger.error(`Bucket service health check failed: ${error}`);
      this.connectionStatus.lastChecked = new Date();
      return false;
    }
  }

  /**
   * Get the S3 client instance
   */
  getClient(): S3Client {
    if (!this.client) {
      throw new Error('Bucket service not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Reconnect to bucket service
   */
  async reconnect(): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration available for reconnection');
    }

    this.logger.info('Attempting to reconnect to bucket service');
    await this.disconnect();
    await this.connect(this.config);
  }

  /**
   * Monitor connection health
   */
  startHealthMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(async () => {
      if (this.isConnected()) {
        const isHealthy = await this.testConnection();
        if (!isHealthy) {
          this.logger.warn('Bucket service health check failed, attempting reconnection');
          try {
            await this.reconnect();
          } catch (error) {
            this.logger.error(`Failed to reconnect to bucket service: ${error}`);
          }
        }
      }
    }, intervalMs);
  }
}
