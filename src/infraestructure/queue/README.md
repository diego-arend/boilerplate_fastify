# BullMQ Queue System

This infrastructure module implements a robust job queue system using BullMQ and Redis for background task processing with modular job handlers.

## Architecture

The queue system is designed with separation of concerns and modular job processing:

- **API Server**: Handles job submission, status queries, and queue management
- **Queue Worker**: Separate process/container that processes jobs in the background
- **Modular Job Handlers**: Individual handlers for each job type in separate files
- **Redis**: Shared storage for job queues, results, and status tracking

## Components

### 1. Queue Types (`queue.types.ts`)

Defines all job types, data structures, and interfaces:

```typescript
// Available job types
export const JobType = {
  EMAIL_SEND: 'email:send',
  USER_NOTIFICATION: 'user:notification', 
  DATA_EXPORT: 'data:export',
  FILE_PROCESS: 'file:process',
  CACHE_WARM: 'cache:warm',
  CLEANUP: 'cleanup'
} as const;

// Job priority levels
export const JobPriority = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  CRITICAL: 15
} as const;
```

### 2. Modular Job Handlers (`jobs/`)

Each job type has its own dedicated handler file with comprehensive processing logic:

#### Structure
```
src/infraestructure/queue/jobs/
├── index.ts                    # Handler registry and utilities
├── emailSend.job.ts           # EMAIL_SEND handler
├── userNotification.job.ts    # USER_NOTIFICATION handler
├── dataExport.job.ts          # DATA_EXPORT handler
├── fileProcess.job.ts         # FILE_PROCESS handler
├── cacheWarm.job.ts           # CACHE_WARM handler
└── cleanup.job.ts             # CLEANUP handler
```

#### Handler Features
- **Type Safety**: Full TypeScript support with specific data interfaces
- **Validation**: Comprehensive input validation and security checks
- **Error Handling**: Detailed error reporting and retry logic
- **Logging**: Structured logging with job context
- **Simulation**: Realistic processing simulation for development/testing

### 3. Queue Manager (`queue.manager.ts`)

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
  body: 'Welcome to our service!',
  timestamp: Date.now()
}, {
  priority: JobPriority.HIGH,
  attempts: 3
});
```

### 4. Queue Worker (`queue.worker.ts`)

Independent worker process that uses modular handlers:

- Automatic handler registration from job registry
- Graceful shutdown handling
- Comprehensive error handling and logging
- Job result tracking and statistics

```typescript
// Worker automatically loads all handlers from jobs/index.ts
const worker = new QueueWorker();
await worker.start();
```

### 5. Queue Controller (`queue.controller.ts`)

REST API endpoints for queue operations:

- `POST /queue/jobs` - Submit new jobs
- `GET /queue/jobs/:id` - Get job status
- `DELETE /queue/jobs/:id` - Remove job
- `GET /queue/stats` - Queue statistics
- `POST /queue/pause|resume` - Control processing
- `POST /queue/clean/completed|failed` - Cleanup operations

### 6. Queue Plugin (`queue.plugin.ts`)

Fastify plugin that registers queue routes and initializes the system.

## Job Types and Handlers

### EMAIL_SEND (`jobs/emailSend.job.ts`)
Handles email notifications and campaigns with template support:

```typescript
interface EmailJobData extends BaseJobData {
  to: string;
  subject: string;
  body: string;
  template?: string;
  variables?: Record<string, any>;
}
```

**Features:**
- Template rendering simulation
- Email validation and security checks
- Delivery failure simulation (2% rate)
- Comprehensive logging and error handling

### USER_NOTIFICATION (`jobs/userNotification.job.ts`)
Manages multi-channel user notifications:

```typescript
interface UserNotificationJobData extends BaseJobData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  channels?: ('push' | 'email' | 'sms')[];
}
```

**Features:**
- Multi-channel delivery (push, email, SMS)
- Partial success handling
- Channel-specific failure rates
- Content length validation

### DATA_EXPORT (`jobs/dataExport.job.ts`)
Handles large data export operations:

```typescript
interface DataExportJobData extends BaseJobData {
  userId: string;
  format: 'csv' | 'json' | 'xlsx';
  filters?: Record<string, any>;
  outputPath?: string;
}
```

**Features:**
- Multiple export formats
- Secure path validation
- File size estimation
- Download URL generation with expiry

### FILE_PROCESS (`jobs/fileProcess.job.ts`)
Processes file uploads and transformations:

```typescript
interface FileProcessJobData extends BaseJobData {
  fileId: string;
  filePath: string;
  operation: 'compress' | 'resize' | 'convert' | 'analyze';
  options?: Record<string, any>;
}
```

**Features:**
- Multiple operation types (compress, resize, convert, analyze)
- File type validation and security checks
- Operation-specific processing simulation
- Detailed file metadata generation

### CACHE_WARM (`jobs/cacheWarm.job.ts`)
Performs cache warming operations:

```typescript
interface CacheWarmJobData extends BaseJobData {
  cacheKey: string;
  dataSource: string;
  ttl?: number;
}
```

**Features:**
- Multiple data source types (database, API, file, computation, external)
- Cache freshness checking
- Data processing and validation
- TTL management and expiry calculation

### CLEANUP (`jobs/cleanup.job.ts`)
System maintenance and cleanup tasks:

```typescript
interface CleanupJobData extends BaseJobData {
  target: 'temp_files' | 'old_logs' | 'expired_sessions' | 'cache';
  olderThan?: number; // days
  pattern?: string;
}
```

**Features:**
- Multiple cleanup targets
- Secure path validation
- Simulated file scanning and deletion
- Detailed cleanup statistics and reporting

## Usage Examples

### Adding Jobs

```typescript
// High priority email with full data
await queueManager.addJob(JobType.EMAIL_SEND, {
  to: 'urgent@example.com',
  subject: 'Security Alert',
  body: 'Your account security needs attention.',
  template: 'security_alert',
  timestamp: Date.now()
}, {
  priority: JobPriority.CRITICAL,
  attempts: 5
});

