/**
 * Documents Module Types - Simplified
 */

export interface DocumentResponse {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  presignedUrl?: string;
  presignedUrlExpiry?: Date;
  createdAt: Date;
}
