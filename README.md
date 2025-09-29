# Boilerplate Fastify

Enterprise-grade boilerplate for Fastify applications with TypeScript, MongoDB, Redis, and comprehensi*Development tools are automatically started with `docker-compose.dev.yml`*

## 🐳 Docker Configuration

### Dockerfile Architecture

The project uses a strategic Docker setup optimized for both development and production environments:

#### **Dockerfile.api** - Production API Container

- **Purpose**: Optimized production build for API server
- **Target**: Web API serving with minimal footprint
- **Usage**: `docker-compose.yml` (production)
- **Features**: Multi-stage build, security optimizations, minimal dependencies

#### **Dockerfile.dev** - Shared Development Base

- **Purpose**: Universal development container for both API and Worker
- **Target**: Development environment with hot-reload and debugging
- **Usage**: `docker-compose.dev.yml` for both `app` and `worker-dev` services
- **Command Override**: Differentiated by startup commands:
  - API: `pnpm run dev` (serves HTTP endpoints)
  - Worker: `pnpm run worker:dev` (processes background jobs)
- **Features**: TypeScript compilation, file watching, development tooling

#### **Dockerfile.worker** - Production Worker Container

- **Purpose**: Optimized production build for background job processing
- **Target**: Queue processing with efficient resource usage
- **Usage**: `docker-compose.yml` (production)
- **Features**: Dedicated worker processes, queue-focused optimizations

### Docker-Compose Strategy

```bash
# Development (shared Dockerfile.dev)
docker-compose -f docker-compose.dev.yml up

# Production (dedicated Dockerfiles)
docker-compose up --build
```

**Key Benefits:**

- **Development Efficiency**: Single `Dockerfile.dev` reduces maintenance overhead
- **Production Optimization**: Specialized containers for API vs Worker workloads
- **Resource Scaling**: Independent scaling of web serving vs job processing
- **Deployment Flexibility**: Separate concerns allow targeted deployments

## 📚 Module Documentationinfrastructure modules.

## 🏗️ Architecture Overview

This project implements a **modular, scalable architecture** designed for enterprise applications:

- **API Layer**: High-performance Fastify server with TypeScript
- **Data Layer**: MongoDB with Mongoose ODM and repository pattern
- **Caching Layer**: Redis-based caching system with automatic management
- **Queue System**: BullMQ for background job processing with worker containers
- **Authentication**: JWT-based auth with Role-Based Access Control (RBAC)
- **Infrastructure**: Modular components with health monitoring and error handling

## 🚀 Technology Stack

### Core Technologies

