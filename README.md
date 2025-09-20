# Boilerplate Fastify

Boilerplate for Fastify applications with TypeScript, MongoDB and Redis cache system.

## ✨ Features

- **FastifyJS**: High-performance web framework
- **TypeScript**: Type-safe development
- **MongoDB**: Database with Mongoose ODM
- **Redis Cache**: In-memory caching system
- **BullMQ Queue System**: Background job processing with worker separation
- **JWT Authentication**: Secure authentication with RBAC
- **Docker**: Containerized development and production
- **Swagger UI**: Interactive API documentation (dev only)
- **Health Checks**: Application and services monitoring

## 🚀 Running with Docker

### Prerequisites

- Docker
- Docker Compose

### Development Environment

To run in development mode with hot reload:

```bash
# Build and run all services
docker-compose -f docker-compose.dev.yml up --build

# Or in background
docker-compose -f docker-compose.dev.yml up -d --build
```

### Production Environment

To run in production mode:

```bash
# Build and run all services
docker-compose up --build

# Or in background
docker-compose up -d --build
```

### Available Services

- **App** (Fastify): http://localhost:3001
- **Queue Worker** (BullMQ): Background job processing
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379 (shared by cache and queue)
- **Swagger UI** (development): http://localhost:3001/docs

### Useful Commands

```bash
# View application logs
docker-compose logs app

# View queue worker logs
docker-compose logs queue-worker

# View all services logs
docker-compose logs

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Execute commands in the application container
docker-compose exec app sh

# Execute commands in the queue worker container
docker-compose exec queue-worker sh

# Check services status
docker-compose ps

# Start only queue worker
docker-compose up queue-worker

# Restart queue worker
docker-compose restart queue-worker
```

## 📚 API Documentation

### Swagger UI (Development)

The application includes interactive API documentation through Swagger UI, available only in development environment:

- **URL**: http://localhost:3001/docs
- **Format**: OpenAPI 3.0
- **Environment**: Only when `NODE_ENV=development`

**Features:**
- Complete documentation of all endpoints
- Interactive interface to test APIs
- Detailed request/response schemas
- Integrated JWT authentication (Bearer token)
- Organization by tags (Auth, Health)

**To access:**
1. Start the application in development mode:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```
2. Access: http://localhost:3001/docs

**Note:** Swagger documentation is automatically disabled in production for security reasons.

### Documentation Files
- `http-docs/auth.http` - HTTP tests for authentication
- `http-docs/queue.http` - HTTP tests for queue system
- `http-docs/cache.http` - HTTP tests for cache behavior
- `src/infraestructure/cache/README.md` - Cache system documentation
- `src/modules/auth/README.md` - Authentication and RBAC documentation
- `src/lib/response/README.md` - ApiResponseHandler class documentation

### Main Endpoints

**Health Check:**
- `GET /health` - Application status

**Authentication:**
- `POST /auth/register` - User registration
- `POST /auth/login` - Login and JWT token retrieval
- `GET /auth/me` - Authenticated user profile (requires token, **cached**)

**Queue Management:**
- `POST /api/queue/jobs` - Add job to queue
- `GET /api/queue/jobs/:jobId` - Get job status and details
- `DELETE /api/queue/jobs/:jobId` - Remove job from queue
- `GET /api/queue/stats` - Get queue statistics
- `POST /api/queue/pause` - Pause job processing
- `POST /api/queue/resume` - Resume job processing
- `POST /api/queue/clean/completed` - Clean old completed jobs
- `POST /api/queue/clean/failed` - Clean old failed jobs

**Cache Testing:**
- Use `http-docs/cache.http` for cache hit/miss testing
- Headers `X-Cache`, `X-Cache-Key`, `X-Cache-TTL` for debugging

All endpoints are documented in Swagger UI with complete schemas and usage examples.

### Development Scripts

```bash
# Run in development mode (with Swagger)
pnpm dev

# Run queue worker separately 
pnpm worker:queue

# Build for production
pnpm build

# Run in production (without Swagger)
pnpm start
```

**Note:** Swagger UI is automatically enabled in development environment (`NODE_ENV=development`).

### Health Checks

All services include automatic health checks:

- **App**: Checks if the `/health` route responds
- **MongoDB**: Tests database connection
- **Redis**: Tests cache connection

### Environment Variables

The following variables are automatically configured:

**Server Configuration:**
- `PORT=3001` - Application port
- `NODE_ENV=development|production` - Environment mode
- `JWT_SECRET` - JWT token secret key

**MongoDB Configuration:**
- `MONGO_URI=mongodb://admin:password@mongodb:27017/boilerplate?authSource=admin`

**Redis Cache Configuration:**
- `REDIS_HOST=redis` (container) or `localhost` (local)
- `REDIS_PORT=6379` - Redis port
- `REDIS_PASSWORD=` - Redis password (empty by default)
- `REDIS_DB=0` - Redis database number

