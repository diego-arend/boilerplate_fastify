/**
 * Document Entity - Simplified
 */

import mongoose from 'mongoose';
import { z } from 'zod';

export const DocumentValidationSchema = z.object({
  filename: z.string().min(1),
  originalName: z.string().min(1),
  fileSize: z.number().min(0),
  mimeType: z.string().min(1),
  uploadedBy: z.string().min(1),
  bucketKey: z.string().min(1),
  presignedUrl: z.string().optional(),
  presignedUrlExpiry: z.date().optional()
});

export interface IDocument extends mongoose.Document {
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  bucketKey: string;
  presignedUrl?: string;
  presignedUrlExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new mongoose.Schema<IDocument>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    uploadedBy: { type: String, required: true, index: true },
    bucketKey: { type: String, required: true, unique: true },
    presignedUrl: { type: String },
    presignedUrlExpiry: { type: Date }
  },
  {
    timestamps: true,
    collection: 'documents'
  }
);

DocumentSchema.index({ uploadedBy: 1, createdAt: -1 });

export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
