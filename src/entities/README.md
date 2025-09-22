# Entity Architecture Documentation

## 🏗️ Overview - NEW DEPENDENCY INJECTION ARCHITECTURE

The entities layer represents the core domain models using **dependency injection** instead of inheritance. Each entity follows a standardized structure with **composition over inheritance** for better testability and maintainability.

### 🎯 **NEW Architecture Pattern (Post-Refactoring)**

**Before (Problematic Inheritance):**
```typescript
class UserRepository extends BaseRepository<IUser> {}        // ❌ Tight coupling
class AuthRepository extends UserRepository {}               // ❌ Deep inheritance
```

**Now (Dependency Injection):**
```typescript
interface IUserRepository { /* contract */ }                // ✅ Interface-based
class UserRepository implements IUserRepository {           // ✅ Composition
  constructor(private baseRepository: IBaseRepository) {}   // ✅ Dependency injection
}
class AuthRepository implements IAuthRepository {           // ✅ Interface-based
  constructor(private userRepository: IUserRepository) {}   // ✅ Dependency injection
}
```

## Entity Structure Standards

### Directory Organization

```
src/entities/
├── README.md                    # This documentation
├── {entityName}/               # Entity-specific directory
│   ├── {entityName}Entity.ts   # Complete entity definition
│   ├── {entityName}Repository.ts # Repository with dependency injection
│   ├── {entityName}Repository.factory.ts # Factory for DI instantiation
│   └── index.ts               # Clean exports including interfaces
└── user/                      # Example: User entity
    ├── userEntity.ts          # User interface, validations, schema, model
    ├── userRepository.ts      # UserRepository with BaseRepository injection
    ├── userRepository.factory.ts # UserRepositoryFactory for DI
    └── index.ts              # User entity exports + IUserRepository interface
```

## Entity File Structure

### 1. {entityName}Entity.ts - Complete Entity Definition

This file contains the complete entity definition following a strict structure:

#### 1.1 Interface for Repository Usage
```typescript
import { Schema, model, Document } from 'mongoose';
import { z } from 'zod';
import { EmailSchema, PasswordSchema, NameSchema } from '../../lib/validators/index.js';

/**
 * Interface defining the entity structure for repository operations
 * Must extend Mongoose Document for database integration
 */
export interface IEntityName extends Document {
  // Core entity fields
  field1: string;
  field2: number;
  status: 'active' | 'inactive';
  
  // System fields (automatically managed)
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  customMethod(): boolean;
}
```

#### 1.2 Entity-Specific Validation Class
```typescript
/**
 * Entity-specific validation schemas and business rules
 * Should extend global validations whenever possible
 */
export class EntityNameValidations {
  // Entity-specific enums and constants
  static readonly ENTITY_STATUSES = ['active', 'inactive', 'suspended'] as const;
  
  // Entity-specific validation schemas extending global ones
  static readonly StatusSchema = z.enum(EntityNameValidations.ENTITY_STATUSES, {
    message: 'Status must be: active, inactive or suspended'
  });
  
  // Complete entity creation schema
  static readonly CreateEntitySchema = z.object({
    field1: NameSchema,           // Using global validator
    field2: EmailSchema,          // Using global validator
    status: EntityNameValidations.StatusSchema.optional().default('active'),
    // Add other fields with appropriate validations
  });
  
  // Entity update schema
  static readonly UpdateEntitySchema = z.object({
    field1: NameSchema.optional(),
    field2: EmailSchema.optional(),
    status: EntityNameValidations.StatusSchema.optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  });
  
  /**
   * Validate entity creation data
   * @param data - Raw input data
   * @returns Validated and sanitized data
   */
  static validateCreate(data: unknown) {
    return this.CreateEntitySchema.parse(data);
  }
  
  /**
   * Validate entity update data
   * @param data - Raw update data
   * @returns Validated update data
   */
  static validateUpdate(data: unknown) {
    return this.UpdateEntitySchema.parse(data);
  }
  
  /**
   * Business rule validations
   * @param entity - Entity instance
   * @returns True if entity passes business validations
   */
  static canBeActivated(entity: IEntityName): boolean {
    // Business logic here
    return entity.status !== 'suspended';
  }
}
```

#### 1.3 Mongoose Schema Definition
```typescript
/**
 * Mongoose schema for database operations
 * Must align with interface definition and include validation
 */
const entitySchema = new Schema<IEntityName>({
  field1: {
    type: String,
    required: [true, 'Field1 is required'],
    trim: true,
    minlength: [2, 'Field1 must have at least 2 characters'],
    maxlength: [100, 'Field1 must have at most 100 characters'],
    validate: {
      validator: function(v: string) {
        try {
          NameSchema.parse(v);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Invalid field1 format'
    }
  },
  
  field2: {
    type: String,
    required: [true, 'Field2 is required'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v: string) {
        try {
          EmailSchema.parse(v);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Invalid field2 format'
    }
  },
  
  status: {
    type: String,
    enum: {
      values: EntityNameValidations.ENTITY_STATUSES,
      message: 'Status must be: active, inactive or suspended'
    },
    default: 'active'
  }
}, {
  timestamps: true,        // Automatic createdAt/updatedAt
  versionKey: false,       // Remove __v field
  strict: true,           // Only allow schema-defined fields
  minimize: false         // Keep empty objects
});
```

#### 1.4 Database Indexes
```typescript
// Performance indexes for common queries
entitySchema.index({ field2: 1 });                    // Unique index (automatically created)
entitySchema.index({ status: 1, createdAt: -1 });     // Status queries with sorting
entitySchema.index({ field1: 'text' });               // Text search capabilities
```

#### 1.5 Mongoose Middleware and Hooks
```typescript
// Pre-save data sanitization and validation
entitySchema.pre('save', function(next) {
  // Data sanitization
  if (this.field1) {
    this.field1 = this.field1.trim();
  }
  
  // Additional validation or transformation logic
  next();
});

// Pre-update hooks for consistency
entitySchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
  const update = this.getUpdate() as any;
  if (update.$set?.field1) {
    update.$set.field1 = update.$set.field1.trim();
  }
  next();
});
```

#### 1.6 Instance Methods
```typescript
// Custom instance methods for business logic
entitySchema.methods.customMethod = function(): boolean {
  return this.status === 'active';
};

entitySchema.methods.toJSON = function() {
  const obj = this.toObject();
  // Remove sensitive fields from JSON representation
  delete obj.sensitiveField;
  return obj;
};
```

#### 1.7 Static Methods
```typescript
// Static methods for common queries
entitySchema.statics.findActiveEntities = function() {
  return this.find({ status: 'active' }).sort({ createdAt: -1 });
};
```

#### 1.8 Model Export
```typescript
/**
 * Mongoose model for database operations
 * Export for use in repositories
 */
export const EntityNameModel = model<IEntityName>('EntityName', entitySchema);
```

### 2. {entityName}Repository.ts - Repository with Dependency Injection

Repository implements interface and receives BaseRepository as dependency:

```typescript
import type { IBaseRepository } from '../../infraestructure/mongo/interfaces.js';
import { EntityNameModel, type IEntityName, EntityNameValidations } from './entityEntity.js';
import type { ClientSession, FilterQuery } from 'mongoose';

/**
 * Interface defining repository contract for dependency injection
 */
export interface IEntityNameRepository {
  createEntity(entityData: any, session?: ClientSession): Promise<IEntityName>;
  updateEntity(id: string, updateData: any, session?: ClientSession): Promise<IEntityName | null>;
  findActiveEntities(session?: ClientSession): Promise<IEntityName[]>;
  // ... other methods
}

/**
 * Entity repository using composition with BaseRepository injection
 * NO inheritance - uses dependency injection instead
 */
export class EntityNameRepository implements IEntityNameRepository {
  constructor(private baseRepository: IBaseRepository<IEntityName>) {}

  /**
   * Helper to create repository options with session support
   * @param session - MongoDB session for transactions
   * @returns Repository options object
   */
  private getRepoOptions(session?: ClientSession) {
    return session ? { session } : {};
  }

  // ==========================================
  // ENTITY-SPECIFIC CRUD OPERATIONS
  // ==========================================

  /**
   * Create entity with validation and business rules
   * @param entityData - Raw entity data
   * @param session - Optional database session for transactions
   * @returns Created entity
   */
  async createEntity(
    entityData: Parameters<typeof EntityNameValidations.validateCreate>[0],
    session?: ClientSession
  ): Promise<IEntityName> {
    // Validate input using entity validations
    const validatedData = EntityNameValidations.validateCreate(entityData);
    
    // Use injected BaseRepository for database operation
    return this.baseRepository.create(validatedData as Partial<IEntityName>, this.getRepoOptions(session));
  }

  /**
   * Update entity with validation
   * @param id - Entity ID
   * @param updateData - Update data
   * @param session - Optional database session
   * @returns Updated entity or null
   */
  async updateEntity(
    id: string,
    updateData: Parameters<typeof EntityNameValidations.validateUpdate>[0],
    session?: ClientSession
  ): Promise<IEntityName | null> {
    // Validate update data
    const validatedData = EntityNameValidations.validateUpdate(updateData);
    
    // Use injected BaseRepository method
    return this.baseRepository.updateById(id, { $set: validatedData }, this.getRepoOptions(session));
  }

  // ==========================================
  // BUSINESS-SPECIFIC QUERY METHODS
  // ==========================================

  /**
   * Find active entities
   * @param session - Optional database session
   * @returns Array of active entities
   */
  async findActiveEntities(session?: ClientSession): Promise<IEntityName[]> {
    return this.baseRepository.find({ status: 'active' }, this.getRepoOptions(session));
  }

  /**
   * Find entities with pagination and filtering
   * @param filters - Query filters
   * @param page - Page number
   * @param limit - Items per page
   * @param session - Optional database session
   * @returns Paginated result
   */
  async findEntitiesWithPagination(
    filters: FilterQuery<IEntityName> = {},
    page: number = 1,
    limit: number = 10,
    session?: ClientSession
  ) {
    return this.baseRepository.findPaginated(
      filters,
      page,
      limit,
      { createdAt: -1 }, // Default sort
      this.getRepoOptions(session)
    );
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Check if entity exists by unique field
   * @param field2Value - Unique field value
   * @param session - Optional database session
   * @returns True if exists
   */
  async existsByField2(field2Value: string, session?: ClientSession): Promise<boolean> {
    return this.baseRepository.exists({ field2: field2Value }, this.getRepoOptions(session));
  }
}
```

### 3. {entityName}Repository.factory.ts - Dependency Injection Factory

```typescript
import { BaseRepository } from '../../infraestructure/mongo/index.js';
import { EntityNameModel } from './entityEntity.js';
import { EntityNameRepository, type IEntityNameRepository } from './entityRepository.js';
import type { IEntityName } from './entityEntity.js';

/**
 * Factory class for creating EntityName repositories with proper dependency injection
 * This ensures proper separation of concerns and testability
 */
export class EntityNameRepositoryFactory {
  /**
   * Create EntityNameRepository instance with injected BaseRepository
   */
  static createEntityNameRepository(): IEntityNameRepository {
    const baseRepository = new BaseRepository<IEntityName>(EntityNameModel);
    return new EntityNameRepository(baseRepository);
  }

  /**
   * Create EntityNameRepository instance for testing with mocked BaseRepository
   * @param mockBaseRepository - Mocked BaseRepository for testing
   */
  static createEntityNameRepositoryForTesting(mockBaseRepository: any): IEntityNameRepository {
    return new EntityNameRepository(mockBaseRepository);
  }
}
```

### 4. index.ts - Clean Exports with Interfaces

```typescript
/**
 * Entity exports - Clean interface for importing entity components
 * NOW INCLUDES INTERFACES for dependency injection
 */

// Type exports (interfaces, types)
export type { IEntityName } from './entityEntity.js';
export type { IEntityNameRepository } from './entityRepository.js';

// Class exports (model, validations)
export { EntityNameModel, EntityNameValidations } from './entityEntity.js';

// Repository and factory exports
export { EntityNameRepository } from './entityRepository.js';
export { EntityNameRepositoryFactory } from './entityRepository.factory.js';
```

## Architectural Rules and Best Practices

### 🏗️ **NEW Mandatory Patterns (Post-Refactoring)**

#### 1. Repository Composition (Not Inheritance)
```typescript
// ✅ CORRECT - Dependency injection with interfaces
export class UserRepository implements IUserRepository {
  constructor(private baseRepository: IBaseRepository<IUser>) {}
  
  async createUser(userData: any): Promise<IUser> {
    return this.baseRepository.create(userData); // Delegates to injected dependency
  }
}

// ❌ INCORRECT - Old inheritance pattern (removed)
export class BadRepository extends BaseRepository<IUser> {
  // This creates tight coupling and is no longer used
}
```

#### 2. Interface-First Design
```typescript
// ✅ CORRECT - Define interface contracts first
export interface IUserRepository {
  createUser(userData: any, session?: ClientSession): Promise<IUser>;
  findUserByEmail(email: string, session?: ClientSession): Promise<IUser | null>;
  // ... other methods
}

export class UserRepository implements IUserRepository {
  // Implementation follows interface contract
}

// ❌ INCORRECT - Implementation without interface
export class BadRepository {
  // No contract, difficult to test and substitute
}
```

#### 3. Factory Pattern for DI
```typescript
// ✅ CORRECT - Use factories for dependency injection
export class UserRepositoryFactory {
  static createUserRepository(): IUserRepository {
    const baseRepository = new BaseRepository<IUser>(UserModel);
    return new UserRepository(baseRepository);
  }
  
  static createUserRepositoryForTesting(mockBaseRepository: any): IUserRepository {
    return new UserRepository(mockBaseRepository);
  }
}

// ❌ INCORRECT - Manual instantiation everywhere
const repository = new UserRepository(new BaseRepository(...)); // Scattered dependencies
```

#### 4. Session Support with DI
```typescript
// ✅ CORRECT - Pass session through to injected repository
async createUser(userData: any, session?: ClientSession): Promise<IUser> {
  const options = session ? { session } : {};
  return this.baseRepository.create(userData, options);
}

// ❌ INCORRECT - Breaking session chain
async createUser(userData: any, session?: ClientSession): Promise<IUser> {
  return this.baseRepository.create(userData); // Session lost!
}
```

### 📐 **NEW Architecture Patterns**

#### Dependency Injection Chain
```
BaseRepository<T> (implements IBaseRepository<T>)
    ↓ (injected into)
UserRepository (implements IUserRepository)
    ↓ (injected into)
AuthRepository (implements IAuthRepository)
```

**Benefits:**
- ✅ **Zero inheritance** - no coupling between layers
- ✅ **Easy testing** - mock any dependency independently  
- ✅ **Flexible** - swap implementations without changing dependents
- ✅ **SOLID principles** - follows dependency inversion principle

### 🔄 **Migration from Old to New Pattern**

#### Old Pattern (Removed):
```typescript
// ❌ OLD: Inheritance chain with tight coupling
class UserRepository extends BaseRepository<IUser> {
  constructor() { super(UserModel); }
}

class AuthRepository extends UserRepository {
  // Inherits all UserRepository methods + BaseRepository methods
  // Tight coupling, difficult to test, violates single responsibility
}
```

#### New Pattern (Current):
```typescript
// ✅ NEW: Composition with dependency injection
interface IUserRepository {
  createUser(data: any): Promise<IUser>;
  findUserByEmail(email: string): Promise<IUser | null>;
}

class UserRepository implements IUserRepository {
  constructor(private baseRepository: IBaseRepository<IUser>) {}
  
  async createUser(data: any): Promise<IUser> {
    return this.baseRepository.create(data);
  }
}

interface IAuthRepository {
  findUserByEmail(email: string): Promise<IUser | null>;
  createUser(data: any): Promise<IUser>;
}

class AuthRepository implements IAuthRepository {
  constructor(private userRepository: IUserRepository) {}
  
  async findUserByEmail(email: string): Promise<IUser | null> {
    return this.userRepository.findUserByEmail(email);
  }
}
```

### ✅ **NEW Development Guidelines**

**DO:**
- Define interface contracts before implementation
- Use dependency injection through constructor parameters
- Create factory classes for clean instantiation
- Support ClientSession in all repository methods
- Follow established naming conventions (I{Entity}Repository)
- Document all public methods with JSDoc
- Export interfaces from entity index.ts files
- Use composition over inheritance
- Test with mocked dependencies

**DON'T:**
- Use inheritance between repositories (extends BaseRepository)
- Create direct instances without factories
- Ignore interface contracts
- Write repositories without dependency injection
- Break session chains in delegated calls
- Mix business logic with data persistence logic
- Create circular dependencies between entities
- Forget to export interfaces for consumption by other modules

### 🧪 **NEW Testing Patterns**

#### Repository Testing with Mocks
```typescript
describe('UserRepository', () => {
  let repository: IUserRepository;
  let mockBaseRepository: jest.Mocked<IBaseRepository<IUser>>;
  
  beforeEach(() => {
    mockBaseRepository = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      // ... other methods
    } as jest.Mocked<IBaseRepository<IUser>>;
    
    repository = new UserRepository(mockBaseRepository);
  });
  
  it('should create user using injected base repository', async () => {
    const userData = { name: 'Test', email: 'test@example.com' };
    const expectedUser = { ...userData, _id: 'user-id' } as IUser;
    
    mockBaseRepository.create.mockResolvedValue(expectedUser);
    
    const result = await repository.createUser(userData);
    
    expect(mockBaseRepository.create).toHaveBeenCalledWith(userData, {});
    expect(result).toEqual(expectedUser);
  });
});
```

#### Factory Testing
```typescript
describe('UserRepositoryFactory', () => {
  it('should create repository with proper dependencies', () => {
    const repository = UserRepositoryFactory.createUserRepository();
    
    expect(repository).toBeInstanceOf(UserRepository);
    // Repository should work without mocking
  });
  
  it('should create repository for testing with mocks', () => {
    const mockBaseRepository = {} as IBaseRepository<IUser>;
    const repository = UserRepositoryFactory.createUserRepositoryForTesting(mockBaseRepository);
    
    expect(repository).toBeInstanceOf(UserRepository);
  });
});
```

## Testing Patterns

### Entity Validation Testing
```typescript
describe('EntityNameValidations', () => {
  it('should validate creation data', () => {
    const validData = {
      field1: 'Valid Name',
      field2: 'test@example.com'
    };
    
    expect(() => EntityNameValidations.validateCreate(validData)).not.toThrow();
  });
  
  it('should reject invalid data', () => {
    const invalidData = {
      field1: '', // Too short
      field2: 'invalid-email'
    };
    
    expect(() => EntityNameValidations.validateCreate(invalidData)).toThrow();
  });
});
```

### Repository Testing
```typescript
describe('EntityNameRepository', () => {
  let repository: EntityNameRepository;
  
  beforeEach(() => {
    repository = new EntityNameRepository();
  });
  
  it('should create entity successfully', async () => {
    const entityData = {
      field1: 'Test Name',
      field2: 'test@example.com'
    };
    
    const entity = await repository.createEntity(entityData);
    expect(entity.field1).toBe('Test Name');
    expect(entity.field2).toBe('test@example.com');
  });
});
```

## Integration with Modules

Entities are used by modules through **dependency injection factories**. Module repositories now use composition:

```typescript
// src/modules/auth/repository/auth.repository.ts
import type { IUserRepository } from '../../../entities/user/index.js';
import type { IAuthRepository } from './auth.repository.js';

export class AuthRepository implements IAuthRepository {
  constructor(private userRepository: IUserRepository) {}
  
  // Delegates to injected UserRepository instead of inheriting
  async findByEmailForAuth(email: string): Promise<IUser | null> {
    return this.userRepository.findUserByEmail(email);
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

**Benefits of New Integration Pattern:**
- ✅ **Loose coupling** - modules depend on interfaces, not implementations
- ✅ **Easy testing** - inject mocks at module level
- ✅ **Flexible** - swap entity implementations without changing modules
- ✅ **Clear dependencies** - explicit dependency chain through factories

## Migration and Evolution

When evolving entities with the new architecture:

1. **Schema Changes**: Update interface, validation schema, and Mongoose schema
2. **Interface Updates**: Update repository interfaces and implementations
3. **Factory Updates**: Ensure factories create repositories with new dependencies
4. **Testing**: Update tests to use new mocking patterns
5. **Module Integration**: Update module factories to use new entity factories
6. **Migration Scripts**: Create database migration scripts for schema changes
7. **Backward Compatibility**: Ensure changes don't break existing module integrations
8. **Version Control**: Document breaking changes in commit messages

### Example Migration Checklist:
- [ ] Update entity interface (`IEntityName`)
- [ ] Update repository interface (`IEntityNameRepository`)  
- [ ] Update repository implementation
- [ ] Update factory for dependency injection
- [ ] Update entity exports (include new interface)
- [ ] Update tests to use mocked dependencies
- [ ] Update module factories that depend on this entity
- [ ] Run TypeScript compilation to catch interface mismatches
- [ ] Update documentation

---

**For more information:**
- Dependency Injection Interfaces: `src/infraestructure/mongo/interfaces.ts`
- Base Repository: `src/infraestructure/mongo/README.md`
- Module Integration: `src/modules/README.md`
- Global Validators: `src/lib/validators/README.md`
- DI Usage Examples: `src/examples/dependency-injection-usage.md`