### Cache System

The application includes an automatic Redis caching system:

**Features:**
- ✅ **Automatic caching** for GET requests
- ✅ **Cache headers** (`X-Cache: HIT/MISS`) for debugging
- ✅ **TTL configuration** per route or globally
- ✅ **User-scoped caching** for authenticated routes
- ✅ **Cache statistics** (hits, misses, errors)
- ✅ **Graceful fallback** if Redis is unavailable

**Cache Behavior:**
- Only GET requests are cached automatically
- Authenticated routes use user-scoped cache keys
- Skip routes: `/health`, `/auth/login`, `/auth/register`
- Default TTL: 300 seconds (5 minutes)
- Routes with query parameters are not cached by default

**Manual Cache Control:**
```typescript
// Set cache manually
await fastify.setCacheForRoute('my-key', data, 600);

// Get from cache
const cached = await fastify.getCacheForRoute('my-key');

// Invalidate cache
await fastify.invalidateCache('my-key');

// Clear all route cache
await fastify.clearRouteCache();
```

**Testing Cache:**
Use the `http-docs/cache.http` file to test cache behavior:
1. Make first request → `X-Cache: MISS`
2. Make second request → `X-Cache: HIT`

**Monitoring:**
- Cache errors are automatically logged
- Cache statistics available via `fastify.cache.getStats()`
- Connection status logged on startup

### BullMQ Queue System

The application includes a robust job queue system with BullMQ and Redis:

**Features:**
- ✅ **Background job processing** with separate worker containers
- ✅ **Job prioritization** and delayed execution
- ✅ **Retry mechanisms** with configurable attempts
- ✅ **Job status tracking** and result storage
- ✅ **Queue management** (pause, resume, cleanup)
- ✅ **Multiple job types** with specific handlers
- ✅ **Graceful worker shutdown** and error handling

**Architecture:**
- **API Server**: Handles job submission and status queries
- **Queue Worker**: Separate process/container for job processing
- **Redis**: Shared storage for job queues and results

**Available Job Types:**
1. **EMAIL_SEND** - Email notifications and campaigns
2. **USER_NOTIFICATION** - In-app user notifications
3. **DATA_EXPORT** - Large data export operations
4. **FILE_PROCESS** - File upload processing and transformations
5. **CACHE_WARM** - Cache warming operations
6. **CLEANUP** - System maintenance and cleanup tasks

**Job Priority Levels:**
- **LOW**: 1 (cleanup, non-urgent tasks)
- **NORMAL**: 5 (default priority)
- **HIGH**: 10 (important notifications)
- **URGENT**: 20 (security alerts, critical operations)

**Queue Management API:**

*Add Job to Queue:*
```bash
POST /api/queue/jobs
{
  "type": "EMAIL_SEND",
  "data": {
    "to": "user@example.com",
    "subject": "Welcome",
    "template": "welcome"
  },
  "options": {
    "priority": 10,
    "delay": 5000,
    "attempts": 3,
    "jobId": "custom-job-id"
  }
}
```

*Get Job Status:*
```bash
GET /api/queue/jobs/{jobId}
# Returns: status, data, result, attempts, timestamps
```

*Queue Statistics:*
```bash
GET /api/queue/stats
# Returns: waiting, active, completed, failed, delayed counts
```

*Queue Control:*
```bash
POST /api/queue/pause    # Pause job processing
POST /api/queue/resume   # Resume job processing
POST /api/queue/clean/completed  # Clean old completed jobs
POST /api/queue/clean/failed     # Clean old failed jobs
```

**Worker Configuration:**

The queue worker runs in a separate container/process:

```bash
# Run worker locally
pnpm run worker:queue

# Docker worker service
docker-compose up queue-worker

# View worker logs
docker-compose logs -f queue-worker
```

**Job Handler Implementation:**

Each job type has its own handler in `src/modules/queue/queue.worker.ts`:

```typescript
// Example job handler
private async handleEmailSend(jobData: EmailJobData): Promise<JobResult> {
  // Simulate email sending
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    success: true,
    message: `Email sent to ${jobData.to}`,
    data: { messageId: 'msg_123', timestamp: Date.now() }
  };
}
```

**Queue Testing:**

Use the `http-docs/queue.http` file for comprehensive testing:
1. Add jobs with different types and priorities
2. Check job status and results
3. Test queue management operations
4. Monitor queue statistics

**Error Handling:**
- Failed jobs are automatically retried based on `attempts` setting
- Worker gracefully handles shutdown signals (SIGTERM, SIGINT)
- Redis connection issues are logged and handled
- Job failures include detailed error information

**Monitoring and Debugging:**
```bash
# Monitor queue worker
docker-compose logs -f queue-worker

# Check Redis queue data
docker-compose exec redis redis-cli
> KEYS bull:jobs:*
> HGETALL bull:jobs:waiting

# Queue statistics
curl http://localhost:3001/api/queue/stats
```

