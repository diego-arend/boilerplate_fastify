# Boilerplate Fastify

Boilerplate for Fastify applications with TypeScript, MongoDB and Redis cache system.

## ✨ Features

- **FastifyJS**: High-performance web framework
- **TypeScript**: Type-safe development
- **MongoDB**: Database with Mongoose ODM
- **Redis Cache**: In-memory caching system
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
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379
- **Swagger UI** (development): http://localhost:3001/docs

### Useful Commands

```bash
# View application logs
docker-compose logs app

# View all services logs
docker-compose logs

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Execute commands in the application container
docker-compose exec app sh

# Check services status
docker-compose ps
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

**Cache Testing:**
- Use `http-docs/cache.http` for cache hit/miss testing
- Headers `X-Cache`, `X-Cache-Key`, `X-Cache-TTL` for debugging

All endpoints are documented in Swagger UI with complete schemas and usage examples.

### Development Scripts

```bash
# Run in development mode (with Swagger)
pnpm dev

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
│   └── health/             # Health check endpoints
├── lib/                    # Utilities and helpers
└── http-docs/              # HTTP test files
    ├── auth.http          # Authentication tests
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