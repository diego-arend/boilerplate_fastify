````instructions
# Boilerplate Fastify - Copilot Instructions

## Project Overview

This is a modern boilerplate for backend APIs using **Fastify v5.5.0** with **TypeScript**, following a modular and scalable architecture. The project uses **ES Modules**, **MongoDB** as the primary database, and is ready for development with **Docker**.

## Main Technologies

- **Runtime**: Node.js with ES Modules
- **Framework**: Fastify v5.5.0 (High-performance web framework)
- **Language**: TypeScript v5.9.2 with strict configurations
- **Database**: MongoDB v8.18.1 with Mongoose
- **Validation**: Zod v4.1.5 for schemas and data validation
- **Authentication**: JWT (jsonwebtoken v9.0.2)
- **Package Management**: pnpm v10.13.1
- **Development**: tsx v4.19.1 for hot reload
- **Containerization**: Docker + Docker Compose

## Architectural Structure

### Main Directories

```
src/
├── app.ts                    # Main application plugin
├── server.ts                 # Server entry point
├── entities/                 # Domain entities (optional)
├── infraestructure/          # Infrastructure layer
│   ├── mongo/               # MongoDB connection and configurations
│   │   ├── connection.ts    # MongoDB connection singleton
│   │   └── connection.test.ts
│   └── server/              # Server configurations
│       ├── fastify.config.ts # Fastify configuration (logger, etc.)
│       ├── fastify.d.ts     # Custom Fastify types
│       └── modules.ts       # Module registration system
├── lib/                     # Shared utilities and libraries
│   └── validateEnv.ts       # Environment variable validation with Zod
└── modules/                 # Domain modules (DDD)
    └── auth/                # Authentication module
        ├── auth.controller.ts    # Controllers and routes
        ├── auth.plugin.ts        # Module Fastify plugin
        ├── repository/           # Persistence layer
        │   ├── userAuth.repository.ts
        │   └── index.ts
        ├── strategy.ts           # Authentication strategies
        ├── command.ts            # CLI commands (optional)
        ├── types/                # Module-specific types
        │   └── auth.d.ts
        └── README.md             # Module documentation
```

### Configuration Files (Root)

- **package.json**: npm/pnpm scripts, dependencies and metadata
- **tsconfig.json**: TypeScript configuration with NodeNext and ESNext
- **fastify.config.ts**: Global Fastify configurations (logger, etc.)
- **docker-compose.yml**: Production orchestration
- **docker-compose.dev.yml**: Development environment
- **Dockerfile**: Production image
- **Dockerfile.dev**: Development-optimized image

## Development Patterns

### Modular Architecture (DDD)
- Each business domain in its own module
- Clear separation between controllers, repositories and business logic
- Fastify plugins for isolation and reusability
- Automatic module registration system

### Configuration and Environment
- Strict environment variable validation with Zod
- Immutable configuration via `Object.freeze()`
- Global `fastify.config` decorator for configuration access
- Multi-environment support (dev, prod, test)

### Modern Development
- **Hot Reload**: tsx for development with automatic reloading
- **ES Modules**: Native Node.js import/export
- **TypeScript Strict**: Rigorous typing configurations
- **Docker Development**: Isolated and consistent environment

### Security and Quality
- Input sanitization with Zod
- Compile-time type validation
- JWT authentication with refresh tokens
- Structured logging with Pino
- Automatic health checks

## Documentation and Comments

### Comment Standards
- **Language**: All comments must be written in **English**
- **Format**: Use **JSDoc** for structured documentation
- **Coverage**: All logic files must have adequate comments
- **Consistency**: Follow established patterns throughout the project
- **Example Files**: **DO NOT** create example files (examples.ts, examples.js) at the end of implementations. Documentation should be included directly in main files or in specific README.md files.

### Mandatory JSDoc Structure
```typescript
/**
 * Brief description of what the function/class does
 * @param {Type} paramName - Description of parameter
 * @returns {Type} Description of return value
 * @throws {ErrorType} Description of thrown errors
 */
```