// Multi-channel user notification
await queueManager.addJob(JobType.USER_NOTIFICATION, {
  userId: 'user123',
  title: 'Subscription Reminder',
  message: 'Your subscription expires in 3 days',
  type: 'warning',
  channels: ['push', 'email'],
  timestamp: Date.now()
}, {
  delay: 30000, // 30 seconds
  priority: JobPriority.HIGH
});

// Data export with custom filters
await queueManager.addJob(JobType.DATA_EXPORT, {
  userId: 'admin',
  format: 'csv',
  filters: { dateRange: '2024-01-01,2024-12-31', status: 'active' },
  timestamp: Date.now()
}, {
  priority: JobPriority.NORMAL,
  attempts: 3
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

## Adding New Job Types

### 1. Create Job Handler File

Create a new handler file in `src/infraestructure/queue/jobs/`:

```typescript
// src/infraestructure/queue/jobs/myNewJob.job.ts
import type { FastifyBaseLogger } from 'fastify'
import type { MyNewJobData, JobResult } from '../queue.types.js'

export async function handleMyNewJob(
  data: MyNewJobData,
  jobId: string,
  logger: FastifyBaseLogger
): Promise<JobResult> {
  const startTime = Date.now()

  logger.info({ jobData: data }, 'Processing my new job')

  try {
    validateJobData(data)
    const result = await processJob(data, logger)
    const processingTime = Date.now() - startTime

    return {
      success: true,
      data: result,
      processedAt: Date.now(),
      processingTime
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    logger.error({ error, processingTime }, 'Job processing failed')

    return {
      success: false,
      error: errorMessage,
      processedAt: Date.now(),
      processingTime
    }
  }
}

function validateJobData(data: MyNewJobData): void {
  if (!data.requiredField) {
    throw new Error('Required field is missing')
  }
}

async function processJob(data: MyNewJobData, logger: FastifyBaseLogger): Promise<any> {
  // Add processing logic
  return { processed: true, timestamp: new Date().toISOString() }
}
```

### 2. Update Queue Types

Add the new job type and data interface in `queue.types.ts`:

```typescript
export const JobType = {
  // ... existing types
  MY_NEW_JOB: 'my:new:job',
} as const;

export interface MyNewJobData extends BaseJobData {
  requiredField: string;
  optionalField?: number;
}

// Update the union type
export type JobData = 
  | EmailJobData
  | UserNotificationJobData
  // ... other types
  | MyNewJobData;
```

### 3. Register Handler

Update the handler registry in `jobs/index.ts`:

```typescript
import { handleMyNewJob } from './myNewJob.job.js';

export const JOB_HANDLERS: Record<string, JobHandler> = {
  // ... existing handlers
  [JobType.MY_NEW_JOB]: handleMyNewJob,
} as const;

export { handleMyNewJob } from './myNewJob.job.js';
```

### 4. Test the Handler

```bash
curl -X POST http://localhost:3001/api/queue/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "my:new:job",
    "data": {
      "requiredField": "test value",
      "timestamp": '$(date +%s)'
    },
    "options": {
      "priority": 5
    }
  }'
```

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