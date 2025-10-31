/**
 * Dead Letter Queue Entity - Exports
 * Domain layer exports for DLQ entity and repository interface
 */

export {
  DeadLetterQueue,
  DLQReason,
  DLQValidations,
  type IDeadLetterQueue
} from './deadLetterQueueEntity';

export type { IDeadLetterQueueRepository } from './deadLetterQueueRepository.interface';
