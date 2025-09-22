# User Entity - Dependency Injection Architecture

## 🏗️ Overview

The User entity implements the **new dependency injection architecture** with composition over inheritance. This provides better testability, maintainability, and follows SOLID principles.

## Architecture

### **Dependency Injection Pattern**
```
BaseRepository<IUser> (implements IBaseRepository<IUser>)
    ↓ (injected into)
UserRepository (implements IUserRepository)
    ↓ (injected into)  
AuthRepository (implements IAuthRepository)
```

**Benefits:**
- ✅ **Zero inheritance coupling**
- ✅ **Easy to test with mocks**
- ✅ **Interface-based contracts**
- ✅ **Flexible implementation swapping**

## File Structure

```
user/
├── userEntity.ts           # IUser interface, UserModel, UserValidations
├── userRepository.ts       # UserRepository with BaseRepository injection
├── userRepository.factory.ts # Factory for dependency injection
└── index.ts               # Exports including IUserRepository interface
```

## Usage Examples

### 1. Production Usage (Factory Pattern)
```typescript
import { UserRepositoryFactory } from '../entities/user/index.js';

// Create UserRepository with all dependencies injected
const userRepository = UserRepositoryFactory.createUserRepository();

// Use normally - BaseRepository is injected automatically
const user = await userRepository.createUser({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'SecurePass123!'
});

const allUsers = await userRepository.findAllUsers();
const userByEmail = await userRepository.findUserByEmail('john@example.com');
```

### 2. Manual Injection (Custom scenarios)
```typescript
import { BaseRepository, UserRepository } from '../entities/user/index.js';
import { UserModel } from '../entities/user/userEntity.js';
import type { IUser } from '../entities/user/index.js';

// Create BaseRepository instance
const baseRepository = new BaseRepository<IUser>(UserModel);

// Inject into UserRepository
const userRepository = new UserRepository(baseRepository);

// Use with custom BaseRepository configuration
```

### 3. Testing with Mocks
```typescript
import { UserRepositoryFactory } from '../entities/user/index.js';
import type { IBaseRepository, IUserRepository } from '../entities/user/index.js';

// Create mock BaseRepository
const mockBaseRepository: jest.Mocked<IBaseRepository<IUser>> = {
  create: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
  // ... other methods
};

// Create UserRepository with mock
const userRepository = UserRepositoryFactory.createUserRepositoryForTesting(mockBaseRepository);

// Test with mocked dependencies
mockBaseRepository.create.mockResolvedValue(mockUser);
const result = await userRepository.createUser(userData);
```

## API Reference

### IUserRepository Interface
```typescript
export interface IUserRepository {
  // User-specific CRUD operations
  createUser(userData: CreateUserData, session?: ClientSession): Promise<IUser>;
  updateUser(id: string, updateData: UpdateUserData, session?: ClientSession): Promise<IUser | null>;
  
  // User-specific queries  
  findUserByEmail(email: string, session?: ClientSession): Promise<IUser | null>;
  findUserById(id: string, session?: ClientSession): Promise<IUser | null>;
  findAllUsers(session?: ClientSession): Promise<IUser[]>;
  findUsersByRole(role: string, session?: ClientSession): Promise<IUser[]>;
  findActiveUsers(session?: ClientSession): Promise<IUser[]>;
  
  // User-specific operations
  updateLastLogin(id: string, session?: ClientSession): Promise<IUser | null>;
  changeUserStatus(id: string, status: UserStatus, session?: ClientSession): Promise<IUser | null>;
  
  // Validation utilities
  existsByEmail(email: string, excludeId?: string, session?: ClientSession): Promise<boolean>;
  
  // Pagination support
  findUsersWithPagination(filters?: any, page?: number, limit?: number, session?: ClientSession): Promise<any>;
}
```

### UserRepository Methods

#### Core CRUD Operations
- `createUser(userData, session?)` - Create new user with validation
- `updateUser(id, updateData, session?)` - Update user with validation  
- `findUserById(id, session?)` - Find user by ID
- `findUserByEmail(email, session?)` - Find user by email
- `findAllUsers(session?)` - Get all users
- `deleteUser(id, session?)` - Soft delete user

#### Business-Specific Operations  
- `findUsersByRole(role, session?)` - Filter users by role
- `findActiveUsers(session?)` - Get only active users
- `updateLastLogin(id, session?)` - Update login timestamp
- `changeUserStatus(id, status, session?)` - Change user status
- `existsByEmail(email, excludeId?, session?)` - Check email uniqueness

#### Pagination & Search
- `findUsersWithPagination(filters?, page?, limit?, session?)` - Paginated results
- `searchUsers(query, session?)` - Text search in user fields

## Integration with Other Modules

### Auth Module Integration
```typescript
// src/modules/auth/repository/auth.repository.ts
import type { IUserRepository } from '../../../entities/user/index.js';

export class AuthRepository implements IAuthRepository {
  constructor(private userRepository: IUserRepository) {}
  
  async findUserByEmail(email: string): Promise<IUser | null> {
    return this.userRepository.findUserByEmail(email);
  }
  
  async createUser(userData: any): Promise<IUser> {
    return this.userRepository.createUser(userData);
  }
}

// src/modules/auth/factory/auth.factory.ts
import { UserRepositoryFactory } from '../../../entities/user/index.js';

export class AuthRepositoryFactory {
  static createAuthRepository(): IAuthRepository {
    const userRepository = UserRepositoryFactory.createUserRepository();
    return new AuthRepository(userRepository);
  }
}
```

