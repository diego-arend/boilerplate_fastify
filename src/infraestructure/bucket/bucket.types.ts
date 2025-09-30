/**
 * Bucket Types
 *
 * Type definitions for bucket operations and configurations
 */

export interface BucketConfig {
  endpoint?: string;
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  forcePathStyle?: boolean;
}

export interface UploadFileOptions {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface GetPresignedUrlOptions {
  bucket: string;
  key: string;
  expiresIn?: number;
}

export interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
}

export interface BucketConnectionStatus {
  isConnected: boolean;
  endpoint: string;
  region: string;
  lastChecked: Date;
}
