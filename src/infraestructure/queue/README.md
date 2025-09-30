# Queue Module - MongoDB + Redis + BullMQ

Sistema de filas com **BullMQ v5.58.7** para processamento assíncrono, **MongoDB** para persistência e **Redis** para performance.

## 🏗️ **Arquitetura**

```
src/infraestructure/queue/
├── persistentQueueManager.ts  # 🎯 MongoDB + Redis integration
├── queue.ts                   # ⚡ BullMQ wrapper
├── plugin.ts                  # � Fastify plugin
├── handlers.ts                # 🔄 Job handlers registry
└── jobs/                      # 📋 Job implementations
    ├── business/              # 💼 Business jobs
    └── maintenance/           # 🔧 System jobs
```

## ⚙️ **Environment Variables**

```env
# Batch Control (Critical for performance)
BATCH_SIZE_JOBS=50             # MongoDB → Redis batch size
WORKER_SIZE_JOBS=10            # BullMQ worker concurrency

# Queue Configuration
QUEUE_NAME=app-queue
WORKER_PROCESSING_INTERVAL=5000

# Redis Configuration
QUEUE_REDIS_HOST=redis
QUEUE_REDIS_PORT=6379
QUEUE_REDIS_DB=1
```

## 🚀 **Usage**

### **Adding Jobs (API Mode)**

```typescript
// In route handlers
await fastify.addJob(
  'email:send',
  {
    userId: '123',
    template: 'welcome',
    data: { name: 'John' }
  },
  {
    priority: 10,
    attempts: 3,
    delay: 5000
  }
);
```

### **Processing Jobs (Worker Mode)**

Jobs are automatically processed by workers using the registered handlers in `jobs/` directory.

### **Available Job Types**

- `email:send` - Email sending
- `user:notification` - User notifications
- `data:export` - Data export operations
- `file:process` - File processing
- `cache:warm` - Cache warming

## 📊 **Monitoring**

### **Bull Dashboard**

- **URL**: http://localhost:3002/ui
- **Features**: Real-time queue monitoring, job management, retry controls

### **API Statistics**

```typescript
const stats = await fastify.persistentQueueManager.getJobStats();
// Returns: { pending, processing, completed, failed, dlq }
```

## 🔧 **Key Features**

### **Dual Persistence**

- **MongoDB**: Permanent job storage with batch management
- **Redis/BullMQ**: High-performance job processing
- **Auto-sync**: Automatic status synchronization

### **Batch Processing Flow**

1. **Job Creation**: Stored in MongoDB
2. **Batch Loading**: MongoDB → Redis (configurable batch size)
3. **BullMQ Processing**: Redis → Worker execution
4. **Status Update**: Results back to MongoDB

### **Error Handling**

- **Retry Logic**: Exponential backoff
- **Dead Letter Queue**: Failed jobs tracking
- **Failure Callbacks**: Automatic MongoDB status updates

## 🎯 **Performance Tuning**

### **Development**

```env
BATCH_SIZE_JOBS=25    # Smaller batches for debugging
WORKER_SIZE_JOBS=5    # Limited workers for resources
```

### **Production**

```env
BATCH_SIZE_JOBS=100   # Larger batches for throughput
WORKER_SIZE_JOBS=20   # More workers for parallelization
```

## 🔄 **Job Implementation**

### **Creating New Jobs**

1. **Add handler in `jobs/business/`**:

```typescript
export const myNewJob: JobHandler = async (data, jobId, logger) => {
  // Your job logic here
  logger.info(`Processing job ${jobId}`, data);
  return { success: true };
};
```

2. **Register in `jobs/index.ts`**:

```typescript
export const JOB_HANDLERS = {
  'my:new:job': myNewJob
  // ... other handlers
};
```

### **Job Handler Interface**

```typescript
type JobHandler = (
  data: any, // Job payload
  jobId: string, // Unique job ID
  logger: Logger, // Pino logger instance
  options: JobOptions // Retry and timeout options
) => Promise<any>;
```
