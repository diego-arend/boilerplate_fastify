````instructions
# Boilerplate Fastify - Copilot Instructions

## Project Overview

Modern backend API boilerplate using **Fastify v5.5.0** + **TypeScript** with modular DDD architecture.

## Technologies Stack

- **Runtime**: Node.js ES Modules
- **Framework**: Fastify v5.5.0
- **Language**: TypeScript v5.9.2 (strict mode)
- **Database**: MongoDB v8.18.1 + Mongoose
- **Queue**: BullMQ v5.58.7 + Redis
- **Cache**: Redis (multi-database setup)
- **Email**: SMTP with Mailpit (development)
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
- **Queue Jobs**: Auto-contained, reusable job implementations
- **Security**: Input validation, XSS protection, strong password requirements

## Available MCP Tools & Services

This project integrates with **Model Context Protocol (MCP) servers** for enhanced development capabilities:

### **Context7 MCP Server** 🔍
- **Purpose**: Library documentation and code examples
- **Usage**: `mcp_context7_resolve-library-id` + `mcp_context7_get-library-docs`
- **Supported Libraries**: MongoDB, Fastify, BullMQ, Redis, TypeScript, Zod, JWT
- **Example**: Get up-to-date BullMQ documentation with code examples

### **Playwright MCP Server** 🎭
- **Purpose**: Web automation, testing, and browser interactions
- **Usage**: `mcp_playwright_browser_*` commands
- **Capabilities**: Navigate, click, fill forms, take screenshots, test UI
- **Use Cases**: E2E testing, web scraping, UI validation

### **When to Use MCPs**
- **Context7**: When you need current library documentation or implementation examples
- **Playwright**: For web-based testing, automation, or browser interactions
- **Best Practice**: Use MCPs for external resources, not for existing project code

## Documentation References

For implementation patterns and guidelines, refer to component-specific READMEs:

### 📁 **Core Components**
- **Entity Patterns**: `src/entities/README.md` - Entity architecture, validation patterns, repository inheritance
- **Module Structure**: `src/modules/auth/README.md` - Module organization, plugin patterns, controllers, RBAC

### 📁 **Infrastructure Components**
- **Database**: `src/infraestructure/mongo/README.md` - BaseRepository, connections, transactions
- **Server**: `src/infraestructure/server/README.md` - Fastify setup and configuration
- **Cache**: `src/infraestructure/cache/README.md` - Redis implementation and strategies
- **Queue**: `src/infraestructure/queue/README.md` - BullMQ implementation, job processing
- **Email**: `src/infraestructure/email/README.md` - SMTP configuration, template system
- **Email Templates**: `src/infraestructure/email/templates/README.md` - Template engine and rendering

### 📁 **Business Modules**
- **Authentication**: `src/modules/auth/README.md` - Complete JWT auth system with RBAC
- **Health Check**: `src/modules/health/` - System health monitoring endpoints

### 📁 **Entity Documentation**
- **Entity Architecture**: `src/entities/README.md` - Entity patterns, validation, repository inheritance
- **User Entity**: `src/entities/user/README.md` - User entity implementation example

### 📁 **Libraries & Utilities**
- **Validators**: `src/lib/validators/README.md` - Validation schemas, security patterns, Zod usage
- **Logger**: `src/lib/logger/README.md` - Structured logging configuration
- **Response**: `src/lib/response/README.md` - API response standardization, error handling
- **Auth Services**: `src/modules/auth/services/README.md` - Authentication services and utilities

### 📁 **Queue System Documentation**
- **Queue Infrastructure**: `src/infraestructure/queue/README.md` - BullMQ setup, configuration, monitoring
- **Job Implementation**: `src/infraestructure/queue/jobs/README.md` - Job patterns, testing, examples
- **Bull Dashboard**: http://localhost:3002/ui - Real-time queue monitoring

### 📁 **Quick Reference Guide**
- **New Entity**: Follow `src/entities/README.md` patterns
- **New Module**: Reference `src/modules/auth/README.md` structure
- **New Job**: Follow `src/infraestructure/queue/jobs/README.md` patterns
- **Database Operations**: Use BaseRepository patterns from `src/infraestructure/mongo/README.md`
- **Authentication**: Implement RBAC following `src/modules/auth/README.md`
- **Queue Jobs**: Create auto-contained jobs per `src/infraestructure/queue/jobs/README.md`
- **Validation**: Reuse global validators from `src/lib/validators/README.md`
- **Error Handling**: Follow `src/lib/response/README.md` patterns
- **Email Templates**: Use patterns from `src/infraestructure/email/README.md`

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

## MCP Integration Guidelines

### **Context7 Usage Examples**
```typescript
// Get library documentation
const docs = await mcp_context7_get_library_docs({
  context7CompatibleLibraryID: '/mongodb/docs',
  topic: 'aggregation pipelines'
});

// Resolve library for current tech stack
const libraryId = await mcp_context7_resolve_library_id({
  libraryName: 'bullmq'
});
```

### **Playwright Testing Examples**
```typescript
// E2E testing for authentication flows
await mcp_playwright_browser_navigate({ url: 'http://localhost:3001/auth/login' });
await mcp_playwright_browser_fill_form({
  fields: [
    { name: 'email', type: 'textbox', value: 'test@example.com' },
    { name: 'password', type: 'textbox', value: 'TestPass123!' }
  ]
});
```

### **MCP Best Practices**
- Use **Context7** for up-to-date library examples when implementing new features
- Use **Playwright** for automated testing of web interfaces (Bull Dashboard, API endpoints)
- **Prefer project documentation** over MCP for existing codebase patterns
- **Combine MCPs** with project READMEs for comprehensive understanding

## External References

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Zod Validation](https://zod.dev/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## 📚 **Development Workflow**

### **Starting New Features**
1. **Check existing documentation**: Start with relevant README.md files
2. **Use project patterns**: Follow established architectures and patterns
3. **Leverage MCPs**: Use Context7 for external library documentation, Playwright for testing
4. **Follow pnpm requirements**: Always use pnpm for package management

### **Troubleshooting & Research**
1. **Project Documentation First**: Check module-specific READMEs
2. **Context7 MCP**: For up-to-date library examples and best practices
3. **Playwright MCP**: For UI testing and web automation needs
4. **External References**: Official documentation links provided above

### **Code Quality Checklist**
- ✅ Used existing patterns from project READMEs
- ✅ Followed TypeScript strict mode requirements
- ✅ Applied security patterns (validation, sanitization)
- ✅ Used pnpm for any package operations
- ✅ Added appropriate logging and error handling
- ✅ Wrote self-contained, testable code

---

**Note**: For detailed implementation patterns, always consult the component-specific README files listed above. Use MCPs to enhance understanding with external library documentation and testing capabilities.
````
