import type { FilterQuery, ClientSession } from 'mongoose';
import type { IDeadLetterQueue } from './deadLetterQueueEntity.js';
import type { PaginationOptions, PaginationResult } from '../../infraestructure/mongo/index.js';

/**
 * Dead Letter Queue Repository Interface - Pure domain contract
 * Defines all operations for DLQ entity data access
 */
export interface IDeadLetterQueueRepository {
  // Core CRUD operations
  create(dlqData: Partial<IDeadLetterQueue>, session?: ClientSession): Promise<IDeadLetterQueue>;
  findById(id: string, session?: ClientSession): Promise<IDeadLetterQueue | null>;
  findByJobId(jobId: string, session?: ClientSession): Promise<IDeadLetterQueue | null>;
  findByOriginalJobId(
    originalJobId: string,
    session?: ClientSession
  ): Promise<IDeadLetterQueue | null>;
  update(
    id: string,
    updateData: Partial<IDeadLetterQueue>,
    session?: ClientSession
  ): Promise<IDeadLetterQueue | null>;
  delete(id: string, session?: ClientSession): Promise<boolean>;

  // Query operations with pagination
  findWithPagination(
    filters: FilterQuery<IDeadLetterQueue>,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IDeadLetterQueue>>;

  findByType(
    type: string,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IDeadLetterQueue>>;

  findByReason(
    reason: string,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IDeadLetterQueue>>;

  findRecentFailures(limit: number, session?: ClientSession): Promise<IDeadLetterQueue[]>;

  // Reprocessing operations
  markAsReprocessed(id: string, session?: ClientSession): Promise<IDeadLetterQueue | null>;
  findReprocessable(limit: number, session?: ClientSession): Promise<IDeadLetterQueue[]>;
  reprocessJob(
    id: string,
    newJobData?: Partial<IDeadLetterQueue>,
    session?: ClientSession
  ): Promise<IDeadLetterQueue | null>;

  // Statistics and monitoring
  getStatsByReason(session?: ClientSession): Promise<Array<{ reason: string; count: number }>>;
  getStatsByType(session?: ClientSession): Promise<Array<{ type: string; count: number }>>;
  getTotalCount(session?: ClientSession): Promise<number>;
  getFailureRateByTimeRange(
    startDate: Date,
    endDate: Date,
    session?: ClientSession
  ): Promise<Array<{ date: string; failures: number }>>;

  // Cleanup operations
  cleanupOldEntries(olderThanDays: number, session?: ClientSession): Promise<number>;
  cleanupReprocessedEntries(olderThanDays: number, session?: ClientSession): Promise<number>;

  // Batch operations
  findByDateRange(
    startDate: Date,
    endDate: Date,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IDeadLetterQueue>>;

  bulkDelete(ids: string[], session?: ClientSession): Promise<number>;
  bulkMarkAsReprocessed(ids: string[], session?: ClientSession): Promise<number>;
}
