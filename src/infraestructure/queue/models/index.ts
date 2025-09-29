// Re-exports from entities (seguindo padrão DDD)
export * from '../../../entities/job/index.js';

// Re-exports para compatibilidade
export type { JobBatch, BatchProcessingResult } from '../repositories/jobBatch.repository.js';
export type { IJobRepository } from '../repositories/job.repository.js';
