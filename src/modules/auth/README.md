# Authentication Module

This module implements complete JWT authentication using **dependency injection architecture** for better testability and maintainability.

## 🏗️ Architecture

### **New Dependency Injection Pattern**
- **AuthRepository** receives `IUserRepository` via constructor injection
- **UserRepository** receives `IBaseRepository` via constructor injection  
- **Zero inheritance** - uses composition instead
- **Interface-based contracts** for type safety
- **Factory pattern** for clean instantiation

### Main Features
- User registration with password hashing
- JWT login with secure password comparison
- Protected routes with authentication middleware
- User search (admin)
- Security validations with Zod schemas
- Input sanitization
- Protection against injection attacks

### File Structure
```
auth/
├── auth.controller.ts        # Routes and business logic (uses AuthRepositoryFactory)
├── auth.plugin.ts           # Fastify authentication plugin
├── factory/                 # Dependency injection factories
│   └── auth.factory.ts      # AuthRepository factory with DI
├── repository/              # Persistence layer
│   ├── auth.repository.ts   # Implements IAuthRepository with UserRepository injection
│   └── index.ts
├── services/                # Business logic services
│   ├── password.service.ts  # Password hashing and validation
│   ├── strategy.ts         # JWT authentication strategy  
│   ├── command.ts          # Authentication commands
│   └── index.ts            # Services exports
└── types/                   # TypeScript types
    └── auth.d.ts
```

## 🔧 Dependency Injection Usage

### Factory Pattern (Recommended)
```typescript
import { AuthRepositoryFactory } from './factory/auth.factory.js';

// Create AuthRepository with all dependencies injected
const authRepository = AuthRepositoryFactory.createAuthRepository();

// Use normally - all dependencies are properly injected
const user = await authRepository.findUserByEmail('user@example.com');
await authRepository.createUser(userData);
```

### Manual Injection (For custom scenarios)
```typescript
import { BaseRepository, UserRepository, AuthRepository } from '../../../index.js';
import { UserModel } from '../../../entities/user/userEntity.js';

// Manual dependency chain construction
const baseRepository = new BaseRepository<IUser>(UserModel);
const userRepository = new UserRepository(baseRepository);
const authRepository = new AuthRepository(userRepository);
```

### Testing with Mocks
```typescript
import { AuthRepositoryFactory } from './factory/auth.factory.js';

// Mock UserRepository for testing
const mockUserRepository = {
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
  // ... other methods
};

// Create AuthRepository with mock
const authRepository = AuthRepositoryFactory.createAuthRepositoryForTesting(mockUserRepository);
```

## 🎯 Architecture Benefits

✅ **Decoupling**: No inheritance between repositories  
✅ **Testability**: Easy to mock dependencies independently  
✅ **Flexibility**: Can swap implementations without breaking changes  
✅ **Single Responsibility**: Each repository has one clear purpose  
✅ **Type Safety**: Interface contracts prevent runtime errors  
✅ **SOLID Principles**: Follows dependency inversion principle

## 🛡️ Protecting Authenticated Routes

### 1. Using the Authentication Decorator

The auth plugin provides a `fastify.authenticate` decorator that can be used as a `preHandler`:

```typescript
// Basic protected route
fastify.get('/protected', {
  preHandler: fastify.authenticate,
  handler: async (request, reply) => {
    // User is already authenticated here
    const user = request.authenticatedUser;
    return { message: `Hello ${user.name}!` };
  }
});
```

### 2. Multiple Protection Methods

#### Method A: Single Route Protection
```typescript
// Protect individual routes
fastify.get('/profile', {
  preHandler: fastify.authenticate,
  schema: {
    description: 'Get user profile',
    tags: ['User'],
    security: [{ bearerAuth: [] }]
  }
}, async (request, reply) => {
  const user = request.authenticatedUser;
  return { user };
});
```

#### Method B: Route Group Protection
```typescript
// Protect multiple routes at once
fastify.register(async function protectedRoutes(fastify) {
  // All routes in this context will be protected
  fastify.addHook('preHandler', fastify.authenticate);
  
  fastify.get('/dashboard', async (request, reply) => {
    return { data: 'Protected dashboard data' };
  });
  
  fastify.get('/settings', async (request, reply) => {
    return { settings: 'User settings' };
  });
});
```

