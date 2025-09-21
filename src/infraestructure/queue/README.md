# BullMQ Queue System

This infrastructure module implements a robust job queue system using BullMQ and Redis for background task processing.

## Architecture

The queue system is designed with separation of concerns:

- **API Server**: Handles job submission, status queries, and queue management
- **Queue Worker**: Separate process/container that processes jobs in the background
- **Redis**: Shared storage for job queues, results, and status tracking

## Components

### 1. Queue Types (`queue.types.ts`)

Defines all job types, data structures, and interfaces:

```typescript
// Available job types
export const JobType = {
  EMAIL_SEND: 'EMAIL_SEND',
  USER_NOTIFICATION: 'USER_NOTIFICATION', 
  DATA_EXPORT: 'DATA_EXPORT',
  FILE_PROCESS: 'FILE_PROCESS',
  CACHE_WARM: 'CACHE_WARM',
  CLEANUP: 'CLEANUP'
} as const;

// Job priority levels
export const JobPriority = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  URGENT: 20
} as const;
```

### 2. Queue Manager (`queue.manager.ts`)

Provides high-level operations for queue management:

- Add jobs to queue with validation
- Query job status and results
- Remove jobs from queue
- Get queue statistics
- Clean old completed/failed jobs
- Pause/resume queue processing

```typescript
const queueManager = getDefaultQueueManager();
await queueManager.initialize(fastify.config);

// Add a job
const job = await queueManager.addJob(JobType.EMAIL_SEND, {
  to: 'user@example.com',
  subject: 'Welcome',
  template: 'welcome'
}, {
  priority: JobPriority.HIGH,
  attempts: 3
});
```

### 3. Queue Worker (`queue.worker.ts`)

Independent worker process that processes jobs:

- Separate handlers for each job type
- Graceful shutdown handling
- Comprehensive error handling and logging
- Job result tracking and statistics

```typescript
// Can be run as separate process
const worker = new QueueWorker();
await worker.start();
```

### 4. Queue Controller (`queue.controller.ts`)

REST API endpoints for queue operations:

- `POST /queue/jobs` - Submit new jobs
- `GET /queue/jobs/:id` - Get job status
- `DELETE /queue/jobs/:id` - Remove job
- `GET /queue/stats` - Queue statistics
- `POST /queue/pause|resume` - Control processing
- `POST /queue/clean/completed|failed` - Cleanup operations

### 5. Queue Plugin (`queue.plugin.ts`)

Fastify plugin that registers queue routes and initializes the system.

## Job Types and Handlers

### EMAIL_SEND
Handles email notifications and campaigns:
```typescript
interface EmailJobData extends BaseJobData {
  to: string;
  subject: string;
  template: string;
  variables?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}
```

### USER_NOTIFICATION
Manages in-app user notifications:
```typescript
interface UserNotificationJobData extends BaseJobData {
  title: string;
  body: string;
  type: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, any>;
}
```

### DATA_EXPORT
Handles large data export operations:
```typescript
interface DataExportJobData extends BaseJobData {
  exportType: 'csv' | 'json' | 'xlsx';
  filters: Record<string, any>;
  columns?: string[];
}
```

### FILE_PROCESS
Processes file uploads and transformations:
```typescript
interface FileProcessJobData extends BaseJobData {
  filePath: string;
  operation: 'resize' | 'compress' | 'convert' | 'extract_text';
  options?: Record<string, any>;
}
```

### CACHE_WARM
Performs cache warming operations:
```typescript
interface CacheWarmJobData extends BaseJobData {
  cacheKey: string;
  dataSource: string;
  ttl?: number;
}
```

### CLEANUP
System maintenance and cleanup tasks:
```typescript
interface CleanupJobData extends BaseJobData {
  targetType: 'temp_files' | 'old_logs' | 'expired_sessions';
  olderThan: number; // milliseconds
  path?: string;
  pattern?: string;
}
```

## Usage Examples

### Adding Jobs

```typescript
// High priority email
await queueManager.addJob(JobType.EMAIL_SEND, {
  to: 'urgent@example.com',
  subject: 'Security Alert',
  template: 'security_alert'
}, {
  priority: JobPriority.URGENT,
  attempts: 5
});

// Delayed notification
await queueManager.addJob(JobType.USER_NOTIFICATION, {
  userId: 'user123',
  title: 'Reminder',
  body: 'Your subscription expires soon'
}, {
  delay: 30000, // 30 seconds
  priority: JobPriority.NORMAL
});
```

