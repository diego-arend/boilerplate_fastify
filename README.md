# Boilerplate Fastify

Boilerplate for Fastify applications with TypeScript, MongoDB and Redis.

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
- `src/lib/response/README.md` - ApiResponseHandler class documentation

### Main Endpoints

**Health Check:**
- `GET /health` - Application status

**Authentication:**
- `POST /auth/register` - User registration
- `POST /auth/login` - Login and JWT token retrieval
- `GET /auth/me` - Authenticated user profile (requires token)

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

- `PORT=3001`
- `MONGO_URI=mongodb://admin:password@mongodb:27017/boilerplate?authSource=admin`
- `JWT_SECRET` (configured in docker-compose)
- `NODE_ENV=production` (or development)

### Local Development

For local development without Docker:

```bash
# Install dependencies
pnpm install

# Run in development mode (with Swagger)
pnpm run dev

# Build for production
pnpm run build

# Run in production (without Swagger)
pnpm run start
```

### Project Structure

```
src/
├── app.ts                 # Main application configuration
├── server.ts             # Server initialization
├── infraestructure/
│   ├── mongo/           # MongoDB connection and repository
│   └── server/          # Fastify configurations
├── entities/            # Entity schemas
├── modules/             # Business modules
└── lib/                 # Utilities
```

### Security

The project includes multiple security layers:

- Strict validations in schemas
- Input sanitization
- Protection against injections
- JWT authentication
- HTTPS required in production

For more details about security, see the `PlanTask.chatmode.md` file.