#### Method C: Plugin-Level Protection
```typescript
// Create protected plugin
async function protectedPlugin(fastify: FastifyInstance) {
  // Authenticate all routes in this plugin
  fastify.addHook('preHandler', fastify.authenticate);
  
  await fastify.register(userRoutes, { prefix: '/user' });
  await fastify.register(adminRoutes, { prefix: '/admin' });
}

// Register with protection
fastify.register(protectedPlugin, { prefix: '/api/v1' });
```

### 3. Role-Based Access Control (RBAC)

The auth plugin provides built-in RBAC decorators for different access levels:

#### Available RBAC Decorators:
- `fastify.requireAdmin` - Requires admin role
- `fastify.requireRole(role)` - Requires specific role
- `fastify.requireRoles(roles[])` - Requires any of the specified roles

#### Basic RBAC Usage:

```typescript
// Admin only route
fastify.get('/admin/dashboard', {
  preHandler: [fastify.authenticate, fastify.requireAdmin]
}, async (request, reply) => {
  // Only admin users can access this
  const user = request.authenticatedUser!;
  return { 
    message: `Welcome admin ${user.name}!`,
    adminData: await getAdminDashboard()
  };
});

// Specific role required
fastify.get('/moderation/panel', {
  preHandler: [fastify.authenticate, fastify.requireRole('moderator')]
}, async (request, reply) => {
  // Only moderators can access
  return { moderationItems: await getModerationQueue() };
});

// Multiple roles accepted
fastify.get('/reports/financial', {
  preHandler: [fastify.authenticate, fastify.requireRoles(['manager', 'admin'])]
}, async (request, reply) => {
  // Managers or admins can access
  return { reports: await getFinancialReports() };
});
```

#### RBAC Error Responses:

```json
// 401 - No authentication
{
  "error": "Authentication required",
  "message": "Please provide a valid JWT token"
}

// 403 - Insufficient role
{
  "error": "Insufficient permissions", 
  "message": "Admin role required",
  "requiredRole": "admin",
  "userRole": "user"
}

// 403 - Role not in allowed list
{
  "error": "Insufficient permissions",
  "message": "Required roles: manager, admin", 
  "requiredRoles": ["manager", "admin"],
  "userRole": "user"
}
```

#### Complete RBAC Example Controller:

```typescript
// admin.controller.ts - Full RBAC implementation
export default async function adminController(fastify: FastifyInstance) {
  // Admin dashboard - admin only
  fastify.get('/admin/dashboard', {
    preHandler: [fastify.authenticate, fastify.requireAdmin]
  }, async (request, reply) => {
    const user = request.authenticatedUser!;
    return {
      message: 'Admin dashboard access granted',
      user: { id: user.id, name: user.name, role: user.role },
      timestamp: new Date().toISOString()
    };
  });

  // User management - admin only  
  fastify.get('/admin/users', {
    preHandler: [fastify.authenticate, fastify.requireAdmin]
  }, async (request, reply) => {
    return {
      message: 'User management access granted',
      users: await getAllUsers(), // Implementation depends on your repository
      total: await getUserCount()
    };
  });

  // Reports - multiple roles
  fastify.get('/admin/reports', {
    preHandler: [fastify.authenticate, fastify.requireRoles(['manager', 'admin'])]
  }, async (request, reply) => {
    const user = request.authenticatedUser!;
    return {
      message: 'Reports access granted',
      userRole: user.role,
      reports: await getReports(user.role)
    };
  });

  // Moderation - specific role
  fastify.get('/admin/moderation', {
    preHandler: [fastify.authenticate, fastify.requireRole('moderator')]
  }, async (request, reply) => {
    return {
      message: 'Moderation panel access granted',
      pendingItems: await getModerationQueue()
    };
  });
}
```

#### Testing RBAC:

```bash
# Test admin access (should work with admin token)
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3001/admin/dashboard

# Test user access (should fail with 403)  
curl -H "Authorization: Bearer USER_TOKEN" \
  http://localhost:3001/admin/dashboard

# Expected 403 response:
# {"error":"Insufficient permissions","message":"Admin role required"}
```

#### RBAC Best Practices:

1. **Always combine with authentication:**
```typescript
// ✅ Correct - authenticate first, then check role
preHandler: [fastify.authenticate, fastify.requireAdmin]

// ❌ Wrong - role check without authentication
preHandler: fastify.requireAdmin
```

