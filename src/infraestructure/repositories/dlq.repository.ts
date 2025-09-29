import type { ClientSession } from 'mongoose';
import { BaseRepository } from '../mongo/baseRepository.js';
import { DeadLetterQueue } from '../../entities/deadLetterQueue/deadLetterQueueEntity.js';
import type { IDeadLetterQueue } from '../../entities/deadLetterQueue/deadLetterQueueEntity.js';

/**
 * Dead Letter Queue Repository Implementation - Infrastructure layer
 * Simple implementation extending BaseRepository for DLQ operations
 */
export class DeadLetterQueueRepository extends BaseRepository<IDeadLetterQueue> {
  constructor() {
    super(DeadLetterQueue);
  }

  // Additional DLQ-specific methods beyond BaseRepository
  async findByJobId(jobId: string, session?: ClientSession): Promise<IDeadLetterQueue | null> {
    const query = this.model.findOne({ jobId });
    if (session) {
      query.session(session);
    }
    return query.exec();
  }

  async findByOriginalJobId(
    originalJobId: string,
    session?: ClientSession
  ): Promise<IDeadLetterQueue | null> {
    const query = this.model.findOne({ originalJobId });
    if (session) {
      query.session(session);
    }
    return query.exec();
  }

  async findRecentFailures(limit: number, session?: ClientSession): Promise<IDeadLetterQueue[]> {
    const query = this.model.find().sort({ failedAt: -1 }).limit(limit);
    if (session) {
      query.session(session);
    }
    return query.exec();
  }

  async findByReason(reason: string, limit: number = 50): Promise<IDeadLetterQueue[]> {
    return this.model.find({ reason }).limit(limit).exec();
  }

  async markAsReprocessed(id: string): Promise<IDeadLetterQueue | null> {
    return this.model
      .findByIdAndUpdate(
        id,
        {
          reprocessed: true,
          reprocessedAt: new Date()
        },
        { new: true }
      )
      .exec();
  }

  async getStatsByReason(): Promise<Array<{ reason: string; count: number }>> {
    return this.model
      .aggregate([
        { $group: { _id: '$reason', count: { $sum: 1 } } },
        { $project: { reason: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } }
      ])
      .exec();
  }

  async cleanupOldEntries(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.model.deleteMany({
      failedAt: { $lt: cutoffDate },
      reprocessed: { $ne: true }
    });

    return result.deletedCount;
  }
}
