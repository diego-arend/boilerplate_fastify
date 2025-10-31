# User Entity - PostgreSQL Implementation

> ⚠️ **IMPORTANT**: This entity uses **PostgreSQL with TypeORM** as the primary database.

## 🚀 Overview

The User entity provides complete authentication and user management functionality with:

- ✅ **ACID Transactions** for authentication operations
- ✅ **SERIAL IDs** (4 bytes) for optimal B-tree performance
- ✅ **Enum Constraints** at database level (`status`, `role`)
- ✅ **Row-Level Security** ready
- ✅ **Full-Text Search** capabilities

## Architecture

### Components

- **Entity**: `userEntity.postgres.ts` - TypeORM entity with decorators
- **Repository**: `userRepository.postgres.ts` - CRUD, authentication, email verification
- **Factory**: `userRepository.postgres.factory.ts` - DataSource injection
- **Validations**: `userValidations.ts` - Zod schemas for validation

## Database Schema

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(128) NOT NULL,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  role ENUM('user', 'admin') DEFAULT 'user',
  lastLoginAt TIMESTAMP NULL,
  loginAttempts INTEGER DEFAULT 0,
  lockUntil TIMESTAMP NULL,
  emailVerified BOOLEAN DEFAULT false,
  emailVerificationToken VARCHAR(255) NULL,
  passwordResetToken VARCHAR(255) NULL,
  passwordResetExpires TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status_role ON users(status, role);
CREATE INDEX idx_users_created_at ON users(createdAt);
```

## Usage

### Repository Factory

```typescript
import { UserRepositoryFactory } from '../entities/user/index.js';

// Create repository (auto-selects PostgreSQL)
const userRepo = await UserRepositoryFactory.createUserRepository();

// Explicit PostgreSQL repository
const postgresRepo = UserRepositoryFactory.createUserRepositoryPostgres();
```

### CRUD Operations

```typescript
// Create user
const user = await userRepo.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'SecurePassword123!'
});

// Find by ID
const foundUser = await userRepo.findById(1);

// Find by email
const emailUser = await userRepo.findByEmail('john@example.com');

// Update user
const updated = await userRepo.update(1, { name: 'John Updated' });

// Delete user
const deleted = await userRepo.delete(1);

// Pagination
const result = await userRepo.findAll({ page: 1, limit: 10 });
// Returns: { data, total, page, limit, totalPages }
```

### Authentication

```typescript
// Validate password (handles login attempts and account locking)
const validUser = await userRepo.validatePassword('john@example.com', 'password123');

// Update last login timestamp
await userRepo.updateLastLogin(1);
```

### Email Verification

```typescript
// Verify email with token
const verified = await userRepo.verifyEmail('verification-token');

// Regenerate verification token
const newToken = await userRepo.regenerateEmailVerificationToken('john@example.com');

// Find user by verification token
const user = await userRepo.findByEmailVerificationToken('token');
```

### Password Reset

```typescript
// Create password reset token
const resetToken = await userRepo.createPasswordResetToken('john@example.com');

// Reset password with token
const resetSuccess = await userRepo.resetPassword('reset-token', 'NewPassword123!');

// Find user by reset token
const user = await userRepo.findByPasswordResetToken('token');
```

### Admin Operations

```typescript
// Update user role
const admin = await userRepo.updateRole(1, 'admin');

// Deactivate user (sets status to 'inactive')
await userRepo.deactivateUser(1);

// Activate user (sets status to 'active')
await userRepo.activateUser(1);

// Find users by role with pagination
const admins = await userRepo.findByRole('admin', { page: 1, limit: 10 });
```

### Query Operations

```typescript
// Count users
const totalUsers = await userRepo.count();
const activeUsers = await userRepo.count({ status: 'active' });

// Check if user exists
const exists = await userRepo.exists({ email: 'john@example.com' });

// Health check
const isHealthy = await userRepo.healthCheck();
```

## Validation

Validation schemas are provided in `userValidations.ts`:

```typescript
import { UserValidations } from '../entities/user/index.js';

// Validate user creation
const validated = UserValidations.CreateUserSchema.parse({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'SecurePass123!'
});

// Validate user update
const updateData = UserValidations.UpdateUserSchema.parse({
  name: 'John Updated'
});

// Validate login
const loginData = UserValidations.validateLogin({
  email: 'john@example.com',
  password: 'password123'
});

// Validate password change
const changeData = UserValidations.validatePasswordChange({
  currentPassword: 'old',
  newPassword: 'new',
  confirmPassword: 'new'
});

// Validate email
const email = UserValidations.EmailSchema.parse('john@example.com');

// Validate status
const status = UserValidations.StatusSchema.parse('active');

// Validate role
const role = UserValidations.RoleSchema.parse('admin');
```

## Migrations

### Environment Configuration

Control migration execution via environment variables:

```bash
# Enable migration execution
POSTGRES_RUN_MIGRATIONS=true

# Auto-run migrations on application startup
POSTGRES_MIGRATION_AUTO=true
```

### CLI Commands

```bash
# Generate new migration (auto-detect changes)
pnpm migration:generate src/infraestructure/postgres/migrations/MigrationName

# Create empty migration
pnpm migration:create src/infraestructure/postgres/migrations/MigrationName

# Run pending migrations
pnpm migration:run

# Revert last migration
pnpm migration:revert

# Show migration status
pnpm migration:show

# Drop all schema (DANGER!)
pnpm migration:drop
```

### Docker Commands

```bash
# Run migrations in Docker container
pnpm docker:migration:run

# Revert migrations in Docker
pnpm docker:migration:revert

# Show migrations in Docker
pnpm docker:migration:show
```

## Security Features

### Password Security

- **Hashing**: bcryptjs with 10 salt rounds
- **Validation**: Minimum 8 characters, complexity requirements
- **Storage**: Passwords excluded from query results by default

### Account Protection

- **Login Attempts**: Tracks failed login attempts
- **Account Locking**: Locks account for 15 minutes after 5 failed attempts
- **Token Generation**: Secure random tokens with crypto.randomBytes(32)
- **Token Expiration**:
  - Email verification: 24 hours (application level)
  - Password reset: 1 hour

### Data Protection

- **Input Sanitization**: All inputs sanitized before storage
- **SQL Injection Protection**: TypeORM parameterized queries
- **Sensitive Fields**: Password, tokens excluded from JSON serialization

## Performance Optimizations

### Database Indexes

1. **Unique Email Index**: Fast email lookups and uniqueness enforcement
2. **Composite Status+Role Index**: Optimized for admin dashboards
3. **CreatedAt Index**: Efficient sorting and time-based queries

### ID Strategy

- **SERIAL vs UUID**: 4 bytes vs 16 bytes (75% smaller)
- **B-tree Performance**: Sequential IDs prevent index fragmentation
- **Write Performance**: No UUID generation overhead

## Integration with Auth Module

```typescript
// Auth module uses UserRepository via factory
import { UserRepositoryFactory } from '../../../entities/user/index.js';

export class AuthRepositoryFactory {
  static async createAuthRepository(): Promise<IAuthRepository> {
    const userRepository = await UserRepositoryFactory.createUserRepository();
    return new AuthRepository(userRepository);
  }
}
```

## API Reference

### Repository Methods

#### CRUD Operations

- `create(userData)` - Create new user with hashed password
- `findById(id)` - Find user by ID
- `findByEmail(email)` - Find user by email (case-insensitive)
- `update(id, userData)` - Update user fields
- `delete(id)` - Delete user by ID
- `findAll(options?)` - Get all users with pagination

#### Authentication

- `validatePassword(email, password)` - Validate credentials with login attempt tracking
- `updateLastLogin(id)` - Update last login timestamp

#### Email Verification

- `findByEmailVerificationToken(token)` - Find user by verification token
- `verifyEmail(token)` - Mark email as verified
- `regenerateEmailVerificationToken(email)` - Generate new verification token

#### Password Reset

- `createPasswordResetToken(email)` - Generate password reset token
- `findByPasswordResetToken(token)` - Find user by reset token
- `resetPassword(token, newPassword)` - Reset password with token

#### Admin Operations

- `updateRole(id, role)` - Update user role (validates promotion rules)
- `deactivateUser(id)` - Set status to 'inactive'
- `activateUser(id)` - Set status to 'active'

#### Queries

- `count(where?)` - Count users with optional filter
- `exists(where)` - Check if user exists
- `findByRole(role, options?)` - Find users by role with pagination
- `healthCheck()` - Database connection health check

### Entity Fields

| Field                    | Type      | Description                                       |
| ------------------------ | --------- | ------------------------------------------------- |
| `id`                     | `number`  | Auto-incrementing primary key (SERIAL)            |
| `name`                   | `string`  | User's full name (max 100 chars)                  |
| `email`                  | `string`  | Unique email address (max 255 chars)              |
| `password`               | `string`  | Hashed password (bcrypt, max 128 chars)           |
| `status`                 | `enum`    | Account status: 'active', 'inactive', 'suspended' |
| `role`                   | `enum`    | User role: 'user', 'admin'                        |
| `lastLoginAt`            | `Date?`   | Last successful login timestamp                   |
| `loginAttempts`          | `number`  | Failed login attempt counter                      |
| `lockUntil`              | `Date?`   | Account lock expiration timestamp                 |
| `emailVerified`          | `boolean` | Email verification status                         |
| `emailVerificationToken` | `string?` | Email verification token                          |
| `passwordResetToken`     | `string?` | Password reset token                              |
| `passwordResetExpires`   | `Date?`   | Password reset token expiration                   |
| `createdAt`              | `Date`    | Record creation timestamp                         |
| `updatedAt`              | `Date`    | Last update timestamp                             |

### Entity Methods

- `isLocked()` - Check if account is currently locked
- `canLogin()` - Check if user can login (not locked, active status, email verified)
- `canPromoteToAdmin()` - Check if user can be promoted to admin role
- `toJSON()` - Serialize user (excludes sensitive fields)

## Related Documentation

- [PostgreSQL Infrastructure](../../infraestructure/postgres/README.md)
- [Auth Module](../../modules/auth/README.md)
- [Migrations Guide](../../infraestructure/postgres/migrations/README.md)
- [Validation Schemas](../../lib/validators/README.md)