## Validation Rules

The User entity includes comprehensive validation through `UserValidations`:

### Input Validation
- **Name**: 2-100 characters, sanitized
- **Email**: Valid email format, unique, lowercase
- **Password**: 8+ characters, hashed with bcrypt
- **Role**: Enum validation (user, admin)
- **Status**: Enum validation (active, inactive, suspended)

### Business Rules
- Email must be unique across all users
- Password is automatically hashed before storage
- Default role is 'user' if not specified
- Default status is 'active' for new users

## Testing Patterns

### Unit Testing UserRepository
```typescript
describe('UserRepository', () => {
  let userRepository: IUserRepository;
  let mockBaseRepository: jest.Mocked<IBaseRepository<IUser>>;
  
  beforeEach(() => {
    mockBaseRepository = createMockBaseRepository();
    userRepository = new UserRepository(mockBaseRepository);
  });
  
  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!'
      };
      
      const expectedUser = { ...userData, _id: 'user-id' } as IUser;
      mockBaseRepository.create.mockResolvedValue(expectedUser);
      
      const result = await userRepository.createUser(userData);
      
      expect(mockBaseRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          // password should be hashed
          password: expect.not.stringMatching('SecurePass123!')
        }),
        {}
      );
      expect(result).toEqual(expectedUser);
    });
    
    it('should throw validation error for invalid data', async () => {
      const invalidData = {
        name: '', // Invalid: too short
        email: 'invalid-email', // Invalid: not email format
        password: '123' // Invalid: too short
      };
      
      await expect(userRepository.createUser(invalidData))
        .rejects.toThrow(z.ZodError);
    });
  });
  
  describe('findUserByEmail', () => {
    it('should find user by email', async () => {
      const email = 'john@example.com';
      const expectedUser = { email, name: 'John' } as IUser;
      
      mockBaseRepository.findOne.mockResolvedValue(expectedUser);
      
      const result = await userRepository.findUserByEmail(email);
      
      expect(mockBaseRepository.findOne).toHaveBeenCalledWith(
        { email },
        {}
      );
      expect(result).toEqual(expectedUser);
    });
    
    it('should return null when user not found', async () => {
      mockBaseRepository.findOne.mockResolvedValue(null);
      
      const result = await userRepository.findUserByEmail('notfound@example.com');
      
      expect(result).toBeNull();
    });
  });
});
```

### Integration Testing
```typescript
describe('UserRepository Integration', () => {
  let userRepository: IUserRepository;
  
  beforeEach(() => {
    // Use factory for integration tests
    userRepository = UserRepositoryFactory.createUserRepository();
  });
  
  it('should create and find user in database', async () => {
    const userData = {
      name: 'Integration Test User',
      email: 'integration@test.com',
      password: 'TestPass123!'
    };
    
    // Create user
    const createdUser = await userRepository.createUser(userData);
    expect(createdUser._id).toBeDefined();
    
    // Find by email
    const foundUser = await userRepository.findUserByEmail(userData.email);
    expect(foundUser?.email).toBe(userData.email);
    expect(foundUser?.name).toBe(userData.name);
    
    // Password should be hashed
    expect(foundUser?.password).not.toBe(userData.password);
  });
});
```

## Migration Notes

### From Old Architecture (Inheritance)
If migrating from the old inheritance-based pattern:

```typescript
// OLD (Remove):
class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }
}

// NEW (Current):
class UserRepository implements IUserRepository {
  constructor(private baseRepository: IBaseRepository<IUser>) {}
  
  async createUser(userData: any): Promise<IUser> {
    return this.baseRepository.create(userData);
  }
}
```

### Factory Usage Migration
```typescript
// OLD (Direct instantiation):
const userRepository = new UserRepository();

// NEW (Factory pattern):
const userRepository = UserRepositoryFactory.createUserRepository();
```

## Performance Considerations

### Database Indexes
The User entity includes optimized indexes:
- `email` - Unique index for fast email lookups
- `status, createdAt` - Compound index for active user queries
- `role` - Index for role-based filtering

### Caching Strategy
Consider implementing caching at the repository level for frequently accessed users:
```typescript
async findUserById(id: string, session?: ClientSession): Promise<IUser | null> {
  // Check cache first
  const cached = await this.cache.get(`user:${id}`);
  if (cached) return cached;
  
  // Fallback to database
  const user = await this.baseRepository.findById(id, { session });
  if (user) {
    await this.cache.set(`user:${id}`, user, { ttl: 300 }); // 5 minutes
  }
  
  return user;
}
```

## Security Considerations

1. **Password Hashing**: Automatically handled in `createUser` and `updateUser`
2. **Input Sanitization**: All inputs validated with Zod schemas
3. **Email Uniqueness**: Enforced at both validation and database level
4. **Sensitive Data**: Password excluded from JSON serialization
5. **Transaction Support**: All methods support MongoDB sessions for ACID operations

---

**Related Documentation:**
- [Entity Architecture Overview](../README.md)
- [Auth Module Integration](../../modules/auth/README.md)
- [Dependency Injection Examples](../../examples/dependency-injection-usage.md)
- [BaseRepository API](../../infraestructure/mongo/README.md)