2. **Use appropriate RBAC decorator:**
```typescript
// ✅ For single role requirement
preHandler: [fastify.authenticate, fastify.requireRole('manager')]

// ✅ For admin-only routes
preHandler: [fastify.authenticate, fastify.requireAdmin]

// ✅ For multiple acceptable roles
preHandler: [fastify.authenticate, fastify.requireRoles(['admin', 'supervisor'])]
```

3. **Document required roles in API schemas:**
```typescript
fastify.get('/admin/users', {
  preHandler: [fastify.authenticate, fastify.requireAdmin],
  schema: {
    description: 'List all users - Admin only',
    tags: ['Admin'],
    security: [{ bearerAuth: [] }],
    response: {
      200: { /* response schema */ },
      403: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' }
        }
      }
    }
  }
}, handler);
```

### 4. Custom Authentication Middleware

```typescript
// Custom middleware for specific requirements
const customAuthMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  // First, authenticate the user
  await fastify.authenticate(request, reply);
  
  const user = request.authenticatedUser;
  
  // Additional custom validations
  if (user.status !== 'active') {
    return reply.code(403).send({ error: 'Account suspended' });
  }
  
  if (!user.emailVerified) {
    return reply.code(403).send({ error: 'Email not verified' });
  }
};

// Use custom middleware
fastify.get('/sensitive-data', {
  preHandler: customAuthMiddleware
}, async (request, reply) => {
  return { sensitiveData: 'Only for active, verified users' };
});
```

### 5. Authentication Headers

Clients must include the JWT token in requests:

```bash
# Using Authorization header (recommended)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3001/api/protected

# Example with a real token
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     http://localhost:3001/auth/me
```

### 6. Error Handling for Protected Routes

```typescript
fastify.setErrorHandler((error, request, reply) => {
  // Handle authentication errors
  if (error.statusCode === 401) {
    return reply.code(401).send({
      error: 'Authentication required',
      message: 'Please provide a valid JWT token'
    });
  }
  
  if (error.statusCode === 403) {
    return reply.code(403).send({
      error: 'Access denied',
      message: 'Insufficient permissions for this resource'
    });
  }
  
  // Handle other errors...
  reply.send(error);
});
```

### 7. TypeScript Types for Protected Routes

```typescript
// Extend FastifyRequest to include authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    authenticatedUser?: {
      id: string;
      name: string;
      email: string;
      role: 'user' | 'admin';
      status: 'active' | 'inactive';
    };
  }
}
```

## 🔐 Authentication Flow

## 🔐 Authentication Flow

### 1. User Registration
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "64f8a1b2c3d4e5f6g7h8i9j0",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "status": "active"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. User Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com", 
  "password": "SecurePass123!"
}
```

### 3. Access Protected Routes
```http
GET /auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔧 Implementation Examples

### Example 1: Simple Protected API

```typescript
// routes/api.ts
export default async function apiRoutes(fastify: FastifyInstance) {
  // Protect all API routes
  fastify.addHook('preHandler', fastify.authenticate);
  
  fastify.get('/dashboard', async (request, reply) => {
    const user = request.authenticatedUser!;
    return {
      message: `Welcome to dashboard, ${user.name}!`,
      userRole: user.role,
      lastLogin: new Date()
    };
  });
  
  fastify.get('/profile', async (request, reply) => {
    const user = request.authenticatedUser!;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  });
}
```

### Example 2: Mixed Public/Protected Routes

```typescript
export default async function mixedRoutes(fastify: FastifyInstance) {
  // Public route - no authentication required
  fastify.get('/public-info', async (request, reply) => {
    return { message: 'This is public information' };
  });
  
  // Protected route - authentication required
  fastify.get('/private-info', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const user = request.authenticatedUser!;
    return { 
      message: 'This is private information',
      userId: user.id 
    };
  });
}
```

### Example 3: RBAC Protected Routes

```typescript
export default async function rbacRoutes(fastify: FastifyInstance) {
  // Admin-only route
  fastify.get('/admin/settings', {
    preHandler: [fastify.authenticate, fastify.requireAdmin]
  }, async (request, reply) => {
    return { settings: await getSystemSettings() };
  });
  
  // Multi-role route
  fastify.get('/reports/sales', {
    preHandler: [fastify.authenticate, fastify.requireRoles(['manager', 'admin', 'analyst'])]
  }, async (request, reply) => {
    const user = request.authenticatedUser!;
    return { 
      reports: await getSalesReports(user.role),
      accessLevel: user.role 
    };
  });
  
  // Role-specific route  
  fastify.post('/content/moderate', {
    preHandler: [fastify.authenticate, fastify.requireRole('moderator')]
  }, async (request, reply) => {
    const { contentId, action } = request.body as { contentId: string, action: string };
    await moderateContent(contentId, action);
    return { message: 'Content moderated successfully' };
  });
}
```

