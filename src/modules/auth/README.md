# Módulo de Autenticação

Este módulo implementa autenticação completa com JWT, integrado ao MongoDB através do `UserAuthRepository`.

## Arquitetura

### Funcionalidades Principais
- Registro de usuários
- Login com JWT
- Rotas protegidas
- Busca de usuários (admin)
- Validações de segurança
- Sanitização de entrada
- Proteção contra injeção

### Estrutura de Arquivos
```
auth/
├── auth.controller.ts    # Rotas e lógica de negócio
├── auth.plugin.ts        # Plugin Fastify de autenticação
├── repository/           # Camada de persistência
│   ├── userAuth.repository.ts
│   └── index.ts
├── strategy.ts           # Estratégia de autenticação
├── command.ts            # Comandos CLI
└── types/                # Tipos TypeScript
```

### Componentes Principais

#### AuthController
Gerencia as rotas de autenticação:
- `POST /auth/register` - Registro de usuários
- `POST /auth/login` - Login de usuários
- `GET /auth/me` - Dados do usuário autenticado
- `GET /auth/users` - Lista de usuários (admin)

#### AuthPlugin
Plugin Fastify que:
- Registra hooks de autenticação
- Valida tokens JWT
- Controla acesso baseado em roles
- Gerencia sessões de usuário

#### UserAuthRepository
Camada de persistência responsável por:
- Operações CRUD de usuários
- Busca por email e ID
- Validações de unicidade
- Paginação de resultados
- Controle de status e roles

#### Strategy
Implementa a estratégia de autenticação:
- Validação de credenciais
- Geração de tokens JWT
- Verificação de permissões
- Controle de acesso

### Validações de Segurança
- **Email**: Regex rigoroso, sanitização, verificação de duplicatas
- **Senha**: Mínimo 8 caracteres, complexidade obrigatória
- **Nome**: Sanitização contra XSS, limite de caracteres
- **Status/Role**: Enums validados
- **Injeção**: Detecção e bloqueio de tentativas

### Camadas de Segurança
- Sanitização de entrada
- Validação de dados
- Proteção contra injeção
- Autenticação JWT
- Controle de acesso baseado em roles
- Verificação de status da conta

## Integração
O módulo é integrado ao sistema através do `modules.ts` principal e utiliza as configurações globais de banco de dados e validação de ambiente.