**Production Considerations:**
- Worker containers can be scaled independently
- Job data should be kept minimal (use references to large data)
- Set appropriate retry limits to avoid infinite loops
- Regular cleanup of old completed/failed jobs
- Monitor Redis memory usage for queue data

### Local Development

For local development without Docker:

**Prerequisites:**
- Node.js 18+ with pnpm
- MongoDB running on localhost:27017
- Redis running on localhost:6379

**Setup:**
```bash
# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env

# Edit .env with your local configuration:
# REDIS_HOST=localhost
# MONGO_URI=mongodb://admin:password@localhost:27017/boilerplate?authSource=admin

# Start local MongoDB and Redis (if not using Docker)
# Or start only database services:
docker-compose -f docker-compose.dev.yml up -d mongodb redis

# Run in development mode (with Swagger and hot reload)
pnpm run dev
```

**Available Scripts:**
```bash
pnpm dev       # Development with hot reload and Swagger
pnpm build     # Build for production
pnpm start     # Run production build
```

### Project Structure

```
src/
├── app.ts                    # Main application configuration
├── server.ts                 # Server initialization
├── infraestructure/
│   ├── cache/               # Redis cache system
│   │   ├── redis.connection.ts    # Redis connection singleton
│   │   ├── cache.manager.ts       # Cache operations manager
│   │   ├── cache.plugin.ts        # Fastify cache plugin
│   │   └── index.ts               # Cache exports
│   ├── mongo/               # MongoDB connection and repository
│   └── server/              # Fastify configurations
├── entities/                # Entity schemas
├── modules/                 # Business modules
│   ├── auth/               # Authentication system with RBAC
│   ├── health/             # Health check endpoints
│   └── queue/              # BullMQ job queue system
│       ├── queue.types.ts       # Job types and interfaces
│       ├── queue.manager.ts     # Queue management operations
│       ├── queue.worker.ts      # Background worker process
│       ├── queue.controller.ts  # Queue API endpoints
│       └── queue.plugin.ts      # Fastify queue plugin
├── lib/                    # Utilities and helpers
└── http-docs/              # HTTP test files
    ├── auth.http          # Authentication tests
    ├── queue.http         # Queue system tests
    └── cache.http         # Cache testing examples
```

### Security

The project includes multiple security layers:

- Strict validations in schemas
- Input sanitization
- Protection against injections
- JWT authentication with RBAC (Role-Based Access Control)
- HTTPS required in production
- User-scoped caching for authenticated routes

For more details about security, see the `PlanTask.chatmode.md` file.

## 🔧 Troubleshooting

### Queue Worker Issues

If you see queue processing problems:

```bash
# Check queue worker status
docker-compose -f docker-compose.dev.yml ps queue-worker

# View queue worker logs
docker-compose -f docker-compose.dev.yml logs -f queue-worker

# Restart queue worker
docker-compose -f docker-compose.dev.yml restart queue-worker

# Check queue statistics
curl http://localhost:3001/api/queue/stats

# Monitor Redis queue data
docker-compose -f docker-compose.dev.yml exec redis redis-cli
```

**Common Queue Issues:**
- **Worker not processing jobs**: Check if worker container is running
- **Jobs stuck in waiting**: Verify Redis connection and worker status  
- **High failed job count**: Review job handler logic and retry settings
- **Memory issues**: Clean old jobs regularly and monitor Redis usage

### Redis Connection Issues

If you see Redis connection errors:

```bash
# Check if Redis is running
docker-compose -f docker-compose.dev.yml ps

# View Redis logs
docker-compose -f docker-compose.dev.yml logs redis

# Restart Redis service
docker-compose -f docker-compose.dev.yml restart redis
```

**Common Redis errors:**
- `ECONNREFUSED`: Redis is not running or wrong host/port
- `ENOTFOUND`: DNS resolution failed (check REDIS_HOST)
- `Authentication failed`: Check REDIS_PASSWORD if using auth

**Fallback behavior:**
- Application continues working even if Redis is unavailable
- Cache operations fail gracefully with error logs
- No caching occurs when Redis is down

### MongoDB Connection Issues

```bash
# Check MongoDB status
docker-compose -f docker-compose.dev.yml logs mongodb

# Reset MongoDB data
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d mongodb
```

### Application Logs

```bash
# Follow application logs
docker-compose -f docker-compose.dev.yml logs -f app

# Check all services
docker-compose -f docker-compose.dev.yml logs
```

## 📈 Monitoring

- **Health endpoint**: `GET /health` - Application status
- **Cache headers**: `X-Cache: HIT/MISS` in responses
- **Automatic logging**: Connection status and errors
- **Docker health checks**: All services monitored