- **[Fastify](https://fastify.dev/)** - High-performance web framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[MongoDB](https://www.mongodb.com/)** - NoSQL database with Mongoose ODM
- **[Redis](https://redis.io/)** - In-memory data store for caching and queues

### Infrastructure

- **[BullMQ](https://bullmq.io/)** - Background job processing and queue management
- **[Docker](https://www.docker.com/)** - Containerization for development and production
- **[JWT](https://jwt.io/)** - Secure authentication with role-based access
- **[Swagger/OpenAPI](https://swagger.io/)** - Interactive API documentation (development only)

### Development Tools

- **[pnpm](https://pnpm.io/)** - Fast, disk space efficient package manager
- **[Zod](https://zod.dev/)** - TypeScript-first schema validation
- **[ESLint](https://eslint.org/)** - Code linting and quality
- **[Prettier](https://prettier.io/)** - Code formatting

## 📁 Project Structure

```
src/
├── app.ts                    # Main application setup
├── server.ts                 # Server initialization
├── infraestructure/          # Infrastructure modules
│   ├── cache/               # Redis caching system → See cache/README.md
│   ├── mongo/               # MongoDB integration → See mongo/README.md
│   ├── queue/               # BullMQ queue system → See queue/README.md
│   └── server/              # Fastify configurations → See server/README.md
├── entities/                # Database entities and models
├── modules/                 # Business logic modules
│   ├── auth/               # Authentication & RBAC → See auth/README.md
│   └── health/             # Health check endpoints
├── lib/                    # Shared utilities and helpers
└── http-docs/              # HTTP test files and examples
```

```text
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────┐
│ API Container       │ │ Worker Container    │ │ Shared Services │
│                     │ │                     │ │                 │
│ ┌─────────────────┐ │ │ ┌─────────────────┐ │ │ ┌─────────┐     │
│ │ Fastify Server  │ │ │ │ Standalone      │ │ │ │ Redis   │     │
│ │ + Queue Plugin  │ │ │ │ QueueManager    │ │ │ │ (db0+1) │     │
│ │ (Publisher)     │ │ │ │ (Consumer)      │ │ │ └─────────┘     │
│ └─────────────────┘ │ │ └─────────────────┘ │ │                 │
│ ┌─────────────────┐ │ │ ┌─────────────────┐ │ │ ┌─────────┐     │
│ │ MongoFactory    │ │ │ │ MongoFactory    │ │ │ │ MongoDB │     │
│ │ CacheFactory    │ │ │ │ CacheFactory    │ │ │ │         │     │
│ └─────────────────┘ │ │ └─────────────────┘ │ │ └─────────┘     │
└─────────────────────┘ └─────────────────────┘ └─────────────────┘
```

## 🏃‍♂️ Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ with pnpm (for local development)

### Development Environment

```bash
# Start all services with hot reload
docker-compose -f docker-compose.dev.yml up --build

# Or run in background
docker-compose -f docker-compose.dev.yml up -d --build
```

### Production Environment

```bash
# Start production services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

### Available Services & Development Tools

#### Core Services

- **API Server**: http://localhost:3001 - Main Fastify application
- **Queue Worker**: Background job processing container
- **MongoDB**: localhost:27017 (admin/password)
- **Redis**: localhost:6379 (shared by cache and queue)

#### Development & Testing Tools

- **Swagger UI**: http://localhost:3001/docs - Interactive API documentation and endpoint testing (development only)
- **BullMQ Dashboard**: http://localhost:3002/ui - Queue monitoring, job management, and performance metrics
  - Real-time job monitoring and statistics
  - Failed job inspection and retry functionality
  - Job search and filtering capabilities
  - Worker status and health monitoring
- **MailPit (Email Testing)**:
  - SMTP Server: localhost:1025 (for application email sending)
  - Web Dashboard: http://localhost:8025 - Email testing and debugging interface
  - Catches all emails sent by the application
  - Web interface for email inspection (HTML/text)
  - Attachment preview and email organization
  - Safe testing environment (no actual email delivery)

_Development tools are automatically started with `docker-compose.dev.yml`_

## �📚 Module Documentation

Each infrastructure module has comprehensive documentation with implementation details, examples, and best practices:

### Core Infrastructure

- **[Cache System](src/infraestructure/cache/README.md)** - Redis-based automatic caching with TTL, user-scoped keys, and graceful fallback
- **[MongoDB Integration](src/infraestructure/mongo/README.md)** - Connection management, repository pattern, atomic transactions, and database operations
- **[Queue System](src/infraestructure/queue/README.md)** - Enterprise-grade job processing with Dead Letter Queue and resilient manager
- **[Worker System](src/infraestructure/workers/README.md)** - Standalone worker containers for background job processing with independent scaling
- **[Server Configuration](src/infraestructure/server/README.md)** - Fastify setup, plugins, and middleware configuration

## 🛠️ Development Commands

```bash
# Local development (with hot reload and Swagger)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run queue worker separately
pnpm worker:queue

# Docker commands
docker-compose -f docker-compose.dev.yml up --build  # Development
docker-compose up --build                            # Production
docker-compose down                                   # Stop services
docker-compose logs -f app                           # View app logs
```

## 🏥 Health Monitoring

The application includes comprehensive health checks:

- **Application Health**: `GET /health` - Overall application status
- **Docker Health Checks**: Automatic container monitoring
- **Graceful Shutdown**: Proper cleanup of connections and resources

## 📊 API Documentation

### Documentation Resources

- **Interactive API Documentation**: Available via Swagger UI (see Services & Tools section above)
- **HTTP Tests**: `http-docs/` directory with example requests
- **OpenAPI 3.0**: Complete API specification with schemas

### Main API Endpoints

- **Health**: `GET /health` - Application and services status
- **Authentication**: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- **Cache Testing**: Available through HTTP test files

_For detailed endpoint documentation and usage examples, see the module-specific README files._

## 🔐 Security Features

- **JWT Authentication** with role-based access control (RBAC)
- **Input Validation** using Zod schemas with TypeScript integration
- **SQL Injection Protection** through Mongoose ODM
- **XSS Prevention** with input sanitization
- **Password Security** with bcrypt hashing
- **Rate Limiting** and security headers in production

_For detailed security implementation, see [Authentication README](src/modules/auth/README.md)_

## 🚀 Production Deployment

### Docker Production Setup

- **Multi-stage builds** for optimized container images
- **Health checks** for all services with automatic restart policies
- **Volume persistence** for MongoDB and Redis data
- **Environment-based configuration** for different deployment stages
- **Graceful shutdown** handling for zero-downtime deployments

### Scaling Considerations

- **Queue workers** can be scaled independently
- **Redis clustering** support for high availability
- **MongoDB replica sets** for data redundancy
- **Load balancer ready** with health check endpoints

## 🔧 Troubleshooting

### Service Issues

```bash
# Check all services status
docker-compose ps

# View logs for specific service
docker-compose logs -f [service-name]

# Restart specific service
docker-compose restart [service-name]

# Reset all data (⚠️ destructive)
docker-compose down -v
```

### Common Issues

- **Redis Connection**: Check if Redis service is running and accessible
- **MongoDB Connection**: Verify MongoDB service status and credentials
- **Queue Processing**: Ensure queue worker container is running
- **Email Testing**: Use MailHog dashboard (http://localhost:8025) to verify email delivery
- **Queue Monitoring**: Use BullMQ dashboard (http://localhost:3002/ui) to debug job processing
- **Port Conflicts**: Make sure ports 3001, 3002, 8025, 27017, 6379 are available

_For detailed troubleshooting guides, refer to the specific module README files._

## 📈 Performance & Monitoring

- **Automatic Caching**: GET requests cached with configurable TTL
- **Background Processing**: CPU-intensive tasks handled by queue workers
- **Connection Pooling**: Optimized database and Redis connections
- **Resource Monitoring**: Built-in health checks and logging
- **Graceful Degradation**: Services continue operating when dependencies fail

_For performance optimization details, see individual module documentation._

---

**This boilerplate provides a solid foundation for building scalable, production-ready applications with modern technologies and enterprise-grade infrastructure.**
