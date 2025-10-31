// MongoDB exports (DEPRECATED - will be removed in future versions)
export type { IUser } from './userEntity.js';
export { UserModel, UserValidations as UserValidationsMongo } from './userEntity.js';
export type { IUserRepository } from './userRepository.js';
export { UserRepository } from './userRepository.js';

// PostgreSQL exports (PRIMARY)
export { User } from './userEntity.postgres.js';
export { UserValidations } from './userValidations.js';
export { UserRepositoryPostgres } from './userRepository.postgres.js';
export {
  createUserRepositoryPostgres,
  createUserRepositoryPostgresSync
} from './userRepository.postgres.factory.js';

// Unified factory (auto-selects PostgreSQL if available, falls back to MongoDB)
export { UserRepositoryFactory } from './userRepository.factory.js';
