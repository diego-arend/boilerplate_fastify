````instructions
# Boilerplate Fastify - GitHub Copilot Instructions

## Project Overview

Modern backend API boilerplate using **Fastify v5.5.0** + **TypeScript** with modular DDD architecture.

## GitHub Copilot Integration

This project is optimized for **GitHub Copilot Chat** and **Agent Mode** workflows. Use the following patterns to maximize Copilot's effectiveness:

### Chat Participants & Variables
- `@workspace` - Query entire codebase for patterns and implementations
- Chat variables `#file`, `#selection`, `#function` - Reference specific files, selected code, or current function context
- `@github` - GitHub operations (issues, PRs, repository tasks)

### Slash Commands for Development
- `/explain` - Understand existing code patterns and architecture
- `/fix` - Address issues in selected code following project patterns
- `/tests` - Generate tests using existing test patterns
- `/doc` - Add JSDoc documentation following project standards
- `/optimize` - Performance improvements maintaining architecture
- `/new` - Scaffold new components following DDD patterns

### Agent Mode Examples
```
@workspace Describe this project in detail, explaining what the various components do and how they interact.

Based on your analysis, create a focused implementation plan for adding a new documents module. Don't make any changes yet.

Create a new branch and implement the documents module according to your proposed plan. Focus on following existing patterns.
```

## Technologies Stack

**Fastify v5.5.0** + **TypeScript** (strict mode) + **MongoDB** + **BullMQ** + **Redis** + **Zod** + **JWT**
**Package Manager**: pnpm v10.13.1 *(REQUIRED - All commands must use pnpm)*

**⚠️ IMPORTANT**: Always use `pnpm` for package operations - never npm or yarn

## Architecture & Patterns

**DDD Structure**: `entities/` (schema + repository) → `modules/` (controller + plugin + services) → `infraestructure/` (DB, cache, queue) → `lib/` (shared utils)

**Key Patterns**:
- Repository inheritance from BaseRepository
- Global validators first (`src/lib/validators/`)
- Auto-contained queue jobs
- Dependency injection with factory patterns
- MongoDB transactions, Redis caching, JWT auth

## Available MCP Tools & Services

### **Context7 MCP Server** 🔍
- **Usage**: `mcp_context7_resolve-library-id` + `mcp_context7_get-library-docs`
- **Libraries**: MongoDB, Fastify, BullMQ, Redis, TypeScript, Zod, JWT
- **When**: Need current library documentation or implementation examples

### **Playwright MCP Server** 🎭
- **Usage**: `mcp_playwright_browser_*` commands
- **When**: Web testing, automation, UI validation (Bull Dashboard, admin interfaces)
- **✅ Use MCP Playwright**: For all browser testing and UI interactions
- **❌ Never Simple Browser**: Only for quick previews

## Documentation References

For implementation patterns and guidelines, refer to component-specific READMEs:

### 📁 **Core Components**
- **Entity Patterns**: `src/entities/README.md` - Entity architecture, validation patterns, repository inheritance
- **Module Structure**: `src/modules/auth/README.md` - Module organization, plugin patterns, controllers, RBAC

### 📁 **Infrastructure Components**
- **Database**: `src/infraestructure/mongo/README.md` - BaseRepository, connections, transactions
- **PostgreSQL**: `src/infraestructure/postgres/README.md` - TypeORM integration, pgvector, hybrid architecture
- **Cache**: `src/infraestructure/cache/README.md` - Redis implementation and strategies
- **Queue**: `src/infraestructure/queue/README.md` - BullMQ implementation, job processing
- **Email**: `src/infraestructure/email/README.md` - SMTP configuration, template system

### 📁 **Libraries & Utilities**
- **Validators**: `src/lib/validators/README.md` - Validation schemas, security patterns, Zod usage
- **Response**: `src/lib/response/README.md` - API response standardization, error handling

### 📁 **Quick Reference Guide**
- **New Entity**: Follow `src/entities/README.md` patterns
- **New Module**: Reference `src/modules/auth/README.md` structure
- **New Job**: Follow `src/infraestructure/queue/jobs/README.md` patterns
- **Database Operations (MongoDB)**: Use BaseRepository patterns from `src/infraestructure/mongo/README.md`
- **Database Operations (PostgreSQL)**: Use TypeORM patterns from `src/infraestructure/postgres/README.md`
- **Authentication**: Implement RBAC following `src/modules/auth/README.md`
- **Queue Jobs**: Create auto-contained jobs per `src/infraestructure/queue/jobs/README.md`
- **Validation**: Reuse global validators from `src/lib/validators/README.md`
- **Error Handling**: Follow `src/lib/response/README.md` patterns
- **Email Templates**: Use patterns from `src/infraestructure/email/README.md`

## Development Standards

### Code Quality & Efficiency
- **Keep It Simple**: Always generate the simplest, most direct solution to the problem
- **Use Existing Libraries**: ALWAYS prefer libraries already installed in package.json over adding new dependencies
- **Existing Patterns**: Follow established patterns already present in the codebase
- **No Unnecessary Abstractions**: Avoid complex patterns when simple solutions work

### Security Patterns
- **Input Validation**: XSS protection, NoSQL injection prevention
- **Authentication**: JWT with secure token handling
- **Rate Limiting**: Implemented in auth flows
- **Password Security**: Strong requirements with validation

## GitHub Copilot Chat Best Practices

### **Effective Prompting Patterns**
```markdown
# Planning Mode (No Execution)
@workspace Analyze the auth module structure and create a detailed implementation plan for a new documents module. Don't make any changes yet.

# Implementation Mode
Create a new branch and implement the documents module according to your proposed plan. Focus on following existing patterns.

# Code Review Mode
Use selection context with /explain for security patterns analysis

# Testing Mode
Use file context with /tests for comprehensive test case generation
```

### **Context Awareness Tips**
- **Start with @workspace** for architectural understanding
- **Use specific file references** for targeted assistance
- **Reference existing patterns** before creating new ones
- **Ask for planning first**, then implementation
- **Leverage MCP tools** for external documentation

### **Multi-step Development Workflow**
1. **Analysis Phase**: `@workspace` + `/explain` for understanding
2. **Planning Phase**: Create implementation plan without execution
3. **Implementation Phase**: Step-by-step development with existing patterns
4. **Testing Phase**: Use `/tests` and Playwright MCP for comprehensive testing
5. **Documentation Phase**: Use `/doc` for JSDoc and README updates

---

## 📚 **Development Workflow**

### **GitHub Copilot Integration Workflow**
1. **Architecture Understanding**: Use `@workspace` to analyze project structure and patterns
2. **Pattern Recognition**: Reference existing components with file variables and selection context
3. **Planning Phase**: Create detailed implementation plans before executing changes
4. **Implementation Phase**: Follow established patterns with Copilot assistance
5. **Testing Strategy**: Use `/tests` command and Playwright MCP for comprehensive testing
6. **Documentation**: Apply `/doc` command for JSDoc and maintain README consistency

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
- ✅ Applied GitHub Copilot best practices for context and prompting

---

## **Advanced GitHub Copilot Configuration**

### **Prompt Files Integration**
- **PlanTask.chatmode** - Planning-only mode for architectural decisions and task breakdown
- Located in project root for easy access
- Use for comprehensive planning without code execution
- Follows GitHub Copilot's agent mode patterns

### **Model Selection Guidelines**
- **Planning & Architecture**: Use higher reasoning models (Claude Sonnet 4, GPT-4)
- **Code Generation**: Balanced models work well (GPT-4.1, Claude Sonnet 3.5)
- **Quick Tasks**: Fast models for simple operations (Grok Code Fast, GPT-4 Mini)
- **Complex Analysis**: Premium models for deep codebase analysis

### **Agent Mode Best Practices**
- **Start with Analysis**: Always begin with `@workspace` for project understanding
- **Plan Before Execute**: Use planning mode for complex features
- **Iterative Development**: Break large tasks into smaller, manageable steps
- **Pattern Following**: Reference existing implementations before creating new ones
- **Testing Integration**: Include Playwright MCP for UI testing scenarios

### **Context Optimization**
- **File References**: Use specific file paths for targeted assistance
- **Selection Context**: Highlight relevant code sections for focused analysis
- **Function Context**: Leverage function-level analysis for precise improvements
- **Workspace Awareness**: Maintain architectural consistency across all changes

**Note**: For detailed implementation patterns, always consult the component-specific README files listed above. Use MCPs to enhance understanding with external library documentation and testing capabilities.
````
