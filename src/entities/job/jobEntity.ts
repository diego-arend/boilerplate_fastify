import { Schema, model, Document } from 'mongoose';
import { z } from 'zod';

// ==========================================
// 1. INTERFACE DA ENTIDADE PARA REPOSITORY
// ==========================================

export interface IJob extends Document {
  // Core job fields
  jobId: string; // Unique identifier for the job
  type: string; // Job type (email:send, user:notification, etc.)
  data: Record<string, any>; // Job payload data
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number; // 1-20, higher = more priority

  // Processing metadata
  attempts: number; // Current attempt count
  maxAttempts: number; // Maximum allowed attempts
  processedAt?: Date; // When job was last processed
  processingTime?: number; // Processing time in milliseconds

  // Worker information
  workerId?: string; // ID of worker processing the job
  lockedAt?: Date; // When job was locked for processing
  lockTimeout?: Date; // When lock expires

  // Batch processing fields
  batchId?: string; // ID of the batch this job belongs to
  redisJobId?: string; // ID of the job in Redis/BullMQ

  // Scheduling
  scheduledFor?: Date; // When job should be processed
  delay?: number; // Delay in milliseconds before processing

  // Results and errors
  result?: Record<string, any>; // Job result data
  error?: string; // Last error message
  errorStack?: string; // Full error stack trace

  // Retry configuration
  backoffType?: 'fixed' | 'exponential';
  backoffDelay?: number; // Base delay for backoff

  // System fields (automatically managed)
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  isExpired(): boolean;
  canBeRetried(): boolean;
  incrementAttempts(): void;
  markAsProcessing(workerId: string): void;
  markAsCompleted(result?: any): void;
  markAsFailed(error: string, stack?: string): void;
  releaseLock(): void;
}

// ==========================================
// 2. VALIDAÇÕES ESPECÍFICAS DA ENTIDADE
// ==========================================

/**
 * Job-specific validation schemas and business rules
 */
export class JobValidations {
  // Job status enum
  static readonly JOB_STATUSES = [
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
  ] as const;

  // Job priority constants
  static readonly MIN_PRIORITY = 1;
  static readonly MAX_PRIORITY = 20;
  static readonly DEFAULT_PRIORITY = 5;

  // Attempt limits
  static readonly MIN_ATTEMPTS = 1;
  static readonly MAX_ATTEMPTS = 10;
  static readonly DEFAULT_MAX_ATTEMPTS = 3;

  // Timeout limits
  static readonly MIN_LOCK_TIMEOUT = 60000; // 1 minute
  static readonly MAX_LOCK_TIMEOUT = 3600000; // 1 hour
  static readonly DEFAULT_LOCK_TIMEOUT = 300000; // 5 minutes

  // Job status validation
  static readonly StatusSchema = z.enum(JobValidations.JOB_STATUSES, {
    message: 'Status must be: pending, processing, completed, failed, or cancelled'
  });

  // Priority validation
  static readonly PrioritySchema = z
    .number()
    .min(JobValidations.MIN_PRIORITY, `Priority must be at least ${JobValidations.MIN_PRIORITY}`)
    .max(JobValidations.MAX_PRIORITY, `Priority must be at most ${JobValidations.MAX_PRIORITY}`)
    .int('Priority must be an integer');

  // Attempts validation
  static readonly AttemptsSchema = z
    .number()
    .min(0, 'Attempts cannot be negative')
    .int('Attempts must be an integer');

  // Max attempts validation
  static readonly MaxAttemptsSchema = z
    .number()
    .min(
      JobValidations.MIN_ATTEMPTS,
      `Max attempts must be at least ${JobValidations.MIN_ATTEMPTS}`
    )
    .max(JobValidations.MAX_ATTEMPTS, `Max attempts must be at most ${JobValidations.MAX_ATTEMPTS}`)
    .int('Max attempts must be an integer');

  // Job ID validation
  static readonly JobIdSchema = z
    .string()
    .min(1, 'Job ID is required')
    .max(100, 'Job ID must be at most 100 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Job ID can only contain letters, numbers, hyphens, and underscores'
    );

