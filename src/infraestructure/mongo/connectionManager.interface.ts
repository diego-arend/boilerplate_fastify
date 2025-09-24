import type mongoose from 'mongoose';

/**
 * Interface for MongoDB Connection Manager
 * Defines the contract for managing MongoDB connections with dependency injection
 */
export interface IMongoConnectionManager {
  /**
   * Connect to MongoDB
   */
  connect(): Promise<void>;

  /**
   * Disconnect from MongoDB
   */
  disconnect(): Promise<void>;

  /**
   * Get the current connection instance
   */
  getConnection(): mongoose.Connection;

  /**
   * Check if currently connected
   */
  isConnected(): boolean;

  /**
   * Get connection health information
   */
  getHealthInfo(): {
    isConnected: boolean;
    readyState: number;
    host?: string;
    port?: number;
    name?: string;
  };
}
