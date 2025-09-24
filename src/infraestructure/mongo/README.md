# MongoDB Infrastructure Documentation

This infrastructure module provides a **robust, scalable, and production-ready MongoDB integration** for the Fastify application with comprehensive connection management and generic repository pattern implementation using **dependency injection**.

**Focus:** This documentation covers the MongoDB connection layer with dependency injection and BaseRepository pattern. For specific entity implementations, validation, and business logic patterns, refer to the Entity Architecture documentation.

## 🏗️ **System Architecture**

The MongoDB infrastructure is designed for **high performance, type safety, maintainability, and testability** using dependency injection:

- **Dependency Injection Connection Manager**: Injectable connection management replacing singleton pattern
- **Generic Repository Pattern**: Type-safe CRUD operations with injected dependencies
- **Transaction Support**: Atomic operations with session management via DI
- **Health Monitoring**: Built-in connection monitoring and logging
- **Docker Integration**: Seamless container deployment with persistence
- **Production Optimizations**: Connection pooling, timeouts, and error handling

## 🎯 **Core Components**

### 📦 **IMongoConnectionManager Interface** (`connectionManager.interface.ts`) - **CONNECTION CONTRACT**

Interface for MongoDB connection management with dependency injection support:

- **Connection Management**: Connect, disconnect, and health monitoring methods
- **Dependency Injection**: Injectable interface for testability and flexibility
- **Type Safety**: Strong typing for connection operations
- **Health Monitoring**: Built-in connection status and health information

### 🔧 **MongoConnectionManager** (`connectionManager.ts`) - **CONNECTION IMPLEMENTATION**

Injectable connection manager implementation:

- **Connection Pooling**: Optimized pool size (max 10 connections)
- **Timeout Management**: Server selection (5s) and socket (45s) timeouts
- **Health Monitoring**: Real-time connection status and logging
- **Environment Parsing**: Automatic host/database extraction from URI
- **Graceful Shutdown**: Clean disconnection with proper cleanup

### 🏭 **MongoConnectionManagerFactory** (`connectionManager.factory.ts`) - **FACTORY PATTERN**

Factory for creating connection manager instances with dependency injection:

- **Factory Pattern**: Clean instantiation of connection managers
- **Configuration Injection**: Automatic configuration from environment
- **Testing Support**: Easy mock injection for testing scenarios
- **Logger Integration**: Automatic logger configuration

### 🗃️ **BaseRepository** (`baseRepository.ts`) - **DATA ACCESS LAYER**

Updated repository with connection dependency injection:

- **Full CRUD Operations**: Create, Read, Update, Delete with TypeScript safety
- **Connection Injection**: Injectable connection manager for flexibility
- **Advanced Querying**: Complex filters, sorting, and pagination
- **Transaction Support**: Session-based operations for atomic transactions
- **Health Validation**: Connection health checks before operations

### 🔄 **ITransactionManager Interface** (`transactionManager.interface.ts`) - **TRANSACTION CONTRACT**

Interface for transaction management with dependency injection:

- **Transaction Lifecycle**: Start, commit, rollback operations
- **Batch Operations**: Multiple operations in single transaction
- **Monitoring**: Active transaction tracking and statistics
- **Dependency Injection**: Injectable for testing and flexibility

### ⚙️ **TransactionManager** (`transactionManager.ts`) - **TRANSACTION IMPLEMENTATION**

Injectable transaction manager implementation:

- **Session Management**: MongoDB session lifecycle with proper cleanup
- **Error Handling**: Comprehensive error handling and rollback
- **Monitoring**: Transaction statistics and active transaction tracking
- **Timeout Management**: Configurable transaction timeouts

## 📁 **File Structure**

```
src/infraestructure/mongo/
├── README.md                           # This comprehensive guide
├── index.ts                           # Module exports and public API
├── connectionManager.interface.ts     # 🔌 Connection manager interface (DI)
├── connectionManager.ts               # 🔌 Injectable connection manager
├── connectionManager.factory.ts       # 🏭 Connection manager factory
├── baseRepository.ts                  # 🗃️ Generic repository with DI support
├── transactionManager.interface.ts    # ⚙️ Transaction manager interface (DI)
├── transactionManager.ts              # ⚙️ Injectable transaction manager
├── transactionManager.factory.ts      # 🏭 Transaction manager factory
├── transaction.utils.ts               # 🛠️ Transaction utility functions
├── mongodb.plugin.ts                  # 🔌 Fastify plugin for MongoDB with DI
├── transaction.plugin.ts              # 🔄 Fastify transaction plugin
├── transaction.types.ts               # 📝 Transaction type definitions
└── interfaces.ts                      # 📝 Repository interfaces
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

### **2. Initialize Connection with Dependency Injection**

```typescript
import { MongoConnectionManagerFactory } from '../infraestructure/mongo/connectionManager.factory.js';
import { TransactionManagerFactory } from '../infraestructure/mongo/transactionManager.factory.js';

// Create connection manager instance
const connectionManager = MongoConnectionManagerFactory.create();

// Connect during application startup
try {
  await connectionManager.connect();
  console.log('✅ MongoDB connected successfully');
} catch (error) {
  console.error('❌ MongoDB connection failed:', error);
  process.exit(1);
}

// Create transaction manager with injected connection
const transactionManager = TransactionManagerFactory.create(connectionManager);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await connectionManager.disconnect();
  console.log('🔌 MongoDB disconnected gracefully');
  process.exit(0);
});
```

### **3. Using Fastify Plugin (Recommended)**

```typescript
import mongoPlugin from '../infraestructure/mongo/mongodb.plugin.js';

// Register MongoDB plugin with DI
await fastify.register(mongoPlugin, {
  // Optional custom connection string
  connectionString: process.env.MONGO_URI,

  // Skip connection for testing
  skipConnection: process.env.NODE_ENV === 'test'
});

// Access injected dependencies
const connectionManager = fastify.mongoConnectionManager;
const transactionManager = fastify.transactionManager;

// Access connection information
const connection = fastify.mongo.getConnection();
const isConnected = fastify.mongo.isConnected();
```

### **4. Implement Repository with Dependency Injection**

```typescript
import { BaseRepository } from '../infraestructure/mongo/baseRepository.js';
import { MongoConnectionManagerFactory } from '../infraestructure/mongo/connectionManager.factory.js';
import { DocumentModel, type IDocument } from '../models/documentModel.js';

// Create repository with injected connection manager
const connectionManager = MongoConnectionManagerFactory.create();
const documentRepository = new BaseRepository<IDocument>(DocumentModel, connectionManager);

// Or use factory pattern (recommended)
class DocumentRepositoryFactory {
  static create(connectionManager?: IMongoConnectionManager): DocumentRepository {
    const connManager = connectionManager || MongoConnectionManagerFactory.create();
    const baseRepository = new BaseRepository<IDocument>(DocumentModel, connManager);
    return new DocumentRepository(baseRepository);
  }
}

export class DocumentRepository {
  constructor(private baseRepository: BaseRepository<IDocument>) {}

  /**
   * Find documents by status with injected connection
   */
  async findByStatus(status: string): Promise<IDocument[]> {
    return await this.baseRepository.find({ status });
  }

  /**
   * Create document with connection validation
   */
  async createDocument(documentData: Partial<IDocument>): Promise<IDocument> {
    // Connection is validated internally by baseRepository
    return await this.baseRepository.create(documentData);
  }

  /**
   * Transaction example with injected transaction manager
   */
  async createDocumentWithTransaction(
    documentData: Partial<IDocument>,
    transactionManager: ITransactionManager
  ): Promise<IDocument> {
    const result = await transactionManager.withTransaction(async session => {
      return await this.baseRepository.create(documentData, { session });
    });

    if (!result.success) {
      throw result.error || new Error('Transaction failed');
    }

    return result.data;
  }
}
```

---

## 🔧 **Advanced Repository Features**

### **Generic CRUD Operations**

```typescript
// Generic repository usage with any document type
interface IDocument extends Document {
  title: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

class DocumentRepository extends BaseRepository<IDocument> {
  constructor(model: Model<IDocument>) {
    super(model);
  }
}

const repository = new DocumentRepository(DocumentModel);

// Create single document
const document = await repository.create({
  title: 'Sample Document',
  status: 'draft'
});

// Find by ID
const foundDocument = await repository.findById(document._id);

// Find with complex filters
const activeDocuments = await repository.find({
  status: 'published',
  createdAt: { $gte: new Date('2024-01-01') }
});

// Update document
const updatedDocument = await repository.updateById(document._id, {
  status: 'published',
  updatedAt: new Date()
});

// Delete operations
const deleted = await repository.deleteById(document._id);
console.log(`Document deleted: ${deleted}`); // true/false

// Count with filters
const publishedCount = await repository.count({
  status: 'published'
});
```

### **Advanced Pagination**

```typescript
// Generic pagination example
const paginatedResult = await repository.findPaginated(
  { status: 'published' }, // Filter
  2, // Page number
  10, // Items per page
  { createdAt: -1 } // Sort: newest first
);

console.log({
  documents: paginatedResult.data,
  pagination: {
    currentPage: paginatedResult.page, // 2
    totalPages: paginatedResult.totalPages, // 15
    totalItems: paginatedResult.total, // 147
    itemsPerPage: paginatedResult.limit, // 10
    hasNextPage: paginatedResult.hasNext, // true
    hasPreviousPage: paginatedResult.hasPrev // true
  }
});

// Pagination metadata for UI components
const paginationData = {
  currentPage: paginatedResult.page,
  totalPages: paginatedResult.totalPages,
  pages: Array.from({ length: paginatedResult.totalPages }, (_, i) => i + 1),
  showPrevious: paginatedResult.hasPrev,
  showNext: paginatedResult.hasNext,
  startItem: (paginatedResult.page - 1) * paginatedResult.limit + 1,
  endItem: Math.min(paginatedResult.page * paginatedResult.limit, paginatedResult.total)
};
```

---

## 📊 **Connection Management**

### **Connection Health Monitoring**

```typescript
// Monitor connection status
const connectionManager = MongoConnectionManagerFactory.create();
const connection = connectionManager.getConnection();

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

connection.on('error', err => {
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
  maxPoolSize: 10, // Maximum connections
  minPoolSize: 2, // Minimum connections maintained
  maxIdleTimeMS: 30000, // Close idle connections after 30s
  serverSelectionTimeoutMS: 5000, // Server selection timeout
  socketTimeoutMS: 45000, // Socket timeout

  // Buffering settings
  bufferCommands: false, // Disable command buffering
  bufferMaxEntries: 0, // Disable buffer max entries

  // Write concern
  writeConcern: {
    w: 'majority', // Wait for majority acknowledgment
    j: true, // Wait for journal
    wtimeout: 5000 // Timeout for write concern
  },

  // Read preference
  readPreference: 'primary', // Read from primary replica

  // Compression
  compressors: ['zlib'], // Enable compression

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
    - '27017:27017'
  environment:
    MONGO_INITDB_ROOT_USERNAME: admin
    MONGO_INITDB_ROOT_PASSWORD: password
    MONGO_INITDB_DATABASE: boilerplate
  volumes:
    - mongodb_data:/data/db # Data persistence
    - ./docker/mongo-init:/docker-entrypoint-initdb.d # Initialization scripts
  networks:
    - boilerplate_network
  healthcheck:
    test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s
  command: ['mongod', '--bind_ip_all', '--replSet', 'rs0']

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
  command: ['mongod', '--config', '/etc/mongod.conf']
  deploy:
    resources:
      limits:
        memory: 2G
        cpus: '1.0'
      reservations:
        memory: 1G
        cpus: '0.5'
  logging:
    driver: 'json-file'
    options:
      max-size: '100m'
      max-file: '5'
```

---

## 📈 **Performance Optimization**

### **Indexing Strategy**

```typescript
// Strategic index creation for any document type
const documentSchema = new Schema<IDocument>(
  {
    title: {
      type: String,
      required: true,
      index: true // Single field index for queries
    },
    status: {
      type: String,
      index: true // Status filtering optimization
    },
    category: {
      type: String,
      index: true // Category-based queries
    }
  },
  {
    timestamps: true // Automatic createdAt/updatedAt indexes
  }
);

// Compound indexes for complex queries
documentSchema.index({ status: 1, createdAt: -1 }); // Status + time queries
documentSchema.index({ category: 1, status: 1 }); // Category + status filters
documentSchema.index({ title: 1, status: 1 }); // Title + status queries

// Text search indexes
documentSchema.index(
  {
    title: 'text',
    content: 'text'
  },
  {
    weights: { title: 10, content: 5 } // Title is more important than content
  }
);

// Sparse indexes (only for documents with the field)
documentSchema.index({ publishedAt: -1 }, { sparse: true });
```

### **Query Optimization**

```typescript
// Efficient querying patterns
class OptimizedRepository<T extends Document> extends BaseRepository<T> {
  /**
   * Use lean() for read-only operations (50% faster)
   */
  async findActiveDocumentsLean(): Promise<any[]> {
    return await this.model
      .find({ status: 'active' })
      .lean() // Returns plain JavaScript objects (faster)
      .select('title status createdAt') // Only required fields
      .exec();
  }

  /**
   * Use aggregation for complex data processing
   */
  async getDocumentStatsByStatus(): Promise<any[]> {
    return await this.model
      .aggregate([
        { $match: { status: { $in: ['published', 'draft'] } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgSize: {
              $avg: { $strLenCP: '$content' } // Average content length
            }
          }
        },
        { $sort: { count: -1 } }
      ])
      .exec();
  }

  /**
   * Batch operations for efficiency
   */
  async updateMultipleDocuments(documentIds: string[], updateData: any): Promise<number> {
    const result = await this.model
      .updateMany({ _id: { $in: documentIds } }, { $set: { ...updateData, updatedAt: new Date() } })
      .exec();

    return result.modifiedCount;
  }
}
```

---

## 🛡️ **Security & Validation**

### **Input Sanitization**

```typescript
// Built-in security features in schemas
const documentSchema = new Schema<IDocument>({
  title: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (v: string) {
        // Prevent XSS attacks
        return !/<script|javascript:|on\w+=/i.test(v);
      },
      message: 'Title contains disallowed characters'
    }
  },
  content: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (v: string) {
        // Basic content sanitization
        return v.length > 0 && v.length <= 10000;
      },
      message: 'Content must be between 1 and 10000 characters'
    }
  }
});

// Pre-save sanitization hooks
documentSchema.pre('save', function (next) {
  // Sanitize input data
  if (this.title) {
    this.title = this.title.replace(/[<>'"&]/g, '');
  }
  next();
});
```

### **Repository Security Layer**

```typescript
export class SecureRepository<T extends Document> extends BaseRepository<T> {
  /**
   * Create document with validation and sanitization
   */
  async createSecureDocument(documentData: {
    title: string;
    content: string;
    [key: string]: any;
  }): Promise<T> {
    // Input validation
    if (!documentData.title?.trim()) {
      throw new Error('Title is required');
    }

    if (!documentData.content?.trim()) {
      throw new Error('Content is required');
    }

    // Basic sanitization
    const sanitizedData = {
      ...documentData,
      title: documentData.title.trim(),
      content: documentData.content.trim()
    };

    return await this.create(sanitizedData as Partial<T>);
  }

  /**
   * Safe document lookup with field filtering
   */
  async findSafeById(id: string, excludeFields: string[] = []): Promise<T | null> {
    const query = this.model.findById(id);

    // Exclude sensitive fields
    if (excludeFields.length > 0) {
      query.select(excludeFields.map(field => `-${field}`).join(' '));
    }

    return await query.exec();
  }

  /**
   * Find with sanitized filters
   */
  async findWithSanitizedFilters(filters: Record<string, any>): Promise<T[]> {
    // Sanitize filter values
    const sanitizedFilters: Record<string, any> = {};

    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'string') {
        sanitizedFilters[key] = value.trim();
      } else {
        sanitizedFilters[key] = value;
      }
    }

    return await this.find(sanitizedFilters);
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

  async safeUpdate(
    id: string,
    data: UpdateQuery<T>
  ): Promise<{
    success: boolean;
    data?: T;
    error?: string;
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
  private connectionManager: IMongoConnectionManager;

  constructor(connectionManager?: IMongoConnectionManager) {
    this.connectionManager = connectionManager || MongoConnectionManagerFactory.create();
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
    /^\/api\/transactions/ // Regex também suportado
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
app.post(
  '/api/transfer',
  {
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
  },
  async (request, reply) => {
    const { fromAccount, toAccount, amount } = request.body as any;

    // Session automaticamente disponível
    const session = request.mongoSession;

    if (!session) {
      return reply.status(500).send({ error: 'Transaction not available' });
    }

    // Usar session nas operações do banco
    await repository.updateOne({ id: fromAccount }, { $inc: { balance: -amount } }, { session });

    await repository.updateOne({ id: toAccount }, { $inc: { balance: amount } }, { session });

    // Se tudo der certo → commit automático
    // Se erro → rollback automático
    return reply.send({
      success: true,
      transactionId: request.transactionId
    });
  }
);
```

#### **3. Transações Automáticas**

```typescript
// Esta rota usa transação automaticamente (configurada em autoTransactionRoutes)
app.post(
  '/api/orders',
  {
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
  },
  async (request, reply) => {
    // Session disponível automaticamente devido à configuração
    const session = request.mongoSession;
    const { items, customerId } = request.body as any;

    // Usar session em todas as operações
    const order = await repository.create({ items, customerId }, { session });
    await secondaryRepo.updateStock(items, { session });

    return reply.status(201).send({
      orderId: order.id,
      transactionId: request.transactionId
    });
  }
);
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
app.post(
  '/api/complex-operation',
  {
    config: {
      [TRANSACTION_ROUTE_CONFIG]: {
        enabled: true,
        rollbackOnStatusCode: [400, 422] // Rollback personalizado
      }
    }
  },
  async (request, reply) => {
    const session = request.mongoSession;

    try {
      // Operações que podem falhar
      const document = await repository.create(documentData, { session });
      const metadata = await metadataRepo.create(metadataData, { session });

      // Validação de negócio
      if (!isValidDocument(document)) {
        // Status 400 → transação será revertida automaticamente
        return reply.status(400).send({ error: 'Invalid document data' });
      }

      return reply.send({ success: true, documentId: document.id });
    } catch (error) {
      // Erro será logado e transação revertida automaticamente
      app.log.error({ error, transactionId: request.transactionId });
      return reply.status(500).send({ error: 'Operation failed' });
    }
  }
);
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
import { TransactionManagerFactory } from '../infraestructure/mongo/transactionManager.factory.js';

const connectionManager = MongoConnectionManagerFactory.create();
const transactionManager = TransactionManagerFactory.create(connectionManager);

// Transações ativas
const activeTransactions = transactionManager.getActiveTransactions();

// Transação específica
const transaction = transactionManager.getTransaction(transactionId);

// Endpoint de health check
app.get('/health/transactions', async (request, reply) => {
  const active = transactionManager.getActiveTransactions();
  const longRunning = active.filter(t => Date.now() - t.startTime.getTime() > 30000);

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
await repository.create(documentData, { session: request.mongoSession });
await repository.updateOne({ id }, updateData, { session: request.mongoSession });
await repository.findMany({ active: true }, { session: request.mongoSession });
await repository.deleteOne({ id }, { session: request.mongoSession });
```

### **Uso Programático (Alternativo)**

Para casos específicos onde você precisa de controle manual:

```typescript
import { withTransaction, TransactionManager } from '../infraestructure/mongo/index.js';

// Método 1: Utility function
const result = await withTransaction(async session => {
  await repository.create(documentData, { session });
  await anotherRepository.update(updateData, { session });
  return { documentId: document.id };
});

// Método 2: TransactionManager direto
const connectionManager = MongoConnectionManagerFactory.create();
const transactionManager = TransactionManagerFactory.create(connectionManager);
const session = await transactionManager.startTransaction();

try {
  await repository.create(documentData, { session });
  await anotherRepository.update(updateData, { session });
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
app.post(
  '/api/transfer',
  {
    config: {
      [TRANSACTION_ROUTE_CONFIG]: {
        enabled: true,
        options: { maxTimeMS: 15000 } // Timeout apropriado
      }
    }
  },
  async (request, reply) => {
    const session = request.mongoSession;

    // Validação rápida
    if (amount <= 0) {
      return reply.status(400).send({ error: 'Invalid amount' });
    }

    // Operações atômicas focadas
    await repository.debit(fromAccount, amount, { session });
    await repository.credit(toAccount, amount, { session });

    return reply.send({ success: true });
  }
);
```

#### **❌ Evitar**

1. **Não use transações para operações simples** - Overhead desnecessário
2. **Não crie transações muito longas** - Causa problemas de performance
3. **Não ignore erros de transação** - Sempre trate adequadamente

```typescript
// ❌ Ruim - Operação simples não precisa de transação
app.get(
  '/api/documents/:id',
  {
    config: { [TRANSACTION_ROUTE_CONFIG]: { enabled: true } }
  },
  async (request, reply) => {
    return await repository.findById(request.params.id);
  }
);

// ✅ Bom - Operação simples sem transação
app.get('/api/documents/:id', async (request, reply) => {
  return await repository.findById(request.params.id);
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
// 1. Single Responsibility: One repository per document type
class DocumentRepository extends BaseRepository<IDocument> {
  // Document-specific operations only
}

class ArticleRepository extends BaseRepository<IArticle> {
  // Article-specific operations only
}

// 2. Interface Segregation: Define specific interfaces
interface IDocumentRepository {
  findByTitle(title: string): Promise<IDocument | null>;
  createDocument(documentData: CreateDocumentDto): Promise<IDocument>;
  updateStatus(documentId: string, status: string): Promise<void>;
}

// 3. Dependency Injection: Use interfaces, not concrete classes
class DocumentService {
  constructor(private documentRepository: IDocumentRepository) {}
}

// 4. Error Boundaries: Handle errors at repository level
class DocumentRepository extends BaseRepository<IDocument> implements IDocumentRepository {
  async findByTitle(title: string): Promise<IDocument | null> {
    try {
      return await this.findOne({ title: title.trim() });
    } catch (error) {
      this.logger.error({ title, error }, 'Failed to find document by title');
      throw new DatabaseError('Document lookup failed');
    }
  }
}
```

### **Performance Guidelines**

```typescript
// DO: Use lean() for read-only operations
const documents = await repository.model.find({ status: 'published' }).lean();

// DO: Select only required fields
const documentTitles = await repository.model.find({}, 'title status').lean();

// DO: Use aggregation for complex operations
const stats = await repository.model.aggregate([
  { $match: { status: 'published' } },
  { $group: { _id: '$category', count: { $sum: 1 } } }
]);

// DON'T: Load unnecessary data
const documents = await repository.find({}); // Loads all fields

// DON'T: Use individual queries in loops
for (const documentId of documentIds) {
  await repository.findById(documentId); // N+1 problem
}

// DO: Use batch operations
const documents = await repository.model
  .find({
    _id: { $in: documentIds }
  })
  .lean();
```

---

## 📋 **Migration & Maintenance**

### **Schema Migration Example**

```typescript
// migrations/001_add_user_preferences.ts
export async function up() {
  const db = mongoose.connection.db;

  // Add new field to existing documents
  await db.collection('documents').updateMany(
    { metadata: { $exists: false } },
    {
      $set: {
        metadata: {
          version: 1,
          tags: [],
          priority: 'normal'
        }
      }
    }
  );

  console.log('✅ Added metadata field to all documents');
}

export async function down() {
  const db = mongoose.connection.db;

  // Remove field
  await db.collection('documents').updateMany({}, { $unset: { metadata: 1 } });

  console.log('✅ Removed metadata field from all documents');
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
  async cleanupOldDocuments(
    collectionName: string,
    field: string,
    daysOld: number
  ): Promise<number> {
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
import { MongoConnectionManagerFactory } from '../infraestructure/mongo/connectionManager.factory.js';

export default fp(async function (fastify, opts) {
  const connectionManager = MongoConnectionManagerFactory.create();

  // Connect on plugin registration
  await connectionManager.connect();

  // Decorate Fastify instance
  fastify.decorate('mongoConnectionManager', connectionManager);

  // Add hooks for graceful shutdown
  fastify.addHook('onClose', async () => {
    await connectionManager.disconnect();
  });
});

// Usage in routes
app.get('/documents/:id', async (request, reply) => {
  const documentRepository = new DocumentRepository();
  const document = await documentRepository.findById(request.params.id);

  if (!document) {
    return reply.status(404).send({ error: 'Document not found' });
  }

  return reply.send(document);
});
```

### **Service Layer Integration**

```typescript
// services/document.service.ts
export class DocumentService {
  private documentRepository: DocumentRepository;

  constructor() {
    this.documentRepository = new DocumentRepository();
  }

  async createDocument(documentData: CreateDocumentDto): Promise<{
    success: boolean;
    document?: IDocument;
    error?: string;
  }> {
    try {
      // Business logic validation
      await this.validateDocumentData(documentData);

      // Create document through repository
      const document = await this.documentRepository.createDocument(documentData);

      // Post-creation business logic (index for search, etc.)
      await this.onDocumentCreated(document);

      return { success: true, document };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to create document'
      };
    }
  }

  private async validateDocumentData(documentData: CreateDocumentDto): Promise<void> {
    // Custom business validation
    if (await this.documentRepository.titleExists(documentData.title)) {
      throw new Error('Title already exists');
    }
  }

  private async onDocumentCreated(document: IDocument): Promise<void> {
    // Index document, send notifications, etc.
    console.log(`� Document "${document.title}" created successfully.`);
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
