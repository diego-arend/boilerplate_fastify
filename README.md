# Boilerplate Fastify

Enterprise-grade boilerplate for Fastify applications with TypeScript, MongoDB, Redis, and comprehensive infrastructure modules.

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
- **[Server Configuration](src/infraestructure/server/README.md)** - Fastify setup, plugins, and middleware configuration

### Business Modules

- **[Authentication](src/modules/auth/README.md)** - JWT authentication with RBAC, user management, and security features

### Shared Libraries

- **[Response Handler](src/lib/response/README.md)** - Standardized API responses with consistent error handling

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Server
PORT=3001
NODE_ENV=development|production
JWT_SECRET=your-jwt-secret-key

# MongoDB
MONGO_URI=mongodb://admin:password@mongodb:27017/boilerplate?authSource=admin

# Redis (Cache & Queue)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Email Configuration (Development with Mailpit)
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_SECURE=false
EMAIL_FROM=noreply@example.com
# Note: SMTP_USER and SMTP_PASS not required for Mailpit
```

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
- **Service Health**: Individual checks for MongoDB, Redis, and queue system
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
