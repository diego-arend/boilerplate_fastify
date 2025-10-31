/**
 * Bucket Service
 *
 * High-level service for bucket operations using the connection manager
 */

import {
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { defaultLogger } from '../../lib/logger/index';
import type { Logger } from 'pino';
import type { IBucketConnectionManager } from './bucketConnectionManager.interface';
import type { UploadFileOptions, GetPresignedUrlOptions, FileInfo } from './bucket.types';

export class BucketService {
  private connectionManager: IBucketConnectionManager;
  private logger: Logger;

  constructor(connectionManager: IBucketConnectionManager, logger?: Logger) {
    this.connectionManager = connectionManager;
    this.logger = logger || defaultLogger.child({ component: 'BucketService' });
  }

  /**
   * Create a bucket if it doesn't exist
   */
  async createBucket(bucketName: string): Promise<void> {
    try {
      if (!this.connectionManager.isConnected()) {
        throw new Error('Bucket service not connected');
      }

      const client = this.connectionManager.getClient();
      const command = new CreateBucketCommand({ Bucket: bucketName });
      await client.send(command);
      this.logger.info(`Bucket created: ${bucketName}`);
    } catch (error: any) {
      // Bucket already exists
      if (error.name === 'BucketAlreadyOwnedByYou' || error.name === 'BucketAlreadyExists') {
        this.logger.debug(`Bucket already exists: ${bucketName}`);
        return;
      }
      this.logger.error(`Failed to create bucket ${bucketName}: ${error}`);
      throw error;
    }
  }

  /**
   * Upload a file to bucket
   */
  async uploadFile(options: UploadFileOptions): Promise<string> {
    try {
      if (!this.connectionManager.isConnected()) {
        throw new Error('Bucket service not connected');
      }

      const { bucket, key, body, contentType = 'application/octet-stream', metadata } = options;

      // Ensure bucket exists
      await this.createBucket(bucket);

      const client = this.connectionManager.getClient();
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata
      });

      await client.send(command);

      const fileUrl = this.getPublicUrl(bucket, key);
      this.logger.info(`File uploaded: ${key} to bucket ${bucket}`);

      return fileUrl;
    } catch (error) {
      this.logger.error(`Failed to upload file ${options.key}: ${error}`);
      throw error;
    }
  }

  /**
   * Download a file from bucket
   */
  async downloadFile(bucket: string, key: string): Promise<Buffer> {
    try {
      if (!this.connectionManager.isConnected()) {
        throw new Error('Bucket service not connected');
      }

      const client = this.connectionManager.getClient();
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });

      const response = await client.send(command);

      if (!response.Body) {
        throw new Error('No body in response');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      this.logger.info(`File downloaded: ${key} from bucket ${bucket}`);

      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download file ${key}: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a file from bucket
   */
  async deleteFile(bucket: string, key: string): Promise<void> {
    try {
      if (!this.connectionManager.isConnected()) {
        throw new Error('Bucket service not connected');
      }

      const client = this.connectionManager.getClient();
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      });

      await client.send(command);
      this.logger.info(`File deleted: ${key} from bucket ${bucket}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}: ${error}`);
      throw error;
    }
  }

  /**
   * List files in a bucket
   */
  async listFiles(bucket: string, prefix?: string): Promise<FileInfo[]> {
    try {
      if (!this.connectionManager.isConnected()) {
        throw new Error('Bucket service not connected');
      }

      const client = this.connectionManager.getClient();
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix
      });

      const response = await client.send(command);

      const files = (response.Contents || []).map((obj: any) => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date()
      }));

      this.logger.debug(`Listed ${files.length} files from bucket ${bucket}`);
      return files;
    } catch (error) {
      this.logger.error(`Failed to list files in bucket ${bucket}: ${error}`);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for temporary access
   */
  async getPresignedUrl(options: GetPresignedUrlOptions): Promise<string> {
    try {
      if (!this.connectionManager.isConnected()) {
        throw new Error('Bucket service not connected');
      }

      const { bucket, key, expiresIn = 3600 } = options; // 1 hour default

      const client = this.connectionManager.getClient();
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });

      const url = await getSignedUrl(client, command, { expiresIn });
      this.logger.debug(`Generated presigned URL for ${key}`);

      return url;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for ${options.key}: ${error}`);
      throw error;
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(bucket: string, key: string): string {
    const status = this.connectionManager.getConnectionStatus();

    if (status.endpoint && status.endpoint !== 'AWS S3') {
      // MinIO local endpoint
      return `${status.endpoint}/${bucket}/${key}`;
    } else {
      // AWS S3
      return `https://${bucket}.s3.${status.region}.amazonaws.com/${key}`;
    }
  }

  /**
   * Check if service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      return (
        this.connectionManager.isConnected() && (await this.connectionManager.testConnection())
      );
    } catch (error) {
      this.logger.error(`Bucket service health check failed: ${error}`);
      return false;
    }
  }
}
