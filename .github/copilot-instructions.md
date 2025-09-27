````instructions
# Boilerplate Fastify - Copilot Instructions

## Project Overview

Modern backend API boilerplate using **Fastify v5.5.0** + **TypeScript** with modular DDD architecture.

## Technologies Stack

- **Runtime**: Node.js ES Modules
- **Framework**: Fastify v5.5.0
- **Language**: TypeScript v5.9.2 (strict mode)
- **Database**: MongoDB v8.18.1 + Mongoose
- **Validation**: Zod v4.1.5
- **Authentication**: JWT (jsonwebtoken v9.0.2)
- **Package Manager**: pnpm v10.13.1 *(REQUIRED - All commands must use pnpm)*
- **Development**: tsx v4.19.1, Docker + Docker Compose

## Package Management

**⚠️ IMPORTANT**: This project uses **pnpm** as the official package manager. All dependency commands must be executed with `pnpm`:

```bash
# ✅ Correct commands
pnpm install           # Install dependencies
pnpm add <package>     # Add new dependency
pnpm remove <package>  # Remove dependency
pnpm run dev          # Run development server
pnpm run build        # Build project
pnpm run test         # Run tests

# ❌ Do NOT use npm or yarn
npm install   # Wrong!
yarn add      # Wrong!
```

## Architecture & Structure

**Domain-Driven Design (DDD)** with modular architecture:

```
src/
├── entities/               # Domain entities (schema + repository)
├── modules/               # Business domains (controller + plugin + services)
├── infraestructure/       # Database, cache, queue, server config
└── lib/                  # Shared utilities (validators, logger, response)
```

## Best Practices & Patterns

- **Repository Inheritance**: All repositories extend BaseRepository
- **Global Validators First**: Reuse from `src/lib/validators/` before creating new ones
- **Modular DDD**: Clean separation of business domains
- **Transaction Support**: MongoDB sessions across operations
- **Dependency Injection**: ICacheService for caching, factory patterns
- **Security**: Input validation, XSS protection, strong password requirements

## Documentation References

For implementation patterns and guidelines, refer to component-specific READMEs:

### 📁 **Core Components**
- **Entity Patterns**: `src/entities/README.md` - Entity architecture, validation patterns, repository inheritance
- **Module Structure**: `src/modules/auth/README.md` - Module organization, plugin patterns, controllers

### 📁 **Infrastructure**
- **Database**: `src/infraestructure/mongo/README.md` - BaseRepository, connections, transactions
- **Server**: `src/infraestructure/server/README.md` - Fastify setup and configuration
- **Cache**: `src/infraestructure/cache/README.md` - Redis implementation and strategies
- **Queue**: `src/infraestructure/queue/README.md` - Job processing and Bull integration

### 📁 **Libraries & Utilities**
- **Validators**: `src/lib/validators/README.md` - Validation schemas, security patterns, Zod usage
- **Logger**: `src/lib/logger/README.md` - Structured logging configuration
- **Response**: `src/lib/response/README.md` - API response standardization, error handling
- **Services**: `src/modules/auth/services/README.md` - Authentication services and utilities

### 📁 **Quick Reference**
- **New Entity**: Follow `src/entities/README.md` patterns
- **New Module**: Reference `src/modules/auth/README.md` structure
- **Database Operations**: Use BaseRepository patterns from `src/infraestructure/mongo/README.md`
- **Validation**: Reuse global validators from `src/lib/validators/README.md`
- **Error Handling**: Follow `src/lib/response/README.md` patterns

## Development Standards

### Package Manager Requirements
- **ALWAYS use pnpm**: Never use npm or yarn commands
- **Lock file**: pnpm-lock.yaml must be committed
- **Scripts**: All package.json scripts should be run with `pnpm run <script>`

### Code Quality & Comments
- **Language**: All comments in English with JSDoc format
- **TypeScript**: Strict mode enabled, ES Modules
- **Architecture**: Modular DDD with clean domain boundaries

### Code Simplicity & Efficiency
- **Keep It Simple**: Always generate the simplest, most direct solution to the problem
- **Use Existing Libraries**: ALWAYS prefer libraries already installed in package.json over adding new dependencies
- **Minimal Code**: Write concise, readable code that solves the problem without over-engineering
- **Existing Patterns**: Follow established patterns already present in the codebase
- **No Unnecessary Abstractions**: Avoid complex patterns when simple solutions work

### Security Patterns
- **Input Validation**: XSS protection, NoSQL injection prevention
- **Authentication**: JWT with secure token handling
- **Rate Limiting**: Implemented in auth flows
- **Password Security**: Strong requirements with validation

## External References

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Zod Validation](https://zod.dev/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Note**: For detailed implementation patterns, always consult the component-specific README files listed above.
````
