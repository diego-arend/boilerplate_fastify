/**
 * Dead Letter Queue Entity
 *
 * Represents failed jobs that couldn't be processed
 * stored permanently for analysis and potential reprocessing
 */

import { Schema, Document, model, type Model } from 'mongoose';
import { z } from 'zod';

export interface IDeadLetterQueue extends Document {
  _id: string;
  originalJobId: string;
  jobId: string;
  type: string;
  data: Record<string, any>;
  priority: number;
  attempts: number;
  maxAttempts: number;

  // Failure information
  failedAt: Date;
  finalError: string;
  finalErrorStack?: string;
  allErrors: Array<{
    attempt: number;
    error: string;
    errorStack?: string;
    failedAt: Date;
  }>;

  // Original job metadata
  originalCreatedAt: Date;
  processingHistory: Array<{
    startedAt: Date;
    completedAt?: Date;
    workerId?: string;
    status: 'processing' | 'failed';
    error?: string;
  }>;

  // DLQ metadata
  reason: DLQReason;
  metadata: {
    batchId?: string;
    redisJobId?: string;
    lastWorkerId?: string;
    environment: string;
    version: string;
  };

  // Reprocessing
  reprocessed: boolean;
  reprocessedAt?: Date;
  reprocessingJobId?: string;

  // System fields
  createdAt: Date;
  updatedAt: Date;
}

export enum DLQReason {
  MAX_ATTEMPTS_EXCEEDED = 'max_attempts_exceeded',
  FATAL_ERROR = 'fatal_error',
  TIMEOUT = 'timeout',
  INVALID_DATA = 'invalid_data',
  DEPENDENCY_FAILURE = 'dependency_failure',
  SYSTEM_ERROR = 'system_error'
}

/**
 * Dead Letter Queue validation schemas
 */
export class DLQValidations {
  static readonly DLQ_REASONS = [
    'max_attempts_exceeded',
    'fatal_error',
    'timeout',
    'invalid_data',
    'dependency_failure',
    'system_error'
  ] as const;

  static readonly ReasonSchema = z.enum(DLQValidations.DLQ_REASONS, {
    message: 'Invalid DLQ reason'
  });

  static readonly CreateDLQSchema = z.object({
    originalJobId: z.string().min(1, 'Original job ID is required'),
    jobId: z.string().min(1, 'Job ID is required'),
    type: z.string().min(1, 'Job type is required'),
    data: z.record(z.string(), z.any()).default({}),
    priority: z.number().min(1).max(20).default(5),
    attempts: z.number().min(0).default(0),
    maxAttempts: z.number().min(1).default(3),
    finalError: z.string().min(1, 'Final error is required'),
    finalErrorStack: z.string().optional(),
    allErrors: z
      .array(
        z.object({
          attempt: z.number().min(1),
          error: z.string().min(1),
          errorStack: z.string().optional(),
          failedAt: z.date()
        })
      )
      .default([]),
    originalCreatedAt: z.date(),
    processingHistory: z
      .array(
        z.object({
          startedAt: z.date(),
          completedAt: z.date().optional(),
          workerId: z.string().optional(),
          status: z.enum(['processing', 'failed']),
          error: z.string().optional()
        })
      )
      .default([]),
    reason: DLQValidations.ReasonSchema,
    metadata: z
      .object({
        batchId: z.string().optional(),
        redisJobId: z.string().optional(),
        lastWorkerId: z.string().optional(),
        environment: z.string().default(process.env.NODE_ENV || 'development'),
        version: z.string().default('1.0.0')
      })
      .default(() => ({
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      }))
  });

  static validateCreateDLQ(data: unknown) {
    return DLQValidations.CreateDLQSchema.parse(data);
  }
}

const deadLetterQueueSchema = new Schema<IDeadLetterQueue>(
  {
    originalJobId: {
      type: String,
      required: true,
      index: true
    },
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      index: true
    },
    data: {
      type: Schema.Types.Mixed,
      required: true
    },
    priority: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      default: 5
    },
    attempts: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    maxAttempts: {
      type: Number,
      required: true,
      min: 1,
      default: 3
    },
    failedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    finalError: {
      type: String,
      required: true,
      maxlength: 2000
    },
    finalErrorStack: {
      type: String,
      maxlength: 10000
    },
    allErrors: [
      {
        attempt: {
          type: Number,
          required: true,
          min: 1
        },
        error: {
          type: String,
          required: true,
          maxlength: 2000
        },
        errorStack: {
          type: String,
          maxlength: 10000
        },
        failedAt: {
          type: Date,
          required: true
        }
      }
    ],
    originalCreatedAt: {
      type: Date,
      required: true,
      index: true
    },
    processingHistory: [
      {
        startedAt: {
          type: Date,
          required: true
        },
        completedAt: Date,
        workerId: String,
        status: {
          type: String,
          enum: ['processing', 'failed'],
          required: true
        },
        error: String
      }
    ],
    reason: {
      type: String,
      enum: Object.values(DLQReason),
      required: true,
      index: true
    },
    metadata: {
      batchId: String,
      redisJobId: String,
      lastWorkerId: String,
      environment: {
        type: String,
        required: true,
        default: process.env.NODE_ENV || 'development'
      },
      version: {
        type: String,
        required: true,
        default: '1.0.0'
      }
    },
    reprocessed: {
      type: Boolean,
      default: false,
      index: true
    },
    reprocessedAt: Date,
    reprocessingJobId: String
  },
  {
    timestamps: true,
    collection: 'dead_letter_queue'
  }
);

// Indexes for performance and analytics
deadLetterQueueSchema.index({ type: 1, failedAt: -1 });
deadLetterQueueSchema.index({ reason: 1, failedAt: -1 });
deadLetterQueueSchema.index({ reprocessed: 1, failedAt: -1 });
deadLetterQueueSchema.index({ 'metadata.environment': 1, failedAt: -1 });

// Static methods for analytics
deadLetterQueueSchema.statics.getFailureStats = function (fromDate?: Date, toDate?: Date) {
  const match: any = {};

  if (fromDate || toDate) {
    match.failedAt = {};
    if (fromDate) match.failedAt.$gte = fromDate;
    if (toDate) match.failedAt.$lte = toDate;
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          type: '$type',
          reason: '$reason'
        },
        count: { $sum: 1 },
        avgAttempts: { $avg: '$attempts' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

deadLetterQueueSchema.statics.getTopFailureReasons = function (limit: number = 10) {
  return this.aggregate([
    {
      $group: {
        _id: '$reason',
        count: { $sum: 1 },
        types: { $addToSet: '$type' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

export const DeadLetterQueue: Model<IDeadLetterQueue> = model<IDeadLetterQueue>(
  'DeadLetterQueue',
  deadLetterQueueSchema
);
