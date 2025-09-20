# ApiResponseHandler

Utility class for standardizing Fastify API responses. Centralizes the handling of success and error responses, ensuring consistency throughout the application.

## Response Structure

All responses follow the standard format:

```json
{
  "success": boolean,
  "message": string,
  "code": number,
  "data"?: any,
  "error"?: string
}
```

## Available Methods

### Success Responses

#### `success(reply, message?, data?, code?)`
Generic success response.

```typescript
import { ApiResponseHandler } from '../lib/response/index.js';

// Basic usage
return ApiResponseHandler.success(reply, 'Operation completed');

// With data
return ApiResponseHandler.success(reply, 'User created', userData);

// With specific code
return ApiResponseHandler.success(reply, 'OK', data, 200);
```

#### `created(reply, message?, data?)`
Response for resource creation (HTTP 201).

```typescript
return ApiResponseHandler.created(reply, 'User registered', userData);
```

#### `noContent(reply, message?)`
Response without content (HTTP 204).

```typescript
return ApiResponseHandler.noContent(reply, 'User deleted');
```

#### `paginated(reply, data, total, page, limit, message?)`
Response with pagination.

```typescript
return ApiResponseHandler.paginated(reply, users, 150, 1, 10, 'Users listed');
```

### Error Responses

#### `validationError(reply, message?, details?)`
Validation error (HTTP 400).

```typescript
return ApiResponseHandler.validationError(reply, 'Email is required');
```

#### `authError(reply, message?, details?)`
Authentication error (HTTP 401).

```typescript
return ApiResponseHandler.authError(reply, 'Invalid token');
```

#### `forbidden(reply, message?, details?)`
Authorization error (HTTP 403).

```typescript
return ApiResponseHandler.forbidden(reply, 'Access denied');
```

#### `notFound(reply, message?, details?)`
Resource not found (HTTP 404).

```typescript
return ApiResponseHandler.notFound(reply, 'User not found');
```

#### `conflict(reply, message?, details?)`
Data conflict (HTTP 409).

```typescript
return ApiResponseHandler.conflict(reply, 'Email already registered');
```

#### `internalError(reply, error?, logError?)`
Internal server error (HTTP 500).

```typescript
try {
  // operation that may fail
} catch (error) {
  return ApiResponseHandler.internalError(reply, error);
}
```

#### `serviceUnavailable(reply, message?)`
Service unavailable (HTTP 503).

```typescript
return ApiResponseHandler.serviceUnavailable(reply, 'Database unavailable');
```

#### `custom(reply, success, code, message, data?, error?)`
Custom response.

```typescript
return ApiResponseHandler.custom(reply, false, 422, 'Validation error', validationErrors);
```

## Usage Examples in Controllers

### Authentication Controller

```typescript
import { ApiResponseHandler } from '../../lib/response/index.js';

export default async function authController(fastify: FastifyInstance) {
  // Registration
  fastify.post('/register', async (request, reply) => {
    try {
      const user = await createUser(request.body);
      return ApiResponseHandler.created(reply, 'User registered', {
        user: user,
        token: generateToken(user)
      });
    } catch (error) {
      if (error.message.includes('already registered')) {
        return ApiResponseHandler.conflict(reply, error.message);
      }
      return ApiResponseHandler.internalError(reply, error);
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return ApiResponseHandler.validationError(reply, 'Email and password are required');
      }

      const user = await authenticateUser(email, password);
      if (!user) {
        return ApiResponseHandler.authError(reply, 'Invalid credentials');
      }

      return ApiResponseHandler.success(reply, 'Login successful', {
        user: user,
        token: generateToken(user)
      });
    } catch (error) {
      return ApiResponseHandler.internalError(reply, error);
    }
  });
}
```

### Controller with Pagination

```typescript
fastify.get('/users', async (request, reply) => {
  try {
    const { page = 1, limit = 10 } = request.query;
    const { users, total } = await getUsersPaginated(page, limit);

    return ApiResponseHandler.paginated(reply, users, total, page, limit);
  } catch (error) {
    return ApiResponseHandler.internalError(reply, error);
  }
});
```

## Benefits

- ✅ **Consistency**: All responses follow the same format
- ✅ **Maintainability**: Centralized response logic
- ✅ **Security**: Control over sensitive error exposure
- ✅ **Testability**: Facilitates automated testing
- ✅ **Documentation**: More predictable API for consumers
- ✅ **Logging**: Critical errors are automatically logged

## Best Practices

1. **Always use the class** instead of direct `reply.send()`
2. **Handle errors appropriately** with try/catch
3. **Provide clear messages** for the user
4. **Avoid exposing internal details** in production
5. **Use appropriate HTTP codes** for each situation
6. **Log critical errors** for monitoring

## Integration with Middlewares

The class can be integrated with middlewares for global error handling:

```typescript
// Global error middleware
fastify.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    return ApiResponseHandler.validationError(reply, 'Invalid data', error.validation);
  }

  return ApiResponseHandler.internalError(reply, error);
});
```