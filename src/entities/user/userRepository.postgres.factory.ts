/**
 * User Repository Factory - PostgreSQL Implementation
 * Creates UserRepositoryPostgres instances with DataSource injection
 *
 * Usage in dependency injection:
 * ```typescript
 * const userRepository = await createUserRepositoryPostgres();
 * ```
 */

import { AppDataSource } from '../../../infraestructure/postgres/data-source.js';
import { UserRepositoryPostgres } from './userRepository.postgres.js';

/**
 * Factory function to create UserRepositoryPostgres
 * Ensures DataSource is initialized before creating repository
 *
 * @throws {Error} If PostgreSQL DataSource is not initialized
 * @returns {Promise<UserRepositoryPostgres>} Initialized repository instance
 */
export async function createUserRepositoryPostgres(): Promise<UserRepositoryPostgres> {
  // Check if DataSource is already initialized
  if (!AppDataSource.isInitialized) {
    throw new Error(
      'PostgreSQL DataSource is not initialized. Ensure postgres.plugin.ts is registered in Fastify.'
    );
  }

  return new UserRepositoryPostgres(AppDataSource);
}

/**
 * Synchronous factory (for use after DataSource is confirmed initialized)
 * Use only when you're certain the DataSource is already initialized
 *
 * @throws {Error} If PostgreSQL DataSource is not initialized
 * @returns {UserRepositoryPostgres} Repository instance
 */
export function createUserRepositoryPostgresSync(): UserRepositoryPostgres {
  if (!AppDataSource.isInitialized) {
    throw new Error(
      'PostgreSQL DataSource is not initialized. Ensure postgres.plugin.ts is registered in Fastify.'
    );
  }

  return new UserRepositoryPostgres(AppDataSource);
}
