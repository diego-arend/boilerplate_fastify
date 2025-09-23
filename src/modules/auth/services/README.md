# Auth Services Documentation

This directory contains all authentication-related services, strategies, and commands used throughout the auth module.

## Services Overview

### Password Service (`password.service.ts`)

Provides secure password hashing and verification functionality using bcryptjs with salt rounds for enhanced security.

**Key Features:**

- Secure bcrypt hashing with 12 salt rounds
- Safe password comparison without exposing plain text
- Password strength validation (delegates to GlobalValidators)
- Comprehensive error handling

### JWT Strategy (`strategy.ts`)

Implements JWT-based authentication strategy for verifying user tokens.

**Exports:**

- `JwtStrategy` - JWT authentication implementation
- `AuthStrategy` interface - Authentication strategy contract
- `AuthenticatedUser` interface - User data structure

### Authentication Command (`command.ts`)

Command pattern implementation for authentication operations.

**Exports:**

- `AuthenticateCommand` - Command for executing authentication
- `AuthCommand` interface - Command contract

## Password Service API

### `hashPassword(plainPassword: string): Promise<string>`

Hashes a plain text password using bcrypt.

**Parameters:**

- `plainPassword` - The plain text password to hash

**Returns:**

- Promise resolving to the hashed password string

**Throws:**

- Error if password is invalid or hashing fails

### `comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean>`

Compares a plain text password with a hashed password.

**Parameters:**

- `plainPassword` - The plain text password to verify
- `hashedPassword` - The hashed password to compare against

**Returns:**

- Promise resolving to `true` if passwords match, `false` otherwise

**Throws:**

- Error if comparison fails

### `validatePasswordStrength(password: string): boolean`

Validates password strength according to security requirements.

**Requirements:**

- Minimum 8 characters
- Maximum 128 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Parameters:**

- `password` - The password to validate

**Returns:**

- `true` if password meets all requirements, `false` otherwise

## Usage Examples

```typescript
// Import all services from the index
import { PasswordService, JwtStrategy, AuthenticateCommand } from './services/index.js';

// Password hashing
const hashedPassword = await PasswordService.hashPassword('MySecurePass123!');
const isValid = await PasswordService.comparePassword('MySecurePass123!', hashedPassword);

// JWT authentication
const jwtStrategy = new JwtStrategy('your-secret-key');
const user = await jwtStrategy.authenticate(request, reply);

// Command pattern authentication
const authCommand = new AuthenticateCommand(jwtStrategy);
const authenticatedUser = await authCommand.execute(request, reply);
```

## Security Configuration

- **Salt Rounds**: 12 (provides good balance of security vs performance)
- **Algorithm**: bcrypt (industry standard for password hashing)
- **Password Requirements**: Enforced through both Zod schemas and service validation

## Integration

The services are integrated throughout the auth module:

- **AuthPlugin**: Uses `JwtStrategy` and `AuthenticateCommand` for request authentication
- **AuthRepository**: Uses `PasswordService` for secure password hashing during user creation
- **AuthController**: Uses `PasswordService` for secure password comparison during login
- **ValidationSchemas**: Works with Zod PasswordSchema for input validation

## Architecture

This follows the **Command Pattern** and **Strategy Pattern** for clean separation of concerns:

- **Strategy Pattern**: `AuthStrategy` interface allows different authentication methods
- **Command Pattern**: `AuthCommand` encapsulates authentication operations
- **Service Pattern**: `PasswordService` provides utility functions for password operations