  // Job type validation
  static readonly JobTypeSchema = z
    .string()
    .min(1, 'Job type is required')
    .max(50, 'Job type must be at most 50 characters')
    .regex(
      /^[a-z][a-z0-9]*:[a-z][a-z0-9]*$/,
      'Job type must follow format "namespace:action" (e.g., "email:send")'
    );

  // Complete job creation schema
  static readonly CreateJobSchema = z.object({
    jobId: JobValidations.JobIdSchema,
    type: JobValidations.JobTypeSchema,
    data: z.record(z.string(), z.any()).optional().default({}),
    priority: JobValidations.PrioritySchema.optional().default(JobValidations.DEFAULT_PRIORITY),
    maxAttempts: JobValidations.MaxAttemptsSchema.optional().default(
      JobValidations.DEFAULT_MAX_ATTEMPTS
    ),
    scheduledFor: z.date().optional(),
    delay: z.number().min(0).optional(),
    backoffType: z.enum(['fixed', 'exponential']).optional().default('exponential'),
    backoffDelay: z.number().min(100).optional().default(1000) // 1 second default
  });

  // Job update schema (for status changes, results, etc.)
  static readonly UpdateJobSchema = z.object({
    status: JobValidations.StatusSchema.optional(),
    processedAt: z.date().optional(),
    processingTime: z.number().min(0).optional(),
    workerId: z.string().min(1).max(100).optional(),
    lockedAt: z.date().optional(),
    lockTimeout: z.date().optional(),
    result: z.record(z.string(), z.any()).optional(),
    error: z.string().max(1000).optional(),
    errorStack: z.string().max(5000).optional(),
    attempts: JobValidations.AttemptsSchema.optional()
  });

  // Worker lock schema
  static readonly WorkerLockSchema = z.object({
    workerId: z.string().min(1).max(100),
    lockTimeout: z
      .number()
      .min(JobValidations.MIN_LOCK_TIMEOUT)
      .max(JobValidations.MAX_LOCK_TIMEOUT)
      .optional()
      .default(JobValidations.DEFAULT_LOCK_TIMEOUT)
  });

  /**
   * Validate job creation data
   */
  static validateCreateJob(data: unknown) {
    return JobValidations.CreateJobSchema.parse(data);
  }

  /**
   * Validate job update data
   */
  static validateUpdateJob(data: unknown) {
    return JobValidations.UpdateJobSchema.parse(data);
  }

  /**
   * Validate worker lock data
   */
  static validateWorkerLock(data: unknown) {
    return JobValidations.WorkerLockSchema.parse(data);
  }

