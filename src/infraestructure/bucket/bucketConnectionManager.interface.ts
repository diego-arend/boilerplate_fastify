/**
 * Bucket Connection Manager Interface
 *
 * Interface for managing bucket connections (MinIO/S3)
 */

import type { BucketConfig, BucketConnectionStatus } from './bucket.types';

export interface IBucketConnectionManager {
  /**
   * Initialize bucket connection
   */
  connect(config: BucketConfig): Promise<void>;

  /**
   * Disconnect from bucket service
   */
  disconnect(): Promise<void>;

  /**
   * Check if connected to bucket service
   */
  isConnected(): boolean;

  /**
   * Get connection status
   */
  getConnectionStatus(): BucketConnectionStatus;

  /**
   * Test connection health
   */
  testConnection(): Promise<boolean>;

  /**
   * Get the S3 client instance
   */
  getClient(): any;
}