### Monitoring Jobs

```typescript
// Get job status
const job = await queueManager.getJob('job-id');
const status = await job.getState(); // 'waiting', 'active', 'completed', 'failed'

// Get queue statistics
const stats = await queueManager.getStats();
console.log(`Jobs: ${stats.waiting} waiting, ${stats.active} active`);
```

### Queue Management

```typescript
// Pause processing
await queueManager.pause();

// Resume processing  
await queueManager.resume();

// Clean old jobs
await queueManager.cleanCompleted(24 * 60 * 60 * 1000); // 24 hours
await queueManager.cleanFailed(48 * 60 * 60 * 1000); // 48 hours
```

## Configuration

### Environment Variables

```bash
# Redis configuration (shared with cache system)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Queue-specific settings
QUEUE_CONCURRENCY=5        # Number of concurrent jobs per worker
QUEUE_REMOVE_ON_COMPLETE=10 # Keep last N completed jobs
QUEUE_REMOVE_ON_FAIL=50    # Keep last N failed jobs
```

### Queue Options

```typescript
interface JobOptions {
  priority?: number;     // Job priority (1-20)
  delay?: number;        // Delay before processing (ms)
  attempts?: number;     // Max retry attempts
  jobId?: string;        // Custom job ID
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}
```

## Running the Worker

### Local Development
```bash
# Install dependencies
pnpm install

# Start worker process
pnpm run worker:queue
```

### Docker Container
```bash
# Start all services including worker
docker-compose up --build

# Start only worker
docker-compose up queue-worker

# Scale workers
docker-compose up --scale queue-worker=3
```

## Testing

Use the provided HTTP test file:

```bash
# Test different job types
# Open http-docs/queue.http in VS Code with REST Client extension

# Or use curl
curl -X POST http://localhost:3001/api/queue/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "EMAIL_SEND",
    "data": {
      "to": "test@example.com",
      "subject": "Test Email",
      "template": "test"
    },
    "options": {
      "priority": 10
    }
  }'
```

## Error Handling

### Worker Error Handling
- Jobs that throw errors are automatically retried
- Max attempts configurable per job
- Failed jobs include detailed error information
- Worker handles Redis connection issues gracefully

### Graceful Shutdown
The worker process handles shutdown signals properly:
```bash
# Graceful shutdown (finishes current jobs)
docker-compose stop queue-worker

# Force shutdown
docker-compose kill queue-worker
```

## Monitoring and Debugging

### Logs
```bash
# Worker logs
docker-compose logs -f queue-worker

# Application logs (queue API)
docker-compose logs -f app
```

### Redis Inspection
```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Check queue keys
> KEYS bull:jobs:*

# Monitor queue activity
> MONITOR
```

### Queue Statistics
```bash
# API endpoint
curl http://localhost:3001/api/queue/stats

# Response includes:
# - waiting: Jobs waiting to be processed
# - active: Currently processing jobs
# - completed: Successfully completed jobs
# - failed: Failed jobs
# - delayed: Scheduled for future processing
```

## Best Practices

### Job Design
- Keep job data minimal (use IDs, not full objects)
- Make jobs idempotent (safe to retry)
- Set appropriate retry limits
- Use meaningful job IDs for tracking

### Performance
- Scale workers based on job volume
- Monitor Redis memory usage
- Clean old jobs regularly
- Use job priorities effectively

### Error Handling
- Log detailed error information
- Implement job-specific retry logic
- Monitor failed job patterns
- Set up alerts for high failure rates

### Security
- Validate job data thoroughly
- Use authentication for queue management endpoints
- Sanitize file paths and user inputs
- Implement rate limiting for job submission

## Troubleshooting

### Common Issues

**Jobs not processing:**
- Check worker container status
- Verify Redis connection
- Check for worker errors in logs

**High memory usage:**
- Clean old completed/failed jobs
- Reduce job data size
- Monitor Redis memory usage

**Jobs failing consistently:**
- Review job handler logic
- Check for missing dependencies
- Validate job data structure

**Queue backed up:**
- Scale worker instances
- Check for blocking operations in handlers
- Monitor job processing times