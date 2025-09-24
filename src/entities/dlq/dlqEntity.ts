import { Schema, model, Document } from 'mongoose';
import { z } from 'zod';
import { sanitizeInput } from '../../lib/validators/index.js';

// ==========================================
// 1. INTERFACE DA ENTIDADE PARA REPOSITORY
// ==========================================

export interface IDLQ extends Document {
  // Original job information
  originalJobId: string; // ID of the original job that failed
  jobType: string; // Type of job that failed
  jobData: Record<string, any>; // Original job data

  // Failure information
  failureReason: string; // Primary reason for failure
  errorStack?: string; // Full error stack trace
  attempts: number; // Number of attempts made before moving to DLQ
  maxAttempts: number; // Maximum attempts that were allowed

  // Processing context
  workerId?: string; // Worker that processed the job last
  processingTime?: number; // Time spent processing before failure
  lastProcessedAt: Date; // When the job was last processed

  // DLQ metadata
  movedToDLQAt: Date; // When job was moved to DLQ
  dlqReason: string; // Reason for moving to DLQ (exhausted_retries, permanent_failure, etc.)
  severity: 'low' | 'medium' | 'high' | 'critical'; // Failure severity level

  // Reprocessing tracking
  reprocessAttempts: number; // Number of times job was reprocessed from DLQ
  maxReprocessAttempts: number; // Maximum reprocess attempts allowed
  lastReprocessedAt?: Date; // When job was last reprocessed from DLQ
  reprocessedBy?: string; // Who/what initiated the reprocessing

  // Business impact tracking
  userId?: string; // User affected by this failure
  businessContext?: Record<string, any>; // Additional business context
  impactLevel?: string; // Business impact assessment

  // Resolution tracking
  status: 'pending' | 'investigating' | 'resolved' | 'ignored' | 'reprocessed';
  resolvedAt?: Date; // When the issue was resolved
  resolvedBy?: string; // Who resolved the issue
  resolution?: string; // How the issue was resolved

  // System fields (automatically managed)
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  canBeReprocessed(): boolean;
  markAsReprocessed(reprocessedBy: string): void;
  markAsResolved(resolvedBy: string, resolution: string): void;
  isStale(days: number): boolean;
}

// ==========================================
// 2. VALIDAÇÕES ESPECÍFICAS DA ENTIDADE
// ==========================================

/**
 * DLQ-specific validation schemas and business rules
 */
export class DLQValidations {
  // DLQ status enum
  static readonly DLQ_STATUSES = [
    'pending',
    'investigating',
    'resolved',
    'ignored',
    'reprocessed'
  ] as const;

  // Severity levels
  static readonly SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

  // DLQ reasons
  static readonly DLQ_REASONS = [
    'exhausted_retries',
    'permanent_failure',
    'timeout',
    'validation_error',
    'system_error',
    'manual_move',
    'dependency_failure'
  ] as const;

  // Limits
  static readonly MAX_REPROCESS_ATTEMPTS = 3;
  static readonly MAX_ERROR_LENGTH = 2000;
  static readonly MAX_STACK_LENGTH = 10000;
  static readonly MAX_RESOLUTION_LENGTH = 1000;

  // Status validation
  static readonly StatusSchema = z.enum(DLQValidations.DLQ_STATUSES, {
    message: 'Status must be: pending, investigating, resolved, ignored, or reprocessed'
  });

  // Severity validation
  static readonly SeveritySchema = z.enum(DLQValidations.SEVERITY_LEVELS, {
    message: 'Severity must be: low, medium, high, or critical'
  });

  // DLQ reason validation
  static readonly DLQReasonSchema = z.enum(DLQValidations.DLQ_REASONS, {
    message: 'DLQ reason must be a valid predefined reason'
  });

  // Attempts validation
  static readonly AttemptsSchema = z
    .number()
    .min(1, 'Attempts must be at least 1')
    .max(20, 'Attempts cannot exceed 20')
    .int('Attempts must be an integer');

  // Reprocess attempts validation
  static readonly ReprocessAttemptsSchema = z
    .number()
    .min(0, 'Reprocess attempts cannot be negative')
    .max(
      DLQValidations.MAX_REPROCESS_ATTEMPTS,
      `Reprocess attempts cannot exceed ${DLQValidations.MAX_REPROCESS_ATTEMPTS}`
    )
    .int('Reprocess attempts must be an integer');

  // Job type validation (matches job entity)
  static readonly JobTypeSchema = z
    .string()
    .min(1, 'Job type is required')
    .max(50, 'Job type must be at most 50 characters')
    .regex(/^[a-z][a-z0-9]*:[a-z][a-z0-9]*$/, 'Job type must follow format "namespace:action"');

  // Complete DLQ entry creation schema
  static readonly CreateDLQSchema = z.object({
    originalJobId: z.string().min(1, 'Original job ID is required').max(100),
    jobType: DLQValidations.JobTypeSchema,
    jobData: z.record(z.string(), z.any()).optional().default({}),
    failureReason: z
      .string()
      .min(1, 'Failure reason is required')
      .max(DLQValidations.MAX_ERROR_LENGTH),
    errorStack: z.string().max(DLQValidations.MAX_STACK_LENGTH).optional(),
    attempts: DLQValidations.AttemptsSchema,
    maxAttempts: DLQValidations.AttemptsSchema,
    workerId: z.string().min(1).max(100).optional(),
    processingTime: z.number().min(0).optional(),
    lastProcessedAt: z.date(),
    dlqReason: DLQValidations.DLQReasonSchema,
    severity: DLQValidations.SeveritySchema.optional().default('medium'),
    userId: z.string().min(1).max(100).optional(),
    businessContext: z.record(z.string(), z.any()).optional(),
    impactLevel: z.string().max(100).optional()
  });

  // DLQ update schema
  static readonly UpdateDLQSchema = z.object({
    status: DLQValidations.StatusSchema.optional(),
    severity: DLQValidations.SeveritySchema.optional(),
    resolvedAt: z.date().optional(),
    resolvedBy: z.string().min(1).max(100).optional(),
    resolution: z.string().max(DLQValidations.MAX_RESOLUTION_LENGTH).optional(),
    lastReprocessedAt: z.date().optional(),
    reprocessedBy: z.string().min(1).max(100).optional(),
    reprocessAttempts: DLQValidations.ReprocessAttemptsSchema.optional(),
    businessContext: z.record(z.string(), z.any()).optional(),
    impactLevel: z.string().max(100).optional()
  });

  // Reprocessing schema
  static readonly ReprocessSchema = z.object({
    reprocessedBy: z.string().min(1, 'Reprocessed by is required').max(100),
    resetJobData: z.record(z.string(), z.any()).optional(),
    increaseMaxAttempts: z.boolean().optional().default(false)
  });

  // Resolution schema
  static readonly ResolutionSchema = z.object({
    resolvedBy: z.string().min(1, 'Resolved by is required').max(100),
    resolution: z
      .string()
      .min(1, 'Resolution description is required')
      .max(DLQValidations.MAX_RESOLUTION_LENGTH)
  });

  /**
   * Validate DLQ entry creation data
   */
  static validateCreateDLQ(data: unknown) {
    return DLQValidations.CreateDLQSchema.parse(data);
  }

  /**
   * Validate DLQ update data
   */
  static validateUpdateDLQ(data: unknown) {
    return DLQValidations.UpdateDLQSchema.parse(data);
  }

  /**
   * Validate reprocessing data
   */
  static validateReprocess(data: unknown) {
    return DLQValidations.ReprocessSchema.parse(data);
  }

  /**
   * Validate resolution data
   */
  static validateResolution(data: unknown) {
    return DLQValidations.ResolutionSchema.parse(data);
  }

  /**
   * Determine severity based on job type and failure reason
   */
  static determineSeverity(
    jobType: string,
    failureReason: string,
    attempts: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical jobs that should never fail
    const criticalJobTypes = ['email:send', 'payment:process', 'notification:push'];
    if (criticalJobTypes.includes(jobType)) {
      return 'critical';
    }

    // High priority based on failure type
    const criticalFailures = ['validation_error', 'system_error', 'dependency_failure'];
    if (criticalFailures.includes(failureReason)) {
      return 'high';
    }

    // Medium priority for repeated failures
    if (attempts >= 5) {
      return 'high';
    }

    if (attempts >= 3) {
      return 'medium';
    }

    return 'low';
  }
}

// ==========================================
// 3. SCHEMA MONGOOSE PARA O MONGO
// ==========================================

const dlqSchema = new Schema<IDLQ>(
  {
    originalJobId: {
      type: String,
      required: [true, 'Original job ID is required'],
      trim: true,
      minlength: [1, 'Original job ID must have at least 1 character'],
      maxlength: [100, 'Original job ID must have at most 100 characters'],
      index: true // Index for finding by original job ID
    },

    jobType: {
      type: String,
      required: [true, 'Job type is required'],
      trim: true,
      minlength: [1, 'Job type must have at least 1 character'],
      maxlength: [50, 'Job type must have at most 50 characters'],
      validate: {
        validator: function (v: string) {
          try {
            DLQValidations.JobTypeSchema.parse(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid job type format (must be "namespace:action")'
      },
      index: true // Index for filtering by job type
    },

    jobData: {
      type: Schema.Types.Mixed,
      required: [true, 'Job data is required'],
      default: {}
    },

    failureReason: {
      type: String,
      required: [true, 'Failure reason is required'],
      trim: true,
      minlength: [1, 'Failure reason must have at least 1 character'],
      maxlength: [
        DLQValidations.MAX_ERROR_LENGTH,
        `Failure reason must have at most ${DLQValidations.MAX_ERROR_LENGTH} characters`
      ]
    },

    errorStack: {
      type: String,
      maxlength: [
        DLQValidations.MAX_STACK_LENGTH,
        `Error stack must have at most ${DLQValidations.MAX_STACK_LENGTH} characters`
      ],
      default: null,
      select: false // Don't return error stack by default
    },

    attempts: {
      type: Number,
      required: [true, 'Attempts is required'],
      min: [1, 'Attempts must be at least 1'],
      max: [20, 'Attempts cannot exceed 20']
    },

    maxAttempts: {
      type: Number,
      required: [true, 'Max attempts is required'],
      min: [1, 'Max attempts must be at least 1'],
      max: [20, 'Max attempts cannot exceed 20']
    },

    workerId: {
      type: String,
      maxlength: [100, 'Worker ID must be at most 100 characters'],
      default: null
    },

    processingTime: {
      type: Number,
      min: [0, 'Processing time cannot be negative'],
      default: null
    },

    lastProcessedAt: {
      type: Date,
      required: [true, 'Last processed at is required'],
      index: true // Index for time-based queries
    },

    movedToDLQAt: {
      type: Date,
      required: [true, 'Moved to DLQ at is required'],
      default: Date.now,
      index: true // Index for age-based queries
    },

    dlqReason: {
      type: String,
      enum: {
        values: DLQValidations.DLQ_REASONS,
        message: 'DLQ reason must be a valid predefined reason'
      },
      required: [true, 'DLQ reason is required'],
      index: true // Index for filtering by reason
    },

    severity: {
      type: String,
      enum: {
        values: DLQValidations.SEVERITY_LEVELS,
        message: 'Severity must be: low, medium, high, or critical'
      },
      default: 'medium',
      index: true // Index for severity filtering
    },

    reprocessAttempts: {
      type: Number,
      min: [0, 'Reprocess attempts cannot be negative'],
      max: [
        DLQValidations.MAX_REPROCESS_ATTEMPTS,
        `Reprocess attempts cannot exceed ${DLQValidations.MAX_REPROCESS_ATTEMPTS}`
      ],
      default: 0
    },

    maxReprocessAttempts: {
      type: Number,
      min: [1, 'Max reprocess attempts must be at least 1'],
      max: [
        DLQValidations.MAX_REPROCESS_ATTEMPTS,
        `Max reprocess attempts cannot exceed ${DLQValidations.MAX_REPROCESS_ATTEMPTS}`
      ],
      default: DLQValidations.MAX_REPROCESS_ATTEMPTS
    },

    lastReprocessedAt: {
      type: Date,
      default: null
    },

    reprocessedBy: {
      type: String,
      maxlength: [100, 'Reprocessed by must be at most 100 characters'],
      default: null
    },

    userId: {
      type: String,
      maxlength: [100, 'User ID must be at most 100 characters'],
      default: null,
      index: true // Index for user-specific queries
    },

    businessContext: {
      type: Schema.Types.Mixed,
      default: null
    },

    impactLevel: {
      type: String,
      maxlength: [100, 'Impact level must be at most 100 characters'],
      default: null
    },

    status: {
      type: String,
      enum: {
        values: DLQValidations.DLQ_STATUSES,
        message: 'Status must be: pending, investigating, resolved, ignored, or reprocessed'
      },
      default: 'pending',
      index: true // Index for status filtering
    },

    resolvedAt: {
      type: Date,
      default: null,
      index: true // Index for resolution tracking
    },

    resolvedBy: {
      type: String,
      maxlength: [100, 'Resolved by must be at most 100 characters'],
      default: null
    },

    resolution: {
      type: String,
      maxlength: [
        DLQValidations.MAX_RESOLUTION_LENGTH,
        `Resolution must have at most ${DLQValidations.MAX_RESOLUTION_LENGTH} characters`
      ],
      default: null
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
dlqSchema.index({ jobType: 1, status: 1, movedToDLQAt: -1 }); // Job type analysis
dlqSchema.index({ severity: 1, status: 1, movedToDLQAt: -1 }); // Severity prioritization
dlqSchema.index({ dlqReason: 1, movedToDLQAt: -1 }); // Failure reason analysis
dlqSchema.index({ userId: 1, movedToDLQAt: -1 }, { sparse: true }); // User impact tracking
dlqSchema.index({ workerId: 1, movedToDLQAt: -1 }, { sparse: true }); // Worker performance
dlqSchema.index({ status: 1, resolvedAt: -1 }, { sparse: true }); // Resolution tracking
dlqSchema.index({ createdAt: -1 }); // Recent entries

// TTL index for automatic cleanup of old resolved entries (optional)
// dlqSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days

// ==========================================
// 5. MONGOOSE MIDDLEWARE E HOOKS
// ==========================================

// Pre-save data processing
dlqSchema.pre('save', function (next) {
  // Auto-set moved to DLQ timestamp if not provided
  if (!this.movedToDLQAt) {
    this.movedToDLQAt = new Date();
  }

  // Auto-determine severity if not provided
  if (!this.severity || this.severity === 'medium') {
    this.severity = DLQValidations.determineSeverity(this.jobType, this.dlqReason, this.attempts);
  }

  // Data sanitization
  if (this.jobType) {
    this.jobType = this.jobType.trim().toLowerCase();
  }

  // Truncate long error messages
  if (this.failureReason && this.failureReason.length > DLQValidations.MAX_ERROR_LENGTH) {
    this.failureReason =
      this.failureReason.substring(0, DLQValidations.MAX_ERROR_LENGTH - 3) + '...';
  }

  next();
});

// Pre-update hooks for consistency
dlqSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
  const update = this.getUpdate() as any;

  // Set resolved timestamp when status changes to resolved
  if (update.$set?.status === 'resolved' && !update.$set?.resolvedAt) {
    update.$set.resolvedAt = new Date();
  }

  // Set reprocessed timestamp when status changes to reprocessed
  if (update.$set?.status === 'reprocessed' && !update.$set?.lastReprocessedAt) {
    update.$set.lastReprocessedAt = new Date();
  }

  next();
});

// ==========================================
// 6. INSTANCE METHODS
// ==========================================

// Check if DLQ entry can be reprocessed
dlqSchema.methods.canBeReprocessed = function (): boolean {
  return this.status === 'pending' && this.reprocessAttempts < this.maxReprocessAttempts;
};

// Mark as reprocessed
dlqSchema.methods.markAsReprocessed = function (reprocessedBy: string): void {
  this.status = 'reprocessed';
  this.reprocessAttempts = (this.reprocessAttempts || 0) + 1;
  this.lastReprocessedAt = new Date();
  this.reprocessedBy = reprocessedBy;
};

// Mark as resolved
dlqSchema.methods.markAsResolved = function (resolvedBy: string, resolution: string): void {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;
  this.resolution = resolution.substring(0, DLQValidations.MAX_RESOLUTION_LENGTH);
};

// Check if entry is stale (old and unresolved)
dlqSchema.methods.isStale = function (days: number = 30): boolean {
  if (this.status === 'resolved') return false;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return this.movedToDLQAt < cutoffDate;
};

// ==========================================
// 7. STATIC METHODS
// ==========================================

// Find entries by severity
dlqSchema.statics.findBySeverity = function (severity: string, limit: number = 50) {
  return this.find({ severity, status: { $ne: 'resolved' } })
    .sort({ movedToDLQAt: -1 })
    .limit(limit);
};

// Find entries by job type
dlqSchema.statics.findByJobType = function (jobType: string, limit: number = 50) {
  return this.find({ jobType, status: { $ne: 'resolved' } })
    .sort({ movedToDLQAt: -1 })
    .limit(limit);
};

// Find stale entries
dlqSchema.statics.findStaleEntries = function (days: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return this.find({
    movedToDLQAt: { $lt: cutoffDate },
    status: { $nin: ['resolved', 'ignored'] }
  });
};

// Get DLQ statistics
dlqSchema.statics.getStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: {
          status: '$status',
          severity: '$severity'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.status',
        total: { $sum: '$count' },
        severityBreakdown: {
          $push: {
            severity: '$_id.severity',
            count: '$count'
          }
        }
      }
    }
  ]);
};

// ==========================================
// 8. MODEL EXPORT
// ==========================================

/**
 * Mongoose model for DLQ database operations
 * Export for use in repositories
 */
export const DLQModel = model<IDLQ>('DLQ', dlqSchema);
