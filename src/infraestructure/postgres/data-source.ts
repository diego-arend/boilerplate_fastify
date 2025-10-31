import { DataSource } from 'typeorm';
import { User } from '../../entities/user/userEntity.postgres';

/**
 * TypeORM DataSource configuration for CLI and migrations
 * Used by: typeorm CLI commands, migrations, and application
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USERNAME || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DATABASE || 'boilerplate',

  // SSL Configuration
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,

  // Entities - Add new entities here
  entities: [User],

  // Migrations Configuration
  migrations: ['src/infraestructure/postgres/migrations/**/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  migrationsRun: false, // Never run migrations automatically via synchronize

  // Schema Synchronization (NEVER use in production)
  synchronize: false, // Always false - use migrations only

  // Logging
  logging: process.env.POSTGRES_LOGGING === 'true',
  logger: 'advanced-console',

  // Connection Pool
  extra: {
    max: parseInt(process.env.POSTGRES_POOL_MAX || '10', 10),
    min: parseInt(process.env.POSTGRES_POOL_MIN || '2', 10),
    connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '5000', 10),
    idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10)
  }
});

/**
 * Initialize DataSource for CLI usage
 */
export async function initializeDataSource(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}
