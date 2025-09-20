# Módulo de Autenticação

Este módulo implementa autenticação completa com JWT, integrado ao MongoDB através do `UserAuthRepository`.

## Funcionalidades

- ✅ Registro de usuários
- ✅ Login com JWT
- ✅ Rotas protegidas
- ✅ Busca de usuários (admin)
- ✅ Validações de segurança
- ✅ Sanitização de entrada
- ✅ Proteção contra injeção

## Estrutura

```
auth/
├── auth.controller.ts    # Rotas e lógica de negócio
├── auth.plugin.ts        # Plugin Fastify de autenticação
├── repository/           # Repositório específico
│   ├── userAuth.repository.ts
│   └── index.ts
├── strategy.ts           # Estratégia de autenticação
├── command.ts            # Comandos CLI
└── types/                # Tipos TypeScript
```

## API Endpoints

### POST /auth/register
Registra um novo usuário.

**Request:**
```json
{
  "name": "João Silva",
  "email": "joao@example.com",
  "password": "MinhaSenha123!"
}
```

**Response:**
```json
{
  "user": {
    "id": "...",
    "name": "João Silva",
    "email": "joao@example.com",
    "role": "user",
    "status": "active"
  },
  "token": "jwt_token_here"
}
```

### POST /auth/login
Faz login do usuário.

**Request:**
```json
{
  "email": "joao@example.com",
  "password": "MinhaSenha123!"
}
```

### GET /auth/me
Retorna dados do usuário autenticado.

**Headers:**
```
Authorization: Bearer jwt_token_here
```

### GET /auth/users (Admin only)
Lista usuários com paginação.

**Query Parameters:**
- `page`: Página (padrão: 1)
- `limit`: Itens por página (padrão: 10)
- `status`: Filtrar por status
- `role`: Filtrar por role

## UserAuthRepository

### Métodos Principais

```typescript
import { UserAuthRepository } from './modules/auth/repository/index.js';

const userRepo = new UserAuthRepository();

// Buscar por email
const user = await userRepo.findByEmail('user@example.com');

// Criar usuário
const newUser = await userRepo.createUser({
  name: 'João',
  email: 'joao@example.com',
  password: 'hashed_password'
});

// Atualizar senha
await userRepo.updatePassword(userId, 'new_hashed_password');

// Buscar usuários ativos
const activeUsers = await userRepo.findActiveUsers();

// Paginação
const result = await userRepo.findUsersPaginated(1, 10);
```

### Validações de Segurança

- **Email**: Regex rigoroso, sanitização, verificação de duplicatas
- **Senha**: Mínimo 8 caracteres, complexidade obrigatória
- **Nome**: Sanitização contra XSS, limite de caracteres
- **Status/Role**: Enums validados
- **Injeção**: Detecção e bloqueio de tentativas

## Próximos Passos

1. **Implementar hash de senha** (bcrypt)
2. **Adicionar refresh tokens**
3. **Implementar recuperação de senha**
4. **Adicionar rate limiting**
5. **Logs de segurança**

## Segurança

O módulo inclui múltiplas camadas de segurança:

- ✅ Sanitização de entrada
- ✅ Validação de dados
- ✅ Proteção contra injeção
- ✅ Autenticação JWT
- ✅ Controle de acesso baseado em roles
- ✅ Verificação de status da conta

Para mais detalhes sobre segurança, consulte o arquivo `PlanTask.chatmode.md`.