### Documentation Examples
```typescript
/**
 * Validates user email format and security requirements
 * @param {string} email - The email address to validate
 * @returns {boolean} True if email is valid and secure
 * @throws {Error} If email format is invalid
 */
static isValidEmail(email: string): boolean {
  // Implementation here
}

/**
 * User authentication repository
 * Handles all database operations related to user authentication
 */
export class AuthRepository extends BaseRepository<IUser> {
  /**
   * Find user by email for authentication purposes
   * @param {string} email - User's email address
   * @returns {Promise<IUser | null>} User object or null if not found
   */
  async findByEmail(email: string): Promise<IUser | null> {
    // Implementation here
  }
}
```

### Types of Comments
- **JSDoc Functions**: For all public functions and methods
- **Class Documentation**: For all classes and interfaces
- **Inline Comments**: For complex logic (in English)
- **TODO/FIXME**: For future improvements (in English)
- **Error Messages**: All messages must be in English

## Available Scripts

```bash
# Development
pnpm dev                    # Start server with hot reload
pnpm build                  # Compile TypeScript to JavaScript
pnpm start                  # Run compiled version

# Docker
pnpm docker:dev            # Start development containers
pnpm docker:dev:down       # Stop development containers
pnpm docker:prod           # Start production containers
pnpm docker:prod:down      # Stop production containers
pnpm docker:logs           # View container logs
pnpm docker:build          # Build Docker image
```

## Technical Configurations

### TypeScript (tsconfig.json)
- **Module Resolution**: NodeNext for ES Modules compatibility
- **Target**: ESNext for modern features
- **Strict Mode**: Enabled with rigorous validations
- **Source Maps**: For development debugging
- **Declaration Files**: Automatic type generation

### Fastify Configuration
- **Logger**: Pino with pretty printing in development
- **Plugins**: Modular plugin system
- **Hooks**: Lifecycle hooks for initialization and shutdown
- **Decorators**: Custom Fastify instance extensions

### MongoDB Integration
- **Connection**: Singleton pattern for single connection
- **Mongoose**: ODM for data modeling
- **Graceful Shutdown**: Automatic disconnection on termination
- **Health Checks**: Automatic connectivity verification

## Implemented Best Practices

### Code
- **TypeScript Strict**: Zero any, explicit types
- **ESLint/Prettier**: Code standardization (configure if needed)
- **Error Handling**: Consistent error treatment
- **Logging**: Structured logs at all levels

### Security
- **Input Validation**: Zod schemas for all inputs
- **JWT Authentication**: Secure tokens with expiration
- **Environment Variables**: Strict config validation
- **CORS**: Proper API configuration

### Performance
- **Fastify**: Performance-optimized framework
- **Connection Pooling**: MongoDB with connection pool
- **Caching**: Ready for Redis (container available)
- **Health Checks**: Continuous health monitoring

## Docker Development

### Development Environment
- **Hot Reload**: Automatic reloading without restart
- **Volume Mounting**: Real-time code synchronization
- **Debugging**: Debug port exposed
- **Dependencies**: Optimized cache for fast rebuilds

### Production
- **Multi-stage Build**: Optimized and lightweight image
- **Security**: Non-root user in production
- **Health Checks**: Automatic health verifications
- **Logging**: Production-appropriate configuration

## Extensions and Tools

### Recommended VS Code Extensions
- **TypeScript Importer**: Intelligent auto-import
- **Prettier**: Automatic formatting
- **ESLint**: Linting and automatic correction
- **Docker**: Complete container support

### Testing and Route Verification
- **Playwright MCP**: For route verification and HTTP testing interactions, use the Playwright MCP (Model Context Protocol). This server allows executing automated API tests, verifying endpoints and validating HTTP responses programmatically and integrated with the development environment.

### Development Dependencies
- **tsx**: TypeScript execution with hot reload
- **@types/node**: Types for Node.js
- **@types/jsonwebtoken**: Types for JWT

## Next Steps and Expansion

### Planned Features
- Redis cache system
- Rate limiting and DDoS protection
- Automatic API documentation
- Automated testing (Jest/Vitest)
- CI/CD pipeline
- Monitoring and observability

### Structure for New Modules
1. Create directory in `src/modules/`
2. Implement controller, plugin and repository
3. Register in `app.ts` via `registerModule()`
4. Add specific types if needed
5. Document in module README

## References and Documentation

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Zod Validation](https://zod.dev/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Note**: This boilerplate follows current best practices for Node.js/TypeScript development, focusing on performance, security and maintainability.
