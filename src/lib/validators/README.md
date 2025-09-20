# Zod Validation Schemas Documentation

## Overview

This project uses **Zod** for secure input validation and protection against common attacks like XSS, NoSQL injection, and path traversal. All validation schemas include automatic sanitization and security checks.

## Available Schemas

### Core Security Functions

#### `sanitizeInput(input: string): string`
Removes dangerous characters and normalizes input:
- HTML characters (`<>'"&`)
- JavaScript injections (`javascript:`, event handlers)
- Path traversal attempts (`..`)
- Normalizes slashes

#### `hasInjectionAttempt(input: string): boolean`
Detects potential injection attempts including:
- Script tags
- JavaScript execution
- SQL injection patterns
- System file access attempts

### Basic Validation Schemas

#### `BaseStringSchema`
```typescript
import { BaseStringSchema } from './src/lib/validators/index.js';

const result = BaseStringSchema.parse("Hello World"); // Sanitized and validated
```

#### `EmailSchema`
```typescript
import { EmailSchema } from './src/lib/validators/index.js';

// Valid email
const email = EmailSchema.parse("user@example.com");

// Will throw error for invalid/malicious emails
try {
  EmailSchema.parse("<script>alert('xss')</script>@test.com");
} catch (error) {
  console.log("Blocked malicious email");
}
```

#### `PasswordSchema`
Requires strong passwords with:
- Minimum 8 characters, maximum 128
- At least one lowercase letter
- At least one uppercase letter
- At least one number
- At least one special character (`@$!%*?&`)

```typescript
import { PasswordSchema } from './src/lib/validators/index.js';

const password = PasswordSchema.parse("MySecure123!"); // Valid
// PasswordSchema.parse("weak"); // Will throw error
```

**Related utility:** For programmatic validation without throwing errors, use:
```typescript
import { GlobalValidators } from './src/lib/validators/index.js';

const isStrong = GlobalValidators.validatePasswordStrength("MySecure123!"); // true
const isWeak = GlobalValidators.validatePasswordStrength("weak"); // false
```

#### `NameSchema`
```typescript
import { NameSchema } from './src/lib/validators/index.js';

const name = NameSchema.parse("John Doe"); // Valid
// Blocks malicious input like script tags
```

#### `UrlSchema`
Only allows HTTP/HTTPS URLs with security checks:
```typescript
import { UrlSchema } from './src/lib/validators/index.js';

const url = UrlSchema.parse("https://example.com");
// Blocks dangerous protocols and malformed URLs
```

#### `ObjectIdSchema`
Validates MongoDB ObjectId format:
```typescript
import { ObjectIdSchema } from './src/lib/validators/index.js';

const id = ObjectIdSchema.parse("507f1f77bcf86cd799439011");
```

### Request Validation Schemas

#### `RegisterRequestSchema`
```typescript
import { RegisterRequestSchema } from './src/lib/validators/index.js';

const userData = RegisterRequestSchema.parse({
  name: "John Doe",
  email: "john@example.com",
  password: "SecurePass123!"
});
```

#### `LoginRequestSchema`
```typescript
import { LoginRequestSchema } from './src/lib/validators/index.js';

const loginData = LoginRequestSchema.parse({
  email: "user@example.com",
  password: "password123"
});
```

#### `UserUpdateSchema`
```typescript
import { UserUpdateSchema } from './src/lib/validators/index.js';

const updateData = UserUpdateSchema.parse({
  name: "New Name", // Optional
  email: "new@example.com" // Optional
  // At least one field required
});
```

### Entity-Specific Validators

#### User Security Validators
```typescript
import { SecurityValidators } from './src/entities/user/securityValidators.js';

// Validate user registration
const userData = SecurityValidators.validateUserRegistration({
  name: "John Doe",
  email: "john@example.com",
  password: "SecurePass123!",
  role: "user" // Optional, defaults to "user"
});

// Validate user login
const loginData = SecurityValidators.validateUserLogin({
  email: "user@example.com",
  password: "password123"
});

// Validate user update
const updateData = SecurityValidators.validateUserUpdate({
  name: "New Name"
});
```

## Security Features

### ✅ **XSS Protection**
- Automatic HTML character removal
- Script tag detection and blocking
- Event handler sanitization

### ✅ **NoSQL Injection Protection**
- MongoDB operator filtering
- Query parameter sanitization
- Recursive object cleaning

### ✅ **Path Traversal Prevention**
- Directory traversal pattern blocking
- File path normalization
- System file access prevention

### ✅ **Email Security**
- Format validation
- Double-dot prevention
- Length restrictions
- Injection pattern detection

### ✅ **Password Security**
- Strong password requirements
- Length limits (8-128 characters)
- Complexity validation
- Special character requirements

## Usage in Controllers

```typescript
import { RegisterRequestSchema, LoginRequestSchema } from '../lib/validators/index.js';

// In register endpoint
try {
  const validatedData = RegisterRequestSchema.parse(request.body);
  // Use validatedData (automatically sanitized and validated)
} catch (error) {
  return reply.status(400).send({
    error: "Validation failed",
    details: error.issues
  });
}
```

## Error Handling

Zod provides detailed error information:

```typescript
try {
  EmailSchema.parse("invalid-email");
} catch (error) {
  console.log(error.issues); // Detailed validation errors
  // [{ message: "Invalid email format", path: [], code: "invalid_email" }]
}
```

## Migration from Legacy Validators

Legacy `GlobalValidators` class methods are still available but deprecated:

```typescript
// ❌ Old way (deprecated)
import { GlobalValidators } from './src/lib/validators/index.js';
const isValid = GlobalValidators.isValidEmail(email);

// ✅ New way (recommended)
import { EmailSchema } from './src/lib/validators/index.js';
try {
  const validEmail = EmailSchema.parse(email);
  // Use validEmail
} catch {
  // Handle validation error
}
```

## Best Practices

1. **Always validate user input** at the controller level
2. **Use appropriate schemas** for different contexts
3. **Handle validation errors gracefully** with meaningful messages
4. **Log security violations** for monitoring
5. **Update schemas** as security requirements evolve

## Testing

The validation system has been tested against common attack vectors:
- XSS attempts in email fields
- Script injection in name fields
- SQL injection patterns
- Path traversal attempts
- Weak password patterns

All tests pass with appropriate error messages and sanitization.