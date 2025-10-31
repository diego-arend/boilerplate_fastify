# Worker Module - Background Job Processing

Sistema de workers separados para processamento assíncrono de jobs com **MongoDB → Redis → BullMQ** flow.

## 🏗️ **Architecture**

### **Container Separation**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Container │    │   Redis Queue   │    │ Worker Container│
│  (Publisher)    │───▶│    (BullMQ)     │───▶│   (Consumer)    │
│ WORKER_MODE=false│    │                 │    │ WORKER_MODE=true│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

```
┌─────────────────────────────────────────────────────┐
│                 StandaloneWorker                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1️⃣ MongoDB (JobBatchRepository)                    │
│      ↓ loadNextBatch()                              │
│      ↓ Busca jobs pendentes                         │
│                                                      │
│  2️⃣ Redis Queue (QueueManager)                      │
│      ↓ addJob() para cada job                       │
│      ↓ Adiciona jobs no BullMQ                      │
│                                                      │
│  3️⃣ BullMQ Worker Processing                        │
│      ↓ JOB_HANDLERS[jobType](data, jobId, ...)     │
│      ↓ Processa job com handler especializado       │
│                                                      │
│  4️⃣ MongoDB Update                                  │
│      ↓ markJobAsCompleted() ou markJobAsFailed()   │
│      ✅ Atualiza status final                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### **Files Structure**

```
src/infraestructure/workers/
├── worker.ts      # 🏭 StandaloneWorker class
├── index.ts       # 🚀 Worker entry point
└── README.md      # 📖 This documentation
```

## ⚙️ **Environment Variables**

### **Critical Parameters**

```env
# Container Mode
WORKER_MODE=true               # Enable worker mode

# Batch Control (Performance Critical)
BATCH_SIZE_JOBS=50             # MongoDB → Redis batch size
WORKER_SIZE_JOBS=10            # BullMQ worker concurrency
WORKER_PROCESSING_INTERVAL=5000 # Batch loading interval (ms)

# Connection
QUEUE_NAME=app-queue
MONGO_URI=mongodb://mongo:27017/app
QUEUE_REDIS_HOST=redis
QUEUE_REDIS_DB=1
```

### **Environment Files**

```
.env.worker.development    # Development settings
.env.worker.production     # Production settings
```

## 🚀 **Usage**

### **Development**

```bash
# Start full environment
pnpm run docker:dev

# Worker logs
docker logs boilerplate_fastify-worker-dev-1 -f

# Worker health check
curl http://localhost:3003/health
```

### **Production**

```bash
# Start production
pnpm run docker:prod

# Scale workers
docker-compose up --scale worker=3

# Monitor workers
docker stats
```

### **Standalone Worker**

```bash
# Local development
WORKER_MODE=true pnpm run worker:dev

# Direct execution
node dist/infraestructure/workers/index.js
```

## 🔧 **Configuration**

### **Performance Tuning**

#### **Development Settings**

```env
BATCH_SIZE_JOBS=25     # Smaller batches for debugging
WORKER_SIZE_JOBS=5     # Limited workers for resources
WORKER_PROCESSING_INTERVAL=3000  # Faster for testing
```

#### **Production Settings**

```env
BATCH_SIZE_JOBS=100    # Larger batches for throughput
WORKER_SIZE_JOBS=20    # More workers for parallelization
WORKER_PROCESSING_INTERVAL=5000  # Optimized interval
```

### **Resource Limits**

```yaml
# docker-compose.yml
worker:
  deploy:
    resources:
      limits:
        cpus: '0.8'
        memory: 768M
      reservations:
        cpus: '0.3'
        memory: 256M
```

## 🎯 **Worker Flow**

### **Processing Cycle**

1. **Batch Loading**: MongoDB → Redis (every `WORKER_PROCESSING_INTERVAL`)
2. **Job Processing**: Redis → BullMQ Workers (concurrent: `WORKER_SIZE_JOBS`)
3. **Status Update**: Results → MongoDB
4. **Error Handling**: Failed jobs → Dead Letter Queue

### **StandaloneWorker Class**

```typescript
class StandaloneWorker {
  // Core methods for developers
  async run(); // Start worker process
  async stop(); // Graceful shutdown
  async getStats(); // Performance metrics
  async healthCheck(); // Container health

  // Internal methods
  private loadBatchToRedis(); // MongoDB → Redis loading
  private registerJobHandlers(); // BullMQ job registration
}
```

## 📊 **Monitoring**

### **Health Check**

```bash
# Worker health endpoint
curl http://localhost:3003/health
# Returns: { status: "ok", uptime: 3600, ... }
```

### **Performance Metrics**

```typescript
const stats = await worker.getStats();
// Returns:
// {
//   worker: { config, isRunning, batchLoading },
//   jobs: { pending, processing, completed, failed },
//   queue: { waiting, active, completed, failed },
//   connections: { mongo: true, redis: true }
// }
```

### **Bull Dashboard**

- **URL**: http://localhost:3002/ui
- **Features**: Real-time monitoring, job management, retry controls

## 🔄 **Job Processing**

### **Supported Job Types**

Workers automatically process all registered job types:

- `email:send` - Email sending
- `user:notification` - User notifications
- `data:export` - Data exports
- `file:process` - File processing
- `cache:warm` - Cache warming

### **Error Handling**

- **Automatic Retry**: Exponential backoff with configurable attempts
- **Failure Callbacks**: Automatic MongoDB status updates
- **Dead Letter Queue**: Failed jobs tracking and analysis

## � **Scaling**

### **Horizontal Scaling**

```bash
# Scale workers at runtime
docker-compose up --scale worker=5

# Update compose file for permanent scaling
# Edit docker-compose.yml:
worker:
  deploy:
    replicas: 3
```

### **Performance Optimization**

```env
# High throughput setup
BATCH_SIZE_JOBS=200
WORKER_SIZE_JOBS=50

# Memory constrained setup
BATCH_SIZE_JOBS=25
WORKER_SIZE_JOBS=5
```

## 🧪 **Development**

### **Local Testing**

```bash
# Test worker compilation
pnpm run build

# Test worker startup
WORKER_MODE=true NODE_ENV=development node dist/infraestructure/workers/index.js

# Integration test
pnpm run docker:dev
```

### **Debugging**

```bash
# Worker container access
docker-compose exec worker bash

# Check worker logs
docker-compose logs worker -f

# Monitor resources
docker-compose top worker
```

## 🔍 **Troubleshooting**

### **Common Issues**

**Worker not processing jobs:**

```bash
# Check Redis connection
docker-compose logs redis

# Verify worker mode
echo $WORKER_MODE  # Should be 'true'
```

**High memory usage:**

```bash
# Reduce batch size
BATCH_SIZE_JOBS=25

# Reduce worker concurrency
WORKER_SIZE_JOBS=5
```

**Jobs piling up:**

```bash
# Increase worker concurrency
WORKER_SIZE_JOBS=20

# Scale worker containers
docker-compose up --scale worker=3
```