  /**
   * Generate unique job ID
   */
  static generateJobId(type: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${type.replace(':', '_')}_${timestamp}_${random}`;
  }
}

// ==========================================
// 3. SCHEMA MONGOOSE PARA O MONGO
// ==========================================

const jobSchema = new Schema<IJob>(
  {
    jobId: {
      type: String,
      required: [true, 'Job ID is required'],
      unique: true,
      trim: true,
      minlength: [1, 'Job ID must have at least 1 character'],
      maxlength: [100, 'Job ID must have at most 100 characters'],
      validate: {
        validator: function (v: string) {
          try {
            JobValidations.JobIdSchema.parse(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid job ID format'
      }
    },

    type: {
      type: String,
      required: [true, 'Job type is required'],
      trim: true,
      minlength: [1, 'Job type must have at least 1 character'],
      maxlength: [50, 'Job type must have at most 50 characters'],
      validate: {
        validator: function (v: string) {
          try {
            JobValidations.JobTypeSchema.parse(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid job type format (must be "namespace:action")'
      }
    },

    data: {
      type: Schema.Types.Mixed,
      required: [true, 'Job data is required'],
      default: {}
    },

    status: {
      type: String,
      enum: {
        values: JobValidations.JOB_STATUSES,
        message: 'Status must be: pending, processing, completed, failed, or cancelled'
      },
      default: 'pending',
      index: true // Index for status queries
    },

    priority: {
      type: Number,
      required: [true, 'Priority is required'],
      min: [
        JobValidations.MIN_PRIORITY,
        `Priority must be at least ${JobValidations.MIN_PRIORITY}`
      ],
      max: [JobValidations.MAX_PRIORITY, `Priority must be at most ${JobValidations.MAX_PRIORITY}`],
      default: JobValidations.DEFAULT_PRIORITY,
      index: -1 // Descending index for priority sorting (higher priority first)
    },

    attempts: {
      type: Number,
      required: [true, 'Attempts is required'],
      min: [0, 'Attempts cannot be negative'],
      default: 0
    },

    maxAttempts: {
      type: Number,
      required: [true, 'Max attempts is required'],
      min: [
        JobValidations.MIN_ATTEMPTS,
        `Max attempts must be at least ${JobValidations.MIN_ATTEMPTS}`
      ],
      max: [
        JobValidations.MAX_ATTEMPTS,
        `Max attempts must be at most ${JobValidations.MAX_ATTEMPTS}`
      ],
      default: JobValidations.DEFAULT_MAX_ATTEMPTS
    },

    processedAt: {
      type: Date,
      default: null,
      index: true // Index for processing time queries
    },

    processingTime: {
      type: Number,
      min: [0, 'Processing time cannot be negative'],
      default: null
    },

    workerId: {
      type: String,
      maxlength: [100, 'Worker ID must be at most 100 characters'],
      default: null,
      index: true // Index for worker queries
    },

    lockedAt: {
      type: Date,
      default: null
    },

    lockTimeout: {
      type: Date,
      default: null,
      index: true // Index for lock timeout queries
    },

    batchId: {
      type: String,
      maxlength: [100, 'Batch ID must be at most 100 characters'],
      default: null,
      index: true // Index for batch queries
    },

    redisJobId: {
      type: String,
      maxlength: [100, 'Redis job ID must be at most 100 characters'],
      default: null,
      index: true // Index for Redis job ID queries
    },

    scheduledFor: {
      type: Date,
      default: null,
      index: true // Index for scheduled job queries
    },

    delay: {
      type: Number,
      min: [0, 'Delay cannot be negative'],
      default: null
    },

    result: {
      type: Schema.Types.Mixed,
      default: null
    },

    error: {
      type: String,
      maxlength: [1000, 'Error message must be at most 1000 characters'],
      default: null
    },

    errorStack: {
      type: String,
      maxlength: [5000, 'Error stack must be at most 5000 characters'],
      default: null,
      select: false // Don't return error stack by default
    },

    backoffType: {
      type: String,
      enum: ['fixed', 'exponential'],
      default: 'exponential'
    },

    backoffDelay: {
      type: Number,
      min: [100, 'Backoff delay must be at least 100ms'],
      default: 1000
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    versionKey: false, // Removes the __v field
    strict: true, // Prevents fields not defined in schema
    minimize: false // Keeps empty objects
  }
);

// ==========================================
// 4. INDEXES PARA PERFORMANCE
// ==========================================

// Compound indexes for common queries
jobSchema.index({ status: 1, priority: -1, createdAt: 1 }); // Priority queue ordering
jobSchema.index({ type: 1, status: 1, createdAt: -1 }); // Job type filtering
jobSchema.index({ workerId: 1, status: 1 }); // Worker job queries
jobSchema.index({ lockTimeout: 1, status: 1 }); // Lock cleanup queries
jobSchema.index({ scheduledFor: 1, status: 1 }); // Scheduled job queries
jobSchema.index({ createdAt: -1 }); // Recent jobs
jobSchema.index({ processedAt: -1 }, { sparse: true }); // Processed jobs

// ==========================================
// 5. MONGOOSE MIDDLEWARE E HOOKS
// ==========================================

// Pre-save data sanitization and validation
jobSchema.pre('save', function (next) {
  // Ensure jobId is generated ONLY if not provided
  if (!this.jobId && this.type) {
    this.jobId = JobValidations.generateJobId(this.type);
  }

  // Data sanitization
  if (this.type) {
    this.type = this.type.trim().toLowerCase();
  }

  // Skip status validation for new documents
  if (this.isNew) {
    return next();
  }

  // Validate job status transitions (only for existing documents)
  if (this.isModified('status')) {
    const validTransitions: Record<string, string[]> = {
      pending: ['processing', 'cancelled'],
      processing: ['completed', 'failed', 'cancelled'],
      completed: [], // Terminal state
      failed: ['pending', 'cancelled'], // Can be retried
      cancelled: [] // Terminal state
    };

    const currentStatus = this.status;
    const previousStatus = this.get('status', null, { getters: false });

    if (previousStatus && !validTransitions[previousStatus]?.includes(currentStatus)) {
      const error = new Error(
        `Invalid status transition from ${previousStatus} to ${currentStatus}`
      );
      return next(error);
    }
  }

  // Auto-increment attempts when status changes to processing
  if (this.isModified('status') && this.status === 'processing') {
    this.attempts = (this.attempts || 0) + 1;
  }

  next();
});

// Pre-update hooks for consistency
jobSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
  const update = this.getUpdate() as any;

  // Sanitize type if being updated
  if (update.$set?.type) {
    update.$set.type = update.$set.type.trim().toLowerCase();
  }

  // Set processedAt when status changes to completed or failed
  if (update.$set?.status && ['completed', 'failed'].includes(update.$set.status)) {
    update.$set.processedAt = new Date();
  }

  next();
});

// ==========================================
// 6. INSTANCE METHODS
// ==========================================

// Check if job lock has expired
jobSchema.methods.isExpired = function (): boolean {
  if (!this.lockTimeout) return false;
  return new Date() > this.lockTimeout;
};

// Check if job can be retried
jobSchema.methods.canBeRetried = function (): boolean {
  return this.attempts < this.maxAttempts && this.status === 'failed';
};

// Increment attempt counter
jobSchema.methods.incrementAttempts = function (): void {
  this.attempts = (this.attempts || 0) + 1;
};

// Mark job as being processed
jobSchema.methods.markAsProcessing = function (workerId: string): void {
  this.status = 'processing';
  this.workerId = workerId;
  this.lockedAt = new Date();
  this.lockTimeout = new Date(Date.now() + JobValidations.DEFAULT_LOCK_TIMEOUT);
};

// Mark job as completed
jobSchema.methods.markAsCompleted = function (result?: any): void {
  this.status = 'completed';
  this.processedAt = new Date();
  this.workerId = null;
  this.lockedAt = null;
  this.lockTimeout = null;
  if (result !== undefined) {
    this.result = result;
  }
};

// Mark job as failed
jobSchema.methods.markAsFailed = function (error: string, stack?: string): void {
  this.status = 'failed';
  this.processedAt = new Date();
  this.error = error?.substring(0, 1000); // Truncate to max length
  if (stack) {
    this.errorStack = stack.substring(0, 5000); // Truncate to max length
  }
  this.releaseLock();
};

// Release job lock
jobSchema.methods.releaseLock = function (): void {
  this.workerId = null;
  this.lockedAt = null;
  this.lockTimeout = null;
};

// ==========================================
// 7. STATIC METHODS
// ==========================================

// Find jobs ready for processing (ordered by priority)
jobSchema.statics.findReadyJobs = function (limit: number = 50) {
  const now = new Date();
  return this.find({
    status: 'pending',
    $or: [{ scheduledFor: null }, { scheduledFor: { $lte: now } }]
  })
    .sort({ priority: -1, createdAt: 1 }) // Higher priority first, then FIFO
    .limit(limit);
};

// Find expired locked jobs
jobSchema.statics.findExpiredJobs = function () {
  const now = new Date();
  return this.find({
    status: 'processing',
    lockTimeout: { $lt: now }
  });
};

// Find jobs by worker ID
jobSchema.statics.findByWorker = function (workerId: string) {
  return this.find({ workerId, status: 'processing' });
};

// Get job statistics
jobSchema.statics.getStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// ==========================================
// 8. MODEL EXPORT
// ==========================================

/**
 * Mongoose model for Job database operations
 * Export for use in repositories
 */
export const JobModel = model<IJob>('Job', jobSchema);
