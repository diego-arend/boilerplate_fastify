# Enterprise MongoDB Infrastructure

This infrastructure module provides a **robust, scalable, and production-ready MongoDB integration** for the Fastify application with comprehensive connection management, repository pattern implementation, and enterprise-grade features.

## 🏗️ **System Architecture**

The MongoDB infrastructure is designed for **high performance, type safety, and maintainability**:

- **Singleton Connection Manager**: Efficient connection pooling and lifecycle management
- **Generic Repository Pattern**: Type-safe CRUD operations with advanced querying
- **Entity-Based Design**: Strongly-typed models with validation and security
- **Health Monitoring**: Built-in connection monitoring and logging
- **Docker Integration**: Seamless container deployment with persistence
- **Production Optimizations**: Connection pooling, timeouts, and error handling

## 🎯 **Core Components**

### 📦 **MongoConnection** (`connection.ts`) - **CONNECTION MANAGEMENT**
Singleton pattern for MongoDB connection lifecycle with comprehensive monitoring:
- **Connection Pooling**: Optimized pool size (max 10 connections)
- **Timeout Management**: Server selection (5s) and socket (45s) timeouts
- **Health Monitoring**: Real-time connection status and logging
- **Environment Parsing**: Automatic host/database extraction from URI
- **Graceful Shutdown**: Clean disconnection with proper cleanup

### 🗃️ **BaseRepository** (`baseRepository.ts`) - **DATA ACCESS LAYER**
Generic repository providing type-safe CRUD operations:
- **Full CRUD Operations**: Create, Read, Update, Delete with TypeScript safety
- **Advanced Querying**: Complex filters, sorting, and pagination
- **Batch Operations**: Efficient bulk processing capabilities
- **Count Operations**: Optimized document counting
- **Pagination Support**: Built-in offset/limit with metadata

## 📁 **File Structure**

```
src/infraestructure/mongo/
├── README.md                    # This comprehensive guide
├── index.ts                     # Module exports and public API
├── connection.ts                # 🔌 MongoDB connection manager
└── baseRepository.ts            # 🗃️ Generic repository pattern
```

---

## 🚀 **Quick Start**

### **1. Environment Configuration**

Set up your MongoDB connection in `.env`:

```bash
# MongoDB Configuration
MONGO_URI=mongodb://admin:password@mongodb:27017/boilerplate?authSource=admin

# Alternative configurations:
# Local development
MONGO_URI=mongodb://localhost:27017/boilerplate_dev

# MongoDB Atlas (Cloud)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/boilerplate?retryWrites=true&w=majority

# Replica Set
MONGO_URI=mongodb://user:pass@host1:27017,host2:27017,host3:27017/boilerplate?replicaSet=rs0
```

### **2. Initialize Connection**

```typescript
import { MongoConnection } from '../infraestructure/mongo/index.js';
import { defaultLogger } from '../lib/logger/index.js';

// Initialize MongoDB connection
const mongoConnection = MongoConnection.getInstance();

// Connect during application startup
try {
  await mongoConnection.connect();
  logger.info('✅ MongoDB connected successfully');
} catch (error) {
  logger.error('❌ MongoDB connection failed:', error);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await mongoConnection.disconnect();
  logger.info('🔌 MongoDB disconnected gracefully');
  process.exit(0);
});
```

### **3. Create Entity Model**

```typescript
import { Schema, model, Document } from 'mongoose';

// TypeScript interface
export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose schema with validation
const productSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
    index: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    validate: {
      validator: function(v: number) {
        return Number.isFinite(v) && v >= 0;
      },
      message: 'Price must be a valid positive number'
    }
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['electronics', 'clothing', 'books', 'home', 'sports'],
      message: 'Category must be one of: electronics, clothing, books, home, sports'
    },
    index: true
  },
  inStock: {
    type: Boolean,
    default: true,
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  versionKey: false,
  strict: true
});

// Compound indexes for complex queries
productSchema.index({ category: 1, inStock: 1 });
productSchema.index({ price: 1, category: 1 });
productSchema.index({ name: 'text', description: 'text' }); // Text search

export const ProductModel = model<IProduct>('Product', productSchema);
```

### **4. Implement Repository**

