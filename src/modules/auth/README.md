# Authentication Module

This module implements complete JWT authentication, integrated with MongoDB through the `UserAuthRepository`.

## Architecture

### Main Features
- User registration
- JWT login
- Protected routes
- User search (admin)
- Security validations
- Input sanitization
- Protection against injection

### File Structure
```
auth/
├── auth.controller.ts    # Routes and business logic
├── auth.plugin.ts        # Fastify authentication plugin
├── repository/           # Persistence layer
│   ├── userAuth.repository.ts
│   └── index.ts
├── strategy.ts           # Authentication strategy
├── command.ts            # CLI commands
└── types/                # TypeScript types
```

### Main Components

#### AuthController
Manages authentication routes:
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/me` - Authenticated user data
- `GET /auth/users` - User list (admin)

#### AuthPlugin
Fastify plugin that:
- Registers authentication hooks
- Validates JWT tokens
- Controls access based on roles
- Manages user sessions

#### UserAuthRepository
Persistence layer responsible for:
- User CRUD operations
- Search by email and ID
- Uniqueness validations
- Result pagination
- Status and role control

#### Strategy
Implements authentication strategy:
- Credential validation
- JWT token generation
- Permission verification
- Access control

### Security Validations
- **Email**: Strict regex, sanitization, duplicate verification
- **Password**: Minimum 8 characters, required complexity
- **Name**: XSS sanitization, character limit
- **Status/Role**: Validated enums
- **Injection**: Detection and blocking of attempts

### Security Layers
- Input sanitization
- Data validation
- Protection against injection
- JWT authentication
- Role-based access control
- Account status verification

## Integration
The module is integrated into the system through the main `modules.ts` and uses global database configurations and environment validation.