### Example 4: Conditional RBAC

```typescript
// Custom middleware with conditional role checking
const conditionalRoleCheck = async (request: FastifyRequest, reply: FastifyReply) => {
  await fastify.authenticate(request, reply);
  
  const user = request.authenticatedUser!;
  const { resourceId } = request.params as { resourceId: string };
  
  // Admin can access everything
  if (user.role === 'admin') return;
  
  // Users can only access their own resources
  if (user.role === 'user') {
    const resource = await getResource(resourceId);
    if (resource.ownerId !== user.id) {
      return reply.code(403).send({ 
        error: 'Access denied',
        message: 'You can only access your own resources'
      });
    }
    return;
  }
  
  // Other roles denied
  return reply.code(403).send({ error: 'Insufficient permissions' });
};

fastify.get('/resources/:resourceId', {
  preHandler: conditionalRoleCheck
}, async (request, reply) => {
  const { resourceId } = request.params as { resourceId: string };
  return { resource: await getResource(resourceId) };
});
```

## 🛠️ Advanced Configuration

### Custom JWT Strategy

```typescript
// custom-auth.plugin.ts
import { JwtStrategy } from './services/index.js';

export default async function customAuthPlugin(fastify: FastifyInstance) {
  const customStrategy = new JwtStrategy(process.env.CUSTOM_JWT_SECRET!);
  
  fastify.decorate('customAuthenticate', async (request, reply) => {
    const user = await customStrategy.authenticate(request, reply);
    if (!user) {
      return reply.code(401).send({ error: 'Custom authentication failed' });
    }
    request.authenticatedUser = user;
  });
}
```

### Rate Limiting for Auth Routes

```typescript
// auth-with-rate-limit.ts
export default async function authWithRateLimit(fastify: FastifyInstance) {
  // Rate limit for login attempts
  await fastify.register(import('@fastify/rate-limit'), {
    max: 5, // 5 attempts
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip
  });
  
  fastify.post('/auth/login', {
    preHandler: fastify.rateLimit()
  }, async (request, reply) => {
    // Login logic with rate limiting
  });
}
```

### Main Components

#### AuthController
Manages authentication routes:
- `POST /auth/register` - User registration with password hashing
- `POST /auth/login` - User login with bcrypt verification
- `GET /auth/me` - Authenticated user data (protected)

#### AuthPlugin  
Fastify plugin that:
- Registers JWT authentication middleware
- Validates JWT tokens using JwtStrategy
- Provides `fastify.authenticate` decorator
- Manages user sessions and token verification

#### AuthRepository
Persistence layer responsible for:
- User CRUD operations with password hashing
- Search by email and ID with validation
- Uniqueness validations using Zod schemas
- Status and role control

#### Services
- **PasswordService**: Secure bcrypt password hashing and comparison
- **JwtStrategy**: JWT token validation and user authentication
- **AuthenticateCommand**: Command pattern for authentication operations

### Security Features
- **Password Hashing**: bcrypt with 12 salt rounds
- **Input Validation**: Zod schemas with sanitization
- **Injection Protection**: XSS, NoSQL injection, path traversal prevention
- **JWT Security**: Secure token generation and validation
- **Rate Limiting**: Protection against brute force attacks
- **Role-Based Access**: User/admin role separation

## Integration
The module is integrated into the system through the main `modules.ts` and uses global database configurations and environment validation.

## 🧪 Testing Protected Routes (Including RBAC)

### Using HTTP Client (VS Code REST Client)
```http
### 1. Register a new user (default role: user)
POST http://localhost:3001/auth/register
Content-Type: application/json

{
  "name": "Regular User",
  "email": "user@example.com", 
  "password": "SecurePass123!"
}

### 2. Register an admin user (assuming you have a way to set admin role)
POST http://localhost:3001/auth/register
Content-Type: application/json

{
  "name": "Admin User",
  "email": "admin@example.com", 
  "password": "AdminPass123!"
}

### 3. Login as regular user and save token
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "user@example.com", 
  "password": "SecurePass123!"
}
# Save response token as {{userToken}}

### 4. Login as admin and save token
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "admin@example.com", 
  "password": "AdminPass123!"
}
# Save response token as {{adminToken}}

### 5. Test basic authentication (should work for both)
GET http://localhost:3001/auth/me
Authorization: Bearer {{userToken}}

### 6. Test admin-only route with user token (should fail with 403)
GET http://localhost:3001/admin/dashboard
Authorization: Bearer {{userToken}}
# Expected: 403 Forbidden

### 7. Test admin-only route with admin token (should work)
GET http://localhost:3001/admin/dashboard
Authorization: Bearer {{adminToken}}
# Expected: 200 OK

### 8. Test role-specific route
GET http://localhost:3001/admin/moderation
Authorization: Bearer {{adminToken}}
# Should work if admin has moderator privileges

### 9. Test multi-role route
GET http://localhost:3001/admin/reports
Authorization: Bearer {{adminToken}}
# Should work for admin/manager roles
```

### Using cURL with RBAC Testing
```bash
# Register and login user
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"user@test.com","password":"SecurePass123!"}'

USER_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"SecurePass123!"}' | \
  jq -r '.data.token')

# Register and login admin  
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin User","email":"admin@test.com","password":"AdminPass123!"}'

ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"AdminPass123!"}' | \
  jq -r '.data.token')

# Test basic authentication (both should work)
echo "=== Testing basic auth with user token ==="
curl -H "Authorization: Bearer $USER_TOKEN" http://localhost:3001/auth/me

echo "=== Testing basic auth with admin token ==="
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3001/auth/me

# Test RBAC - admin only routes
echo "=== Testing admin route with user token (should fail) ==="
curl -H "Authorization: Bearer $USER_TOKEN" http://localhost:3001/admin/dashboard

echo "=== Testing admin route with admin token (should work) ==="
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3001/admin/dashboard

# Test specific roles
echo "=== Testing role-specific route ==="
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3001/admin/moderation

# Test multi-role routes
echo "=== Testing multi-role route ==="  
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3001/admin/reports
```

### RBAC Test Results Expected:

#### ✅ Successful RBAC Response (Admin accessing admin route):
```json
{
  "message": "Admin dashboard access granted",
  "user": {
    "id": "64f8a1b2c3d4e5f6g7h8i9j0",
    "name": "Admin User", 
    "role": "admin"
  },
  "timestamp": "2025-09-20T10:30:45.123Z"
}
```

#### ❌ Failed RBAC Response (User trying to access admin route):
```json
{
  "error": "Insufficient permissions",
  "message": "Admin role required",
  "requiredRole": "admin",
  "userRole": "user"
}
```

#### ❌ Failed Role-Specific Response (Wrong role):
```json
{
  "error": "Insufficient permissions", 
  "message": "Required role: moderator",
  "requiredRole": "moderator",
  "userRole": "user"
}
```

#### ❌ Failed Multi-Role Response:
```json
{
  "error": "Insufficient permissions",
  "message": "Required roles: manager, admin",
  "requiredRoles": ["manager", "admin"],
  "userRole": "user"
}
```

## 🚨 Common Issues and Troubleshooting

### Issue 1: "Authentication required" Error
**Problem:** `401 Unauthorized` when accessing protected routes

**Solutions:**
```typescript
// Check if token is being sent correctly
const authHeader = request.headers['authorization'];
console.log('Auth header:', authHeader); // Should be: "Bearer eyJ..."

// Verify token format
if (!authHeader?.startsWith('Bearer ')) {
  console.log('Invalid token format');
}
```

### Issue 2: "Invalid token" Error  
**Problem:** JWT token is malformed or expired

**Solutions:**
```typescript
// Check token expiration
import jwt from 'jsonwebtoken';
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('Token valid:', decoded);
} catch (error) {
  console.log('Token error:', error.message);
}
```

### Issue 3: User Object Not Available
**Problem:** `request.authenticatedUser` is undefined

**Solution:**
```typescript
// Ensure proper TypeScript types
declare module 'fastify' {
  interface FastifyRequest {
    authenticatedUser?: AuthenticatedUser;
  }
}

// Use non-null assertion or check
const user = request.authenticatedUser!; // If you're sure it exists
// OR
const user = request.authenticatedUser;
if (!user) {
  return reply.code(401).send({ error: 'User not authenticated' });
}
```

### Issue 4: RBAC Permission Denied
**Problem:** `403 Forbidden` when user should have access

**Debugging Steps:**
```typescript
// Debug user role in route handler
fastify.get('/debug-role', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  const user = request.authenticatedUser!;
  return {
    userId: user.id,
    userName: user.name,
    userRole: user.role, // Check if this matches expected role
    timestamp: new Date()
  };
});

// Debug RBAC decorator
fastify.decorate('debugRequireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
  console.log('=== RBAC Debug ===');
  console.log('User:', request.authenticatedUser);
  console.log('Role:', request.authenticatedUser?.role);
  console.log('Is Admin:', request.authenticatedUser?.role === 'admin');
  
  if (request.authenticatedUser?.role !== 'admin') {
    console.log('RBAC: Access denied - not admin');
    return reply.code(403).send({
      error: 'Insufficient permissions',
      userRole: request.authenticatedUser?.role,
      requiredRole: 'admin'
    });
  }
  
  console.log('RBAC: Access granted');
});
```

### Issue 5: Role Not Set in JWT Token
**Problem:** User role is undefined or null

**Solution:**
```typescript
// Ensure role is included when creating JWT
// In your auth service/login method:
const token = jwt.sign(
  { 
    id: user.id, 
    name: user.name,
    role: user.role || 'user' // Ensure role is always set
  }, 
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

// Verify token includes role
const decoded = jwt.verify(token, process.env.JWT_SECRET);
console.log('Token payload:', decoded); // Should include role
```

### Issue 6: Multiple Roles Not Working
**Problem:** `requireRoles(['admin', 'manager'])` not accepting valid roles

**Solution:**
```typescript
// Debug multi-role check
fastify.decorate('debugRequireRoles', (allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.authenticatedUser?.role;
    console.log('User role:', userRole);
    console.log('Allowed roles:', allowedRoles);
    console.log('Role included:', allowedRoles.includes(userRole || ''));
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      return reply.code(403).send({
        error: 'Insufficient permissions',
        message: `Required roles: ${allowedRoles.join(', ')}`,
        userRole: userRole,
        requiredRoles: allowedRoles
      });
    }
  };
});
```

## 🎯 Best Practices

1. **Always validate user existence in protected routes:**
```typescript
fastify.get('/protected', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  const user = request.authenticatedUser;
  if (!user) {
    return reply.code(401).send({ error: 'Authentication failed' });
  }
  // Continue with authenticated user
});
```

2. **Use specific error messages for different scenarios:**
```typescript
// Instead of generic "Unauthorized"
if (!token) return reply.code(401).send({ error: 'Missing authentication token' });
if (tokenExpired) return reply.code(401).send({ error: 'Token expired, please login again' });
if (invalidToken) return reply.code(401).send({ error: 'Invalid authentication token' });
```

3. **Implement proper CORS for frontend integration:**
```typescript
await fastify.register(import('@fastify/cors'), {
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
});
```

4. **Add request logging for debugging:**
```typescript
fastify.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/auth/') || request.headers.authorization) {
    fastify.log.info({
      url: request.url,
      method: request.method,
      hasAuth: !!request.headers.authorization
    }, 'Authentication request');
  }
});
```

## 📝 Environment Variables Required

```bash
# .env file
JWT_SECRET=your-super-secret-jwt-key-here-at-least-32-characters
MONGODB_URI=mongodb://localhost:27017/your-database
NODE_ENV=development
```

Make sure `JWT_SECRET` is:
- At least 32 characters long
- Cryptographically random
- Different for each environment (dev/staging/prod)
- Never committed to version control

## 💡 Real Implementation Example

Check the existing protected route in `auth.controller.ts`:

```typescript
// Protected route example from auth.controller.ts
fastify.get('/me', {
  preHandler: fastify.authenticate,  // ← This protects the route
  schema: {
    description: 'Return authenticated user data',
    tags: ['Auth'],
    summary: 'User Profile',
    security: [{ bearerAuth: [] }]    // ← Swagger documentation
  }
}, async (request, reply) => {
  try {
    // User is guaranteed to be authenticated here
    if (!request.authenticatedUser) {
      return ApiResponseHandler.authError(reply, 'User not authenticated');
    }

    // Access user data safely
    const user = await authRepository.findById(request.authenticatedUser.id.toString());
    
    return ApiResponseHandler.success(reply, 'User data returned', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    return ApiResponseHandler.internalError(reply, error);
  }
});
```

This demonstrates the complete pattern:
1. **Route Protection**: `preHandler: fastify.authenticate`
2. **Error Handling**: Check for authenticated user
3. **Data Access**: Use `request.authenticatedUser` safely
4. **API Documentation**: Include security schema for Swagger