```typescript
import { Model } from 'mongoose';
import { BaseRepository } from '../infraestructure/mongo/baseRepository.js';
import { ProductModel, type IProduct } from '../entities/product/productEntity.js';

export class ProductRepository extends BaseRepository<IProduct> {
  constructor() {
    super(ProductModel as Model<IProduct>);
  }

  /**
   * Find products by category with stock filtering
   */
  async findByCategory(category: string, inStockOnly: boolean = true): Promise<IProduct[]> {
    const filter: any = { category };
    if (inStockOnly) {
      filter.inStock = true;
    }
    
    return await this.find(filter);
  }

  /**
   * Search products by text in name and description
   */
  async searchProducts(query: string): Promise<IProduct[]> {
    return await this.model
      .find({
        $text: { $search: query }
      })
      .sort({ score: { $meta: 'textScore' } })
      .exec();
  }

  /**
   * Find products in price range
   */
  async findByPriceRange(minPrice: number, maxPrice: number): Promise<IProduct[]> {
    return await this.find({
      price: { $gte: minPrice, $lte: maxPrice }
    });
  }

  /**
   * Get products with pagination and filters
   */
  async findProductsPaginated(filters: {
    category?: string;
    inStock?: boolean;
    minPrice?: number;
    maxPrice?: number;
  }, page: number = 1, limit: number = 20) {
    const query: any = {};
    
    if (filters.category) query.category = filters.category;
    if (typeof filters.inStock === 'boolean') query.inStock = filters.inStock;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }

    return await this.findPaginated(
      query,
      page,
      limit,
      { createdAt: -1 } // Sort by newest first
    );
  }

  /**
   * Update stock status for multiple products
   */
  async updateStockBatch(productIds: string[], inStock: boolean): Promise<number> {
    const result = await this.model.updateMany(
      { _id: { $in: productIds } },
      { $set: { inStock, updatedAt: new Date() } }
    ).exec();

    return result.modifiedCount;
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<Array<{ category: string; count: number; avgPrice: number }>> {
    return await this.model.aggregate([
      { $match: { inStock: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          avgPrice: { $round: ['$avgPrice', 2] },
          minPrice: 1,
          maxPrice: 1,
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]).exec();
  }
}
```

---

## 🔧 **Advanced Repository Features**

### **Generic CRUD Operations**

```typescript
// Create single document
const product = await productRepository.create({
  name: 'Wireless Headphones',
  description: 'High-quality wireless headphones with noise cancellation',
  price: 199.99,
  category: 'electronics',
  tags: ['audio', 'wireless', 'noise-cancelling']
});

// Find by ID
const productById = await productRepository.findById(product._id);

// Find with complex filters
const electronicsProducts = await productRepository.find({
  category: 'electronics',
  price: { $gte: 100, $lte: 500 },
  inStock: true
});

// Update with optimistic locking
const updatedProduct = await productRepository.updateById(product._id, {
  price: 179.99,
  updatedAt: new Date()
});

// Delete operations
const deleted = await productRepository.deleteById(product._id);
console.log(`Product deleted: ${deleted}`); // true/false

// Count with filters
const electronicCount = await productRepository.count({
  category: 'electronics',
  inStock: true
});
```

### **Advanced Pagination**

```typescript
// Paginated results with comprehensive metadata
const paginatedProducts = await productRepository.findPaginated(
  { category: 'electronics', inStock: true }, // Filter
  2,    // Page number
  10,   // Items per page
  { price: -1, createdAt: -1 }  // Sort: price desc, then newest first
);

console.log({
  products: paginatedProducts.data,
  pagination: {
    currentPage: paginatedProducts.page,          // 2
    totalPages: paginatedProducts.totalPages,     // 15
    totalItems: paginatedProducts.total,          // 147
    itemsPerPage: paginatedProducts.limit,        // 10
    hasNextPage: paginatedProducts.hasNext,       // true
    hasPreviousPage: paginatedProducts.hasPrev    // true
  }
});

// Client-side pagination component data
const paginationData = {
  currentPage: paginatedProducts.page,
  totalPages: paginatedProducts.totalPages,
  pages: Array.from({ length: paginatedProducts.totalPages }, (_, i) => i + 1),
  showPrevious: paginatedProducts.hasPrev,
  showNext: paginatedProducts.hasNext,
  startItem: (paginatedProducts.page - 1) * paginatedProducts.limit + 1,
  endItem: Math.min(paginatedProducts.page * paginatedProducts.limit, paginatedProducts.total)
};
```

---

## 📊 **Connection Management**

### **Connection Health Monitoring**

```typescript
// Monitor connection status
const mongoConnection = MongoConnection.getInstance();
const connection = mongoConnection.getConnection();

// Connection states
console.log({
  state: connection.readyState,
  // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  host: connection.host,
  port: connection.port,
  name: connection.name,
  collections: Object.keys(connection.collections)
});

// Connection events
connection.on('connected', () => {
  console.log('🟢 MongoDB connected');
});

connection.on('error', (err) => {
  console.error('🔴 MongoDB error:', err);
});

connection.on('disconnected', () => {
  console.log('🟡 MongoDB disconnected');
});

connection.on('reconnected', () => {
  console.log('🟢 MongoDB reconnected');
});
```

### **Connection Pool Configuration**

```typescript
// Advanced connection options
await mongoose.connect(config.MONGO_URI, {
  // Connection pool settings
  maxPoolSize: 10,              // Maximum connections
  minPoolSize: 2,               // Minimum connections maintained
  maxIdleTimeMS: 30000,         // Close idle connections after 30s
  serverSelectionTimeoutMS: 5000, // Server selection timeout
  socketTimeoutMS: 45000,       // Socket timeout
  
  // Buffering settings
  bufferCommands: false,        // Disable command buffering
  bufferMaxEntries: 0,          // Disable buffer max entries
  
  // Write concern
  writeConcern: {
    w: 'majority',              // Wait for majority acknowledgment
    j: true,                    // Wait for journal
    wtimeout: 5000              // Timeout for write concern
  },
  
  // Read preference
  readPreference: 'primary',    // Read from primary replica
  
  // Compression
  compressors: ['zlib'],        // Enable compression
  
  // SSL/TLS (for production)
  ssl: process.env.NODE_ENV === 'production',
  sslValidate: process.env.NODE_ENV === 'production'
});
```

---

## 🐳 **Docker Integration**

### **Docker Compose Configuration**

```yaml
# docker-compose.yml - MongoDB service
mongodb:
  image: mongo:7.0
  container_name: boilerplate_mongodb
  restart: unless-stopped
  ports:
    - "27017:27017"
  environment:
    MONGO_INITDB_ROOT_USERNAME: admin
    MONGO_INITDB_ROOT_PASSWORD: password
    MONGO_INITDB_DATABASE: boilerplate
  volumes:
    - mongodb_data:/data/db              # Data persistence
    - ./docker/mongo-init:/docker-entrypoint-initdb.d  # Initialization scripts
  networks:
    - boilerplate_network
  healthcheck:
    test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s
  command: ["mongod", "--bind_ip_all", "--replSet", "rs0"]

volumes:
  mongodb_data:
    driver: local
```

### **Production Optimizations**

```yaml
# Production MongoDB configuration
mongodb:
  image: mongo:7.0
  restart: unless-stopped
  environment:
    MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
    MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    MONGO_INITDB_DATABASE: ${MONGO_DATABASE}
  volumes:
    - mongodb_data:/data/db
    - mongodb_config:/data/configdb
    - ./docker/mongo/mongod.conf:/etc/mongod.conf
  command: ["mongod", "--config", "/etc/mongod.conf"]
  deploy:
    resources:
      limits:
        memory: 2G
        cpus: '1.0'
      reservations:
        memory: 1G
        cpus: '0.5'
  logging:
    driver: "json-file"
    options:
      max-size: "100m"
      max-file: "5"
```

---

## 📈 **Performance Optimization**

### **Indexing Strategy**

```typescript
// Strategic index creation
const userSchema = new Schema<IUser>({
  email: { 
    type: String, 
    unique: true,     // Automatic index creation
    index: true       // Explicit index (redundant but clear)
  },
  status: { 
    type: String, 
    index: true       // Query optimization for status filters
  }
}, {
  timestamps: true    // Automatic createdAt/updatedAt indexes
});

// Compound indexes for complex queries
userSchema.index({ status: 1, createdAt: -1 });  // Status + time queries
userSchema.index({ email: 1, status: 1 });       // Login validation
userSchema.index({ role: 1, status: 1 });        // Admin queries

// Text search indexes
userSchema.index({ 
  name: 'text', 
  email: 'text' 
}, {
  weights: { name: 10, email: 5 }  // Name is more important than email
});

// Sparse indexes (only for documents with the field)
userSchema.index({ lastLoginAt: -1 }, { sparse: true });
```

### **Query Optimization**

```typescript
// Efficient querying patterns
class OptimizedRepository extends BaseRepository<IUser> {
  
  /**
   * Use lean() for read-only operations (50% faster)
   */
  async findActiveUsersLean(): Promise<any[]> {
    return await this.model
      .find({ status: 'active' })
      .lean()  // Returns plain JavaScript objects (faster)
      .select('name email createdAt')  // Only required fields
      .exec();
  }

  /**
   * Use aggregation for complex data processing
   */
  async getUserStatsByRole(): Promise<any[]> {
    return await this.model.aggregate([
      { $match: { status: 'active' } },
      { 
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          avgAccountAge: { 
            $avg: { 
              $divide: [
                { $subtract: [new Date(), '$createdAt'] },
                1000 * 60 * 60 * 24  // Convert to days
              ]
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ]).exec();
  }

  /**
   * Batch operations for efficiency
   */
  async updateMultipleUsers(userIds: string[], updateData: any): Promise<number> {
    const result = await this.model.updateMany(
      { _id: { $in: userIds } },
      { $set: { ...updateData, updatedAt: new Date() } }
    ).exec();
    
    return result.modifiedCount;
  }
}
```

---

## 🛡️ **Security & Validation**

### **Input Sanitization**

```typescript
// Built-in security features in entities
const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        // Prevent XSS attacks
        return !/<script|javascript:|on\w+=/i.test(v);
      },
      message: 'Name contains disallowed characters'
    }
  },
  email: {
    type: String,
    required: true,
    lowercase: true,  // Automatic normalization
    trim: true,
    match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid email']
  }
});

// Pre-save sanitization hooks
userSchema.pre('save', function(next) {
  // Sanitize input data
  if (this.name) {
    this.name = this.name.replace(/[<>'"&]/g, '');
  }
  next();
});
```

### **Repository Security Layer**

```typescript
export class SecureUserRepository extends BaseRepository<IUser> {
  
  /**
   * Create user with validation and sanitization
   */
  async createSecureUser(userData: {
    name: string;
    email: string;
    password: string;
  }): Promise<IUser> {
    // Input validation using Zod
    const validatedData = SecurityValidators.validateUserRegistration(userData);
    
    // Check for existing email
    const existingUser = await this.findOne({ email: validatedData.email });
    if (existingUser) {
      throw new Error('Email already registered');
    }
    
    // Hash password before saving
    const hashedPassword = await PasswordService.hashPassword(validatedData.password);
    
    return await this.create({
      ...validatedData,
      password: hashedPassword
    });
  }

  /**
   * Safe user lookup (excludes password by default)
   */
  async findSafeById(id: string): Promise<Omit<IUser, 'password'> | null> {
    return await this.model
      .findById(id)
      .select('-password')  // Explicitly exclude password
      .exec();
  }

  /**
   * Find with authentication (includes password)
   */
  async findWithPasswordByEmail(email: string): Promise<IUser | null> {
    const sanitizedEmail = email.toLowerCase().trim();
    
    return await this.model
      .findOne({ email: sanitizedEmail })
      .select('+password')  // Include password for authentication
      .exec();
  }
}
```

---

## 🚨 **Error Handling & Monitoring**

### **Comprehensive Error Handling**

```typescript
// Connection error handling
class RobustMongoConnection extends MongoConnection {
  
  async connectWithRetry(maxRetries: number = 5): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.connect();
        this.logger.info(`✅ MongoDB connected on attempt ${attempt}`);
        return;
      } catch (error) {
        this.logger.error(
          { attempt, maxRetries, error },
          `❌ MongoDB connection failed (attempt ${attempt}/${maxRetries})`
        );
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

// Repository error handling
class SafeRepository<T extends Document> extends BaseRepository<T> {
  
  async safeCreate(data: Partial<T>): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const result = await this.create(data);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error({ data, error }, 'Failed to create document');
      
      if (error.code === 11000) {
        return { success: false, error: 'Duplicate key error' };
      }
      
      return { success: false, error: 'Database operation failed' };
    }
  }

  async safeUpdate(id: string, data: UpdateQuery<T>): Promise<{ 
    success: boolean; 
    data?: T; 
    error?: string 
  }> {
    try {
      const result = await this.updateById(id, data);
      if (!result) {
        return { success: false, error: 'Document not found' };
      }
      return { success: true, data: result };
    } catch (error) {
      this.logger.error({ id, data, error }, 'Failed to update document');
      return { success: false, error: 'Update operation failed' };
    }
  }
}
```

### **Health Check Implementation**

```typescript
// MongoDB health check for monitoring
export class MongoHealthCheck {
  private mongoConnection: MongoConnection;

  constructor() {
    this.mongoConnection = MongoConnection.getInstance();
  }

  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connection: boolean;
      responseTime: number;
      collections: number;
      indexes: number;
    };
  }> {
    const startTime = Date.now();
    
    try {
      const connection = this.mongoConnection.getConnection();
      
      // Test connection with ping
      await connection.db.admin().ping();
      
      const responseTime = Date.now() - startTime;
      const collections = await connection.db.listCollections().toArray();
      
      // Count total indexes across collections
      let totalIndexes = 0;
      for (const collection of collections) {
        const indexes = await connection.db.collection(collection.name).indexes();
        totalIndexes += indexes.length;
      }

      return {
        status: 'healthy',
        details: {
          connection: true,
          responseTime,
          collections: collections.length,
          indexes: totalIndexes
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connection: false,
          responseTime: Date.now() - startTime,
          collections: 0,
          indexes: 0
        }
      };
    }
  }
}

// Fastify health endpoint
app.get('/health/mongodb', async (request, reply) => {
  const healthCheck = new MongoHealthCheck();
  const health = await healthCheck.checkHealth();
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  
  return reply.status(statusCode).send({
    service: 'mongodb',
    status: health.status,
    timestamp: new Date().toISOString(),
    details: health.details
  });
});
```

---

---

## 🔄 **Transações Atômicas com Plugin Fastify**

O sistema implementa **transações atômicas via plugin Fastify**, seguindo os padrões nativos da arquitetura com hooks automáticos e rollback inteligente para operações críticas.

### **Por que Plugin ao invés de Decorators?**

**✅ Padrão Fastify Correto:**
- Plugins são a forma nativa do Fastify para funcionalidades transversais
- Integração natural com hooks e lifecycle do framework
- Encapsulamento adequado seguindo arquitetura de plugins

**✅ Funcionalidade Superior:**
- Session MongoDB automaticamente disponível em `request.mongoSession`
- Hooks automáticos (`onRequest`, `onResponse`, `onError`) gerenciam lifecycle
- Rollback baseado em status codes, erros ou timeouts
- Zero boilerplate nas rotas

### **Configuração do Plugin**

#### **1. Registrar o Plugin**

```typescript
import { transactionPlugin, TRANSACTION_ROUTE_CONFIG } from '../infraestructure/mongo/index.js';

// Registrar no app Fastify
await app.register(transactionPlugin, {
  // Timeout padrão para transações (ms)
  defaultTimeout: 30000,
  
  // Logging de transações
  enableLogging: true,
  
  // Rollback em erros de validação
  abortOnValidationError: true,
  
  // Rotas com transações automáticas
  autoTransactionRoutes: [
    '/api/users',
    '/api/orders',
    /^\/api\/transactions/  // Regex também suportado
  ],
  
  // Opções padrão para transações
  defaultOptions: {
    maxTimeMS: 25000
  }
});
```

#### **2. Configuração de Rota Específica**

```typescript
// Rota com transação explícita
app.post('/api/transfer', {
  schema: {
    body: {
      type: 'object',
      required: ['fromAccount', 'toAccount', 'amount'],
      properties: {
        fromAccount: { type: 'string' },
        toAccount: { type: 'string' },
        amount: { type: 'number', minimum: 0 }
      }
    }
  },
  // Configuração de transação para esta rota
  config: {
    [TRANSACTION_ROUTE_CONFIG]: {
      enabled: true,
      rollbackOnError: true,
      rollbackOnStatusCode: [400, 422, 500],
      options: {
        maxTimeMS: 15000
      }
    }
  }
}, async (request, reply) => {
  const { fromAccount, toAccount, amount } = request.body as any;
  
  // Session automaticamente disponível
  const session = request.mongoSession;
  
  if (!session) {
    return reply.status(500).send({ error: 'Transaction not available' });
  }

  // Usar session nas operações do banco
  await accountRepo.updateOne(
    { id: fromAccount }, 
    { $inc: { balance: -amount } }, 
    { session }
  );
  
  await accountRepo.updateOne(
    { id: toAccount }, 
    { $inc: { balance: amount } }, 
    { session }
  );
  
  // Se tudo der certo → commit automático
  // Se erro → rollback automático
  return reply.send({ 
    success: true, 
    transactionId: request.transactionId 
  });
});
```

#### **3. Transações Automáticas**

```typescript
// Esta rota usa transação automaticamente (configurada em autoTransactionRoutes)
app.post('/api/orders', {
  schema: {
    body: {
      type: 'object',
      required: ['items', 'customerId'],
      properties: {
        items: { type: 'array' },
        customerId: { type: 'string' }
      }
    }
  }
}, async (request, reply) => {
  // Session disponível automaticamente devido à configuração
  const session = request.mongoSession;
  const { items, customerId } = request.body as any;
  
  // Usar session em todas as operações
  const order = await orderRepo.create({ items, customerId }, { session });
  await inventoryRepo.updateStock(items, { session });
  
  return reply.status(201).send({ 
    orderId: order.id,
    transactionId: request.transactionId 
  });
});
```

### **Configurações Avançadas**

#### **Opções do Plugin**

```typescript
interface TransactionPluginOptions {
  // Timeout padrão (ms)
  defaultTimeout?: number; // default: 30000
  
  // Logging estruturado
  enableLogging?: boolean; // default: true
  
  // Configurações padrão de transação
  defaultOptions?: {
    maxTimeMS?: number;
    readConcern?: ReadConcern;
    writeConcern?: WriteConcern;
    readPreference?: ReadPreference;
  };
  
  // Rotas com transações automáticas
  autoTransactionRoutes?: string[] | RegExp[];
  
  // Rollback em erros de validação
  abortOnValidationError?: boolean; // default: true
}
```

#### **Configuração por Rota**

```typescript
interface RouteTransactionConfig {
  enabled: boolean;
  rollbackOnError?: boolean;
  rollbackOnStatusCode?: number[]; // default: [400,401,403,404,422,500,502,503]
  options?: {
    maxTimeMS?: number;
    readConcern?: ReadConcern;
    writeConcern?: WriteConcern;
  };
}
```

### **Tratamento de Erros e Rollback**

#### **Rollback Automático**

O plugin faz rollback automaticamente em:
- ✅ **Exceções não tratadas** no handler
- ✅ **Status codes de erro** (configuráveis por rota)
- ✅ **Erros de validação** (se `abortOnValidationError: true`)
- ✅ **Timeouts de transação**

```typescript
app.post('/api/complex-operation', {
  config: {
    [TRANSACTION_ROUTE_CONFIG]: {
      enabled: true,
      rollbackOnStatusCode: [400, 422] // Rollback personalizado
    }
  }
}, async (request, reply) => {
  const session = request.mongoSession;
  
  try {
    // Operações que podem falhar
    const user = await userRepo.create(userData, { session });
    const profile = await profileRepo.create(profileData, { session });
    
    // Validação de negócio
    if (!isValidUser(user)) {
      // Status 400 → transação será revertida automaticamente
      return reply.status(400).send({ error: 'Invalid user data' });
    }
    
    return reply.send({ success: true, userId: user.id });
    
  } catch (error) {
    // Erro será logado e transação revertida automaticamente
    app.log.error({ error, transactionId: request.transactionId });
    return reply.status(500).send({ error: 'Operation failed' });
  }
});
```

### **Monitoramento e Observabilidade**

#### **Headers Automáticos**

```typescript
// Cada response com transação inclui:
'X-Transaction-ID': 'txn_1640995200000_abc123'
```

#### **Logs Estruturados**

```json
{
  "transactionId": "txn_1640995200000_abc123",
  "method": "POST",
  "url": "/api/transfer",
  "statusCode": 200,
  "duration": 150,
  "level": "info",
  "msg": "Transaction committed successfully"
}
```

#### **API de Estatísticas**

```typescript
import { TransactionManager } from '../infraestructure/mongo/index.js';

const transactionManager = TransactionManager.getInstance();

// Transações ativas
const activeTransactions = transactionManager.getActiveTransactions();

// Transação específica
const transaction = transactionManager.getTransaction(transactionId);

// Endpoint de health check
app.get('/health/transactions', async (request, reply) => {
  const active = transactionManager.getActiveTransactions();
  const longRunning = active.filter(t => 
    Date.now() - t.startTime.getTime() > 30000
  );

  return reply.send({
    status: longRunning.length > 5 ? 'warning' : 'healthy',
    activeTransactions: active.length,
    longRunningTransactions: longRunning.length
  });
});
```

### **Integração com BaseRepository**

Todos os métodos do `BaseRepository` suportam sessões automaticamente:

```typescript
// Session é passada automaticamente quando disponível
await userRepo.create(userData, { session: request.mongoSession });
await userRepo.updateOne({ id }, updateData, { session: request.mongoSession });
await userRepo.findMany({ active: true }, { session: request.mongoSession });
await userRepo.deleteOne({ id }, { session: request.mongoSession });
```

### **Uso Programático (Alternativo)**

Para casos específicos onde você precisa de controle manual:

```typescript
import { withTransaction, TransactionManager } from '../infraestructure/mongo/index.js';

// Método 1: Utility function
const result = await withTransaction(async (session) => {
  await userRepo.create(userData, { session });
  await profileRepo.create(profileData, { session });
  return { userId: user.id };
});

// Método 2: TransactionManager direto
const transactionManager = TransactionManager.getInstance();
const session = await transactionManager.startTransaction();

try {
  await userRepo.create(userData, { session });
  await profileRepo.create(profileData, { session });
  await transactionManager.commitTransaction(session);
} catch (error) {
  await transactionManager.rollbackTransaction(session);
  throw error;
}
```

### **Melhores Práticas**

#### **✅ Recomendações**

1. **Use plugin para rotas** - Aproveite a integração nativa com Fastify
2. **Configure rollback por status** - Customize comportamento por rota
3. **Mantenha transações curtas** - Evite operações longas
4. **Use logs estruturados** - Para debugging e monitoramento
5. **Configure timeouts adequados** - Baseado na complexidade

```typescript
// ✅ Boa prática - Transação focada
app.post('/api/transfer', {
  config: {
    [TRANSACTION_ROUTE_CONFIG]: {
      enabled: true,
      options: { maxTimeMS: 15000 } // Timeout apropriado
    }
  }
}, async (request, reply) => {
  const session = request.mongoSession;
  
  // Validação rápida
  if (amount <= 0) {
    return reply.status(400).send({ error: 'Invalid amount' });
  }
  
  // Operações atômicas focadas
  await accountRepo.debit(fromAccount, amount, { session });
  await accountRepo.credit(toAccount, amount, { session });
  
  return reply.send({ success: true });
});
```

#### **❌ Evitar**

1. **Não use transações para operações simples** - Overhead desnecessário
2. **Não crie transações muito longas** - Causa problemas de performance
3. **Não ignore erros de transação** - Sempre trate adequadamente

```typescript
// ❌ Ruim - Operação simples não precisa de transação
app.get('/api/users/:id', {
  config: { [TRANSACTION_ROUTE_CONFIG]: { enabled: true } }
}, async (request, reply) => {
  return await userRepo.findById(request.params.id);
});

// ✅ Bom - Operação simples sem transação
app.get('/api/users/:id', async (request, reply) => {
  return await userRepo.findById(request.params.id);
});
```

### **Requisitos de Sistema**

⚠️ **Importante**: MongoDB transações requerem:
- **Replica Set** ou **Sharded Cluster**
- **MongoDB 4.0+** para replica sets
- **MongoDB 4.2+** para sharded clusters

Para **desenvolvimento**, use a configuração Docker fornecida que automaticamente configura um replica set.

**Com este sistema de transações via plugin, sua aplicação Fastify mantém integridade de dados seguindo os padrões nativos da arquitetura, com zero boilerplate e máxima confiabilidade.** 🔄✨

---
## ✅ **Best Practices**

### **Repository Design Patterns**

```typescript
// 1. Single Responsibility: One repository per entity
class UserRepository extends BaseRepository<IUser> {
  // User-specific operations only
}

class ProductRepository extends BaseRepository<IProduct> {
  // Product-specific operations only
}

// 2. Interface Segregation: Define specific interfaces
interface IUserRepository {
  findByEmail(email: string): Promise<IUser | null>;
  createUser(userData: CreateUserDto): Promise<IUser>;
  updateLastLogin(userId: string): Promise<void>;
}

// 3. Dependency Injection: Use interfaces, not concrete classes
class UserService {
  constructor(private userRepository: IUserRepository) {}
}

// 4. Error Boundaries: Handle errors at repository level
class UserRepository extends BaseRepository<IUser> implements IUserRepository {
  async findByEmail(email: string): Promise<IUser | null> {
    try {
      return await this.findOne({ email: email.toLowerCase() });
    } catch (error) {
      this.logger.error({ email, error }, 'Failed to find user by email');
      throw new DatabaseError('User lookup failed');
    }
  }
}
```

### **Performance Guidelines**

```typescript
// DO: Use lean() for read-only operations
const users = await userRepository.model.find({ status: 'active' }).lean();

// DO: Select only required fields
const userNames = await userRepository.model.find({}, 'name email').lean();

// DO: Use aggregation for complex operations
const stats = await userRepository.model.aggregate([
  { $match: { status: 'active' } },
  { $group: { _id: '$role', count: { $sum: 1 } } }
]);

// DON'T: Load unnecessary data
const users = await userRepository.find({}); // Loads all fields

// DON'T: Use individual queries in loops
for (const userId of userIds) {
  await userRepository.findById(userId); // N+1 problem
}

// DO: Use batch operations
const users = await userRepository.model.find({
  _id: { $in: userIds }
}).lean();
```

---

## 📋 **Migration & Maintenance**

### **Schema Migration Example**

```typescript
// migrations/001_add_user_preferences.ts
export async function up() {
  const db = mongoose.connection.db;
  
  // Add new field to existing documents
  await db.collection('users').updateMany(
    { preferences: { $exists: false } },
    { 
      $set: { 
        preferences: {
          emailNotifications: true,
          theme: 'light',
          language: 'en'
        }
      } 
    }
  );
  
  console.log('✅ Added preferences field to all users');
}

export async function down() {
  const db = mongoose.connection.db;
  
  // Remove field
  await db.collection('users').updateMany(
    {},
    { $unset: { preferences: 1 } }
  );
  
  console.log('✅ Removed preferences field from all users');
}
```

### **Database Maintenance Tasks**

```typescript
// Database maintenance utilities
export class MongoMaintenance {
  
  /**
   * Optimize collections by rebuilding indexes
   */
  async optimizeCollections(): Promise<void> {
    const connection = mongoose.connection;
    const collections = await connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      await connection.db.collection(collection.name).reIndex();
      console.log(`✅ Optimized indexes for ${collection.name}`);
    }
  }

  /**
   * Clean up old documents based on TTL
   */
  async cleanupOldDocuments(collectionName: string, field: string, daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await mongoose.connection.db.collection(collectionName).deleteMany({
      [field]: { $lt: cutoffDate }
    });
    
    console.log(`🗑️ Cleaned up ${result.deletedCount} old documents from ${collectionName}`);
    return result.deletedCount;
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<any> {
    const db = mongoose.connection.db;
    const stats = await db.stats();
    
    return {
      database: db.databaseName,
      collections: stats.collections,
      documents: stats.objects,
      indexes: stats.indexes,
      dataSize: `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`,
      indexSize: `${(stats.indexSize / 1024 / 1024).toFixed(2)} MB`,
      storageSize: `${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`
    };
  }
}
```

---

## 🤝 **Integration Examples**

### **Fastify Plugin Integration**

```typescript
// plugins/mongodb.plugin.ts
import fp from 'fastify-plugin';
import { MongoConnection } from '../infraestructure/mongo/index.js';

export default fp(async function (fastify, opts) {
  const mongoConnection = MongoConnection.getInstance();
  
  // Connect on plugin registration
  await mongoConnection.connect();
  
  // Decorate Fastify instance
  fastify.decorate('mongo', mongoConnection);
  
  // Add hooks for graceful shutdown
  fastify.addHook('onClose', async () => {
    await mongoConnection.disconnect();
  });
});

// Usage in routes
app.get('/users/:id', async (request, reply) => {
  const userRepository = new UserRepository();
  const user = await userRepository.findById(request.params.id);
  
  if (!user) {
    return reply.status(404).send({ error: 'User not found' });
  }
  
  return reply.send(user);
});
```

### **Service Layer Integration**

```typescript
// services/user.service.ts
export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async createUser(userData: CreateUserDto): Promise<{
    success: boolean;
    user?: IUser;
    error?: string;
  }> {
    try {
      // Business logic validation
      await this.validateUserData(userData);
      
      // Create user through repository
      const user = await this.userRepository.createUser(userData);
      
      // Post-creation business logic (send welcome email, etc.)
      await this.onUserCreated(user);
      
      return { success: true, user };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Failed to create user' 
      };
    }
  }

  private async validateUserData(userData: CreateUserDto): Promise<void> {
    // Custom business validation
    if (await this.userRepository.emailExists(userData.email)) {
      throw new Error('Email already in use');
    }
  }

  private async onUserCreated(user: IUser): Promise<void> {
    // Send welcome email, create profile, etc.
    console.log(`👋 Welcome ${user.name}! Account created successfully.`);
  }
}
```

**This enterprise-grade MongoDB infrastructure provides the scalability, reliability, and maintainability required for production applications.** 🚀

---

## 📚 **Additional Resources**

- [MongoDB Official Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [MongoDB Performance Best Practices](https://docs.mongodb.com/manual/administration/production-notes/)
- [Docker MongoDB Configuration](https://hub.docker.com/_/mongo)