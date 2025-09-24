import type { FilterQuery, ClientSession } from 'mongoose';
import type { IDLQ } from './dlqEntity.js';
import { DLQModel, DLQValidations } from './dlqEntity.js';
import type {
  IBaseRepository,
  RepositoryOptions,
  PaginationOptions,
  PaginationResult
} from '../../infraestructure/mongo/index.js';

/**
 * Interface for DLQ Repository operations
 */
export interface IDLQRepository {
  // Core CRUD operations
  createDLQEntry(dlqData: any, session?: ClientSession): Promise<IDLQ>;
  updateDLQEntry(id: string, updateData: any, session?: ClientSession): Promise<IDLQ | null>;
  findDLQById(id: string, session?: ClientSession): Promise<IDLQ | null>;
  findDLQByOriginalJobId(originalJobId: string, session?: ClientSession): Promise<IDLQ | null>;
  deleteDLQEntry(id: string, session?: ClientSession): Promise<boolean>;

  // Query operations for analysis
  findDLQEntriesBySeverity(
    severity: string,
    limit?: number,
    session?: ClientSession
  ): Promise<IDLQ[]>;
  findDLQEntriesByJobType(
    jobType: string,
    limit?: number,
    session?: ClientSession
  ): Promise<IDLQ[]>;
  findDLQEntriesByStatus(status: string, limit?: number, session?: ClientSession): Promise<IDLQ[]>;
  findDLQEntriesByReason(
    dlqReason: string,
    limit?: number,
    session?: ClientSession
  ): Promise<IDLQ[]>;

  // Time-based queries
  findRecentDLQEntries(limit?: number, session?: ClientSession): Promise<IDLQ[]>;
  findDLQEntriesInTimeRange(
    startDate: Date,
    endDate: Date,
    session?: ClientSession
  ): Promise<IDLQ[]>;
  findStaleDLQEntries(days?: number, session?: ClientSession): Promise<IDLQ[]>;

  // User and worker analysis
  findDLQEntriesByUser(userId: string, limit?: number, session?: ClientSession): Promise<IDLQ[]>;
  findDLQEntriesByWorker(
    workerId: string,
    limit?: number,
    session?: ClientSession
  ): Promise<IDLQ[]>;

  // Reprocessing operations
  markAsReprocessed(
    id: string,
    reprocessedBy: string,
    session?: ClientSession
  ): Promise<IDLQ | null>;
  findReprocessableEntries(limit?: number, session?: ClientSession): Promise<IDLQ[]>;
  batchReprocessByJobType(
    jobType: string,
    reprocessedBy: string,
    maxEntries?: number,
    session?: ClientSession
  ): Promise<{ processed: number; errors: string[] }>;

  // Resolution operations
  markAsResolved(
    id: string,
    resolvedBy: string,
    resolution: string,
    session?: ClientSession
  ): Promise<IDLQ | null>;
  markAsIgnored(id: string, reason: string, session?: ClientSession): Promise<IDLQ | null>;

  // Statistics and monitoring
  getDLQStats(session?: ClientSession): Promise<Record<string, any>>;
  getDLQStatsByJobType(
    session?: ClientSession
  ): Promise<Array<{ jobType: string; count: number; avgProcessingTime?: number }>>;
  getDLQStatsBySeverity(
    session?: ClientSession
  ): Promise<Array<{ severity: string; count: number }>>;
  getDLQStatsByReason(session?: ClientSession): Promise<Array<{ reason: string; count: number }>>;

  // Cleanup operations
  cleanupResolvedEntries(olderThanDays: number, session?: ClientSession): Promise<number>;
  cleanupIgnoredEntries(olderThanDays: number, session?: ClientSession): Promise<number>;

  // Pagination support
  findDLQEntriesPaginated(
    filter: FilterQuery<IDLQ>,
    options?: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IDLQ>>;
}

/**
 * DLQ Repository - Handles all database operations for DLQ entity
 * Uses composition with BaseRepository instead of inheritance
 */
export class DLQRepository implements IDLQRepository {
  constructor(private baseRepository: IBaseRepository<IDLQ>) {}

  /**
   * Helper to create repository options with session support
   */
  private createOptions(session?: ClientSession): RepositoryOptions {
    return session ? { session } : {};
  }

  /**
   * Create a new DLQ entry from a failed job
   */
  async createDLQEntry(dlqData: any, session?: ClientSession): Promise<IDLQ> {
    // Validate DLQ data
    const validatedData = DLQValidations.validateCreateDLQ(dlqData);
    const options = this.createOptions(session);

    // Remove undefined properties to comply with exactOptionalPropertyTypes
    const cleanedData = Object.fromEntries(
      Object.entries(validatedData).filter(([_, value]) => value !== undefined)
    ) as Partial<IDLQ>;

    try {
      return await this.baseRepository.create(cleanedData, options);
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        throw new Error(`DLQ entry for job '${validatedData.originalJobId}' already exists`);
      }
      throw error;
    }
  }

  /**
   * Update DLQ entry by database ID
   */
  async updateDLQEntry(id: string, updateData: any, session?: ClientSession): Promise<IDLQ | null> {
    const validatedData = DLQValidations.validateUpdateDLQ(updateData);
    const options = this.createOptions(session);

    return await this.baseRepository.updateById(id, validatedData, options);
  }

  /**
   * Find DLQ entry by database ID
   */
  async findDLQById(id: string, session?: ClientSession): Promise<IDLQ | null> {
    const options = this.createOptions(session);
    return await this.baseRepository.findById(id, options);
  }

  /**
   * Find DLQ entry by original job ID
   */
  async findDLQByOriginalJobId(
    originalJobId: string,
    session?: ClientSession
  ): Promise<IDLQ | null> {
    const options = this.createOptions(session);
    return await this.baseRepository.findOne({ originalJobId }, options);
  }

  /**
   * Delete DLQ entry by ID
   */
  async deleteDLQEntry(id: string, session?: ClientSession): Promise<boolean> {
    const options = this.createOptions(session);
    return await this.baseRepository.deleteById(id, options);
  }

  /**
   * Find DLQ entries by severity level
   */
  async findDLQEntriesBySeverity(
    severity: string,
    limit: number = 50,
    session?: ClientSession
  ): Promise<IDLQ[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      { severity, status: { $ne: 'resolved' } },
      {
        ...options,
        sort: { movedToDLQAt: -1 },
        limit
      }
    );
  }

  /**
   * Find DLQ entries by job type
   */
  async findDLQEntriesByJobType(
    jobType: string,
    limit: number = 50,
    session?: ClientSession
  ): Promise<IDLQ[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      { jobType, status: { $ne: 'resolved' } },
      {
        ...options,
        sort: { movedToDLQAt: -1 },
        limit
      }
    );
  }

  /**
   * Find DLQ entries by status
   */
  async findDLQEntriesByStatus(
    status: string,
    limit: number = 50,
    session?: ClientSession
  ): Promise<IDLQ[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      { status },
      {
        ...options,
        sort: { movedToDLQAt: -1 },
        limit
      }
    );
  }

  /**
   * Find DLQ entries by failure reason
   */
  async findDLQEntriesByReason(
    dlqReason: string,
    limit: number = 50,
    session?: ClientSession
  ): Promise<IDLQ[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      { dlqReason },
      {
        ...options,
        sort: { movedToDLQAt: -1 },
        limit
      }
    );
  }

  /**
   * Find recent DLQ entries
   */
  async findRecentDLQEntries(limit: number = 50, session?: ClientSession): Promise<IDLQ[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      {},
      {
        ...options,
        sort: { movedToDLQAt: -1 },
        limit
      }
    );
  }

  /**
   * Find DLQ entries within a time range
   */
  async findDLQEntriesInTimeRange(
    startDate: Date,
    endDate: Date,
    session?: ClientSession
  ): Promise<IDLQ[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      {
        movedToDLQAt: {
          $gte: startDate,
          $lte: endDate
        }
      },
      {
        ...options,
        sort: { movedToDLQAt: -1 }
      }
    );
  }

  /**
   * Find stale DLQ entries (old and unresolved)
   */
  async findStaleDLQEntries(days: number = 30, session?: ClientSession): Promise<IDLQ[]> {
    const options = this.createOptions(session);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await this.baseRepository.find(
      {
        movedToDLQAt: { $lt: cutoffDate },
        status: { $nin: ['resolved', 'ignored'] }
      },
      {
        ...options,
        sort: { movedToDLQAt: 1 } // Oldest first
      }
    );
  }

  /**
   * Find DLQ entries by user ID
   */
  async findDLQEntriesByUser(
    userId: string,
    limit: number = 50,
    session?: ClientSession
  ): Promise<IDLQ[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      { userId },
      {
        ...options,
        sort: { movedToDLQAt: -1 },
        limit
      }
    );
  }

  /**
   * Find DLQ entries by worker ID
   */
  async findDLQEntriesByWorker(
    workerId: string,
    limit: number = 50,
    session?: ClientSession
  ): Promise<IDLQ[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      { workerId },
      {
        ...options,
        sort: { movedToDLQAt: -1 },
        limit
      }
    );
  }

  /**
   * Mark DLQ entry as reprocessed
   */
  async markAsReprocessed(
    id: string,
    reprocessedBy: string,
    session?: ClientSession
  ): Promise<IDLQ | null> {
    const options = this.createOptions(session);
    const now = new Date();

    // Find and check if can be reprocessed
    const dlqEntry = await this.findDLQById(id, session);
    if (!dlqEntry) {
      throw new Error(`DLQ entry with ID '${id}' not found`);
    }

    if (!dlqEntry.canBeReprocessed()) {
      throw new Error(
        `DLQ entry '${id}' cannot be reprocessed (status: ${dlqEntry.status}, attempts: ${dlqEntry.reprocessAttempts}/${dlqEntry.maxReprocessAttempts})`
      );
    }

    return await this.baseRepository.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          status: 'reprocessed',
          lastReprocessedAt: now,
          reprocessedBy
        },
        $inc: { reprocessAttempts: 1 }
      },
      { ...options, returnDocument: 'after' }
    );
  }

  /**
   * Find entries that can be reprocessed
   */
  async findReprocessableEntries(limit: number = 50, session?: ClientSession): Promise<IDLQ[]> {
    const options = this.createOptions(session);

    return await this.baseRepository.find(
      {
        status: 'pending',
        $expr: { $lt: ['$reprocessAttempts', '$maxReprocessAttempts'] }
      },
      {
        ...options,
        sort: { severity: -1, movedToDLQAt: 1 }, // Critical first, then oldest
        limit
      }
    );
  }

  /**
   * Batch reprocess DLQ entries by job type
   */
  async batchReprocessByJobType(
    jobType: string,
    reprocessedBy: string,
    maxEntries: number = 10,
    session?: ClientSession
  ): Promise<{ processed: number; errors: string[] }> {
    const options = this.createOptions(session);
    const errors: string[] = [];
    let processed = 0;

    // Find reprocessable entries of this type
    const entries = await this.baseRepository.find(
      {
        jobType,
        status: 'pending',
        $expr: { $lt: ['$reprocessAttempts', '$maxReprocessAttempts'] }
      },
      { ...options, limit: maxEntries }
    );

    for (const entry of entries) {
      try {
        await this.markAsReprocessed((entry as any)._id.toString(), reprocessedBy, session);
        processed++;
      } catch (error) {
        errors.push(
          `Failed to reprocess DLQ entry ${(entry as any)._id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return { processed, errors };
  }

  /**
   * Mark DLQ entry as resolved
   */
  async markAsResolved(
    id: string,
    resolvedBy: string,
    resolution: string,
    session?: ClientSession
  ): Promise<IDLQ | null> {
    const validatedData = DLQValidations.validateResolution({
      resolvedBy,
      resolution
    });
    const options = this.createOptions(session);
    const now = new Date();

    return await this.baseRepository.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          status: 'resolved',
          resolvedAt: now,
          resolvedBy: validatedData.resolvedBy,
          resolution: validatedData.resolution
        }
      },
      { ...options, returnDocument: 'after' }
    );
  }

  /**
   * Mark DLQ entry as ignored
   */
  async markAsIgnored(id: string, reason: string, session?: ClientSession): Promise<IDLQ | null> {
    const options = this.createOptions(session);

    return await this.baseRepository.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          status: 'ignored',
          resolution: reason.substring(0, DLQValidations.MAX_RESOLUTION_LENGTH)
        }
      },
      { ...options, returnDocument: 'after' }
    );
  }

  /**
   * Get comprehensive DLQ statistics
   */
  async getDLQStats(session?: ClientSession): Promise<Record<string, any>> {
    const pipeline = [
      {
        $facet: {
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          bySeverity: [{ $group: { _id: '$severity', count: { $sum: 1 } } }],
          byReason: [{ $group: { _id: '$dlqReason', count: { $sum: 1 } } }],
          byJobType: [
            { $group: { _id: '$jobType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          overall: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                avgProcessingTime: { $avg: '$processingTime' },
                oldestEntry: { $min: '$movedToDLQAt' },
                newestEntry: { $max: '$movedToDLQAt' }
              }
            }
          ]
        }
      }
    ] as any[];

    const results = await DLQModel.aggregate(pipeline).session(session || null);

    if (!results[0]) {
      return {
        byStatus: {},
        bySeverity: {},
        byReason: {},
        byJobType: [],
        overall: { total: 0 }
      };
    }

    const stats = results[0];

    // Convert arrays to objects for easier access
    const statusStats: Record<string, number> = {};
    stats.byStatus.forEach((item: any) => {
      statusStats[item._id] = item.count;
    });

    const severityStats: Record<string, number> = {};
    stats.bySeverity.forEach((item: any) => {
      severityStats[item._id] = item.count;
    });

    const reasonStats: Record<string, number> = {};
    stats.byReason.forEach((item: any) => {
      reasonStats[item._id] = item.count;
    });

    return {
      byStatus: statusStats,
      bySeverity: severityStats,
      byReason: reasonStats,
      byJobType: stats.byJobType,
      overall: stats.overall[0] || { total: 0 }
    };
  }

  /**
   * Get DLQ statistics by job type
   */
  async getDLQStatsByJobType(
    session?: ClientSession
  ): Promise<Array<{ jobType: string; count: number; avgProcessingTime?: number }>> {
    const pipeline = [
      {
        $group: {
          _id: '$jobType',
          count: { $sum: 1 },
          avgProcessingTime: {
            $avg: {
              $cond: [{ $ne: ['$processingTime', null] }, '$processingTime', null]
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ] as any[];

    const results = await DLQModel.aggregate(pipeline).session(session || null);

    return results.map(result => ({
      jobType: result._id,
      count: result.count,
      ...(result.avgProcessingTime && {
        avgProcessingTime: Math.round(result.avgProcessingTime)
      })
    }));
  }

  /**
   * Get DLQ statistics by severity
   */
  async getDLQStatsBySeverity(
    session?: ClientSession
  ): Promise<Array<{ severity: string; count: number }>> {
    const pipeline = [
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ] as any[];

    const results = await DLQModel.aggregate(pipeline).session(session || null);

    return results.map(result => ({
      severity: result._id,
      count: result.count
    }));
  }

  /**
   * Get DLQ statistics by failure reason
   */
  async getDLQStatsByReason(
    session?: ClientSession
  ): Promise<Array<{ reason: string; count: number }>> {
    const pipeline = [
      {
        $group: {
          _id: '$dlqReason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ] as any[];

    const results = await DLQModel.aggregate(pipeline).session(session || null);

    return results.map(result => ({
      reason: result._id,
      count: result.count
    }));
  }

  /**
   * Cleanup resolved DLQ entries older than specified days
   */
  async cleanupResolvedEntries(olderThanDays: number, session?: ClientSession): Promise<number> {
    const options = this.createOptions(session);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.baseRepository.deleteMany(
      {
        status: 'resolved',
        resolvedAt: { $lt: cutoffDate }
      },
      options
    );

    return result.deletedCount || 0;
  }

  /**
   * Cleanup ignored DLQ entries older than specified days
   */
  async cleanupIgnoredEntries(olderThanDays: number, session?: ClientSession): Promise<number> {
    const options = this.createOptions(session);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.baseRepository.deleteMany(
      {
        status: 'ignored',
        createdAt: { $lt: cutoffDate }
      },
      options
    );

    return result.deletedCount || 0;
  }

  /**
   * Find DLQ entries with pagination support
   */
  async findDLQEntriesPaginated(
    filter: FilterQuery<IDLQ>,
    paginationOptions: PaginationOptions = { page: 1, limit: 10 },
    session?: ClientSession
  ): Promise<PaginationResult<IDLQ>> {
    const options = this.createOptions(session);

    return await this.baseRepository.findPaginated(
      filter,
      paginationOptions.page || 1,
      paginationOptions.limit || 10,
      paginationOptions.sort || { movedToDLQAt: -1 },
      options
    );
  }
}
