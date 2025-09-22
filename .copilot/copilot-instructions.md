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
├── entities/                 # Domain entities (standardized structure)
│   └── {entityName}/        # Entity-specific directory
│       ├── {entityName}Entity.ts    # Schema, model, interface & validations
│       ├── {entityName}Repository.ts # Repository extending BaseRepository
│       └── index.ts         # Entity exports
├── infraestructure/          # Infrastructure layer
│   ├── mongo/               # MongoDB connection and configurations
│   │   ├── connection.ts    # MongoDB connection singleton
│   │   ├── baseRepository.ts # Generic repository with CRUD operations
│   │   └── index.ts         # Infrastructure exports
│   └── server/              # Server configurations
│       ├── fastify.config.ts # Fastify configuration (logger, etc.)
│       ├── fastify.d.ts     # Custom Fastify types
│       └── modules.ts       # Module registration system
├── lib/                     # Shared utilities and libraries
│   ├── validateEnv.ts       # Environment variable validation with Zod
│   └── validators/          # Global validation schemas
│       ├── globalValidators.ts # Shared validation schemas (email, password, etc.)
│       └── index.ts         # Validators exports
└── modules/                 # Domain modules (DDD)
    └── {moduleName}/        # Business domain module
        ├── {module}.controller.ts    # Controllers and routes
        ├── {module}.plugin.ts        # Module Fastify plugin
        ├── repository/               # Persistence layer
        │   ├── {module}.repository.ts # Repository extending from entities
        │   └── index.ts
        ├── strategy.ts               # Authentication strategies (if needed)
        ├── command.ts                # CLI commands (optional)
        ├── types/                    # Module-specific types
        │   └── {module}.d.ts
        └── README.md                 # Module documentation
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

### Architecture Overview
This project follows a modular Domain-Driven Design (DDD) architecture with standardized entity and repository patterns.

#### Key Components
- **Entities**: Domain entities with standardized structure (`src/entities/`)
- **Modules**: Business domains with controllers, plugins, and repositories (`src/modules/`)
- **Infrastructure**: Database connections and base repository (`src/infraestructure/`)
- **Global Validators**: Shared validation schemas (`src/lib/validators/`)

#### Documentation Structure
For detailed implementation patterns and guidelines, refer to specific README files:

- **📁 Entity Patterns**: `src/entities/README.md` - Complete entity architecture, validation patterns, and repository inheritance rules
- **📁 Module Structure**: `src/modules/auth/README.md` - Module organization, plugin patterns, and controller guidelines  
- **📁 Infrastructure**: 
  - `src/infraestructure/mongo/README.md` - Database connection, BaseRepository operations, and transaction management
  - `src/infraestructure/server/README.md` - Server configuration and Fastify setup
  - `src/infraestructure/cache/README.md` - Cache implementation and strategies
  - `src/infraestructure/queue/README.md` - Queue system and job processing
- **📁 Libraries**:
  - `src/lib/validators/README.md` - Validation schemas, security patterns, and Zod usage
  - `src/lib/logger/README.md` - Logging configuration and structured logging patterns
  - `src/lib/response/README.md` - API response standardization and error handling
- **📁 Services**: `src/modules/auth/services/README.md` - Authentication services and utilities

#### Quick Reference
- **New Entity**: Follow patterns in `src/entities/README.md`
- **New Module**: Reference `src/modules/auth/README.md` as example
- **Database Operations**: Use BaseRepository patterns from `src/infraestructure/mongo/README.md`
- **Validation**: Use global validators documented in `src/lib/validators/README.md`
- **Error Handling**: Follow patterns in `src/lib/response/README.md`

#### Key Architectural Principles
For detailed patterns and implementation guidelines, see component-specific READMEs:
- **Modular DDD Architecture**: Domain separation with clean boundaries
- **Repository Inheritance**: All repositories extend BaseRepository
- **Global Validators First**: Reuse before creating entity-specific validations
- **Transaction Support**: MongoDB sessions across all operations

## Documentation and Comments

### Comment Standards
- **Language**: All comments in **English**
- **Format**: JSDoc for structured documentation
- **Coverage**: Document all public APIs and complex logic
- **Consistency**: Follow established patterns
- **No Example Files**: Documentation in main files or READMEs only

For detailed comment standards and examples, see main project `README.md`.

## Available Scripts

See `package.json` and main `README.md` for complete script documentation including development, build, and Docker commands.

## Technical Configurations

### Configuration Details
For detailed technical configurations, refer to specific documentation:
- **TypeScript**: See `tsconfig.json` and project setup in main `README.md`
- **Fastify Configuration**: See `src/infraestructure/server/README.md`
- **MongoDB Integration**: See `src/infraestructure/mongo/README.md`
- **Environment Variables**: See `src/lib/validateEnv.ts` and main `README.md`

## Implemented Best Practices

### Development Standards
All development practices and patterns are documented in component-specific READMEs:
- **Code Quality**: TypeScript strict mode, linting patterns in main `README.md`
- **Security**: Input validation patterns in `src/lib/validators/README.md`
- **Performance**: Database and caching strategies in `src/infraestructure/*/README.md`
- **Error Handling**: Standardized patterns in `src/lib/response/README.md`
- **Logging**: Structured logging in `src/lib/logger/README.md`

## Docker Development

### Container Configuration
- **Development**: See `docker-compose.dev.yml` and main `README.md`
- **Production**: See `docker-compose.yml` and `Dockerfile`
- **Services**: Individual service configurations documented in respective infrastructure READMEs

## Extensions and Tools

### Development Tools
For complete tool configuration and recommendations:
- **VS Code Extensions**: See main `README.md` for recommended extensions
- **Development Dependencies**: See `package.json` and main project documentation

### Model Context Protocol (MCP) Servers
This project benefits from MCP servers integration for enhanced development workflow. See main `README.md` for detailed integration guidelines and usage patterns.

## Next Steps and Expansion

### Project Evolution
For information about planned features, roadmap, and expansion guidelines, see the main `README.md`.

### Development Workflow
When creating new components, always refer to the appropriate README:
- **New Module**: Use `src/modules/auth/README.md` as reference
- **New Entity**: Follow patterns in `src/entities/README.md`
- **New Infrastructure Component**: Reference existing patterns in `src/infraestructure/*/README.md`

## References and Documentation

### Internal Documentation
All implementation details are documented in component-specific READMEs throughout the project structure.

### External References
- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Zod Validation](https://zod.dev/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Note**: This boilerplate follows current best practices for Node.js/TypeScript development. For detailed implementation patterns, always refer to the specific README files in each component directory.
