# TypeORM Migrations

This directory contains database migrations for PostgreSQL using TypeORM.

## Migration Commands

```bash
# Create a new empty migration
pnpm migration:create src/infraestructure/postgres/migrations/MigrationName

# Generate migration from entity changes
pnpm migration:generate src/infraestructure/postgres/migrations/MigrationName

# Run pending migrations
pnpm migration:run

# Revert last migration
pnpm migration:revert

# Show migration status
pnpm migration:show

# Drop entire schema (DANGER!)
pnpm migration:drop
```

## Docker Commands

```bash
# Run migrations in Docker container
pnpm docker:migration:run

# Show migration status in Docker
pnpm docker:migration:show

# Revert last migration in Docker
pnpm docker:migration:revert
```

## Migration Control via ENV

Migrations are controlled by environment variables:

- `POSTGRES_RUN_MIGRATIONS=true/false` - Enable migration checking on startup
- `POSTGRES_MIGRATION_AUTO=true/false` - Auto-run pending migrations

### Development

```env
POSTGRES_RUN_MIGRATIONS=false  # Manual control
POSTGRES_MIGRATION_AUTO=false
```

### Production

```env
POSTGRES_RUN_MIGRATIONS=true   # Check on startup
POSTGRES_MIGRATION_AUTO=true   # Auto-run if pending
```

## Best Practices

1. **Always review** generated migrations before running
2. **Test migrations** in development first
3. **Backup database** before running in production
4. **Use transactions** for data migrations
5. **Never modify** existing migrations after they're committed
6. **Version control** all migration files
