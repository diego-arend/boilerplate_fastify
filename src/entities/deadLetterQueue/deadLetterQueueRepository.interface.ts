import type { ClientSession } from 'mongoose';
import type { IDeadLetterQueue } from './deadLetterQueueEntity';
import type { IBaseRepository } from '../../infraestructure/mongo/interfaces';

/**
 * Dead Letter Queue Repository Interface - Domain layer
 * Defines the contract for DLQ data operations
 */
export interface IDeadLetterQueueRepository extends IBaseRepository<IDeadLetterQueue> {
  // DLQ-specific methods
  findByJobId(jobId: string, session?: ClientSession): Promise<IDeadLetterQueue | null>;
  findByOriginalJobId(
    originalJobId: string,
    session?: ClientSession
  ): Promise<IDeadLetterQueue | null>;
  findRecentFailures(limit: number, session?: ClientSession): Promise<IDeadLetterQueue[]>;
  findByReason(reason: string, limit?: number): Promise<IDeadLetterQueue[]>;
  markAsReprocessed(id: string): Promise<IDeadLetterQueue | null>;
  getStatsByReason(): Promise<Array<{ reason: string; count: number }>>;
  cleanupOldEntries(olderThanDays: number): Promise<number>;
}
