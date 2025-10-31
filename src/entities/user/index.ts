// MongoDB exports (DEPRECATED - will be removed in future versions)
export type { IUser } from './userEntity';
export { UserModel, UserValidations as UserValidationsMongo } from './userEntity';
export type { IUserRepository } from './userRepository';
export { UserRepository } from './userRepository';

// PostgreSQL exports (PRIMARY)
export { User } from './userEntity.postgres';
export { UserValidations } from './userValidations';
export { UserRepositoryPostgres } from './userRepository.postgres';
export {
  createUserRepositoryPostgres,
  createUserRepositoryPostgresSync
} from './userRepository.postgres.factory';

// Unified factory (auto-selects PostgreSQL if available, falls back to MongoDB)
export { UserRepositoryFactory } from './userRepository.factory';
