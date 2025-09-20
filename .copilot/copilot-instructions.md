# Boilerplate Fastify - Instruções para Copilot

## Visão Geral do Projeto

Este é um boilerplate moderno para APIs backend utilizando **Fastify v5.5.0** com **TypeScript**, seguindo uma arquitetura modular e escalável. O projeto utiliza **ES Modules**, **MongoDB** como banco de dados principal, e está preparado para desenvolvimento com **Docker**.

## Tecnologias Principais

- **Runtime**: Node.js com ES Modules
- **Framework**: Fastify v5.5.0 (Framework web de alta performance)
- **Linguagem**: TypeScript v5.9.2 com configurações strict
- **Banco de Dados**: MongoDB v8.18.1 com Mongoose
- **Validação**: Zod v4.1.5 para schemas e validação de dados
- **Autenticação**: JWT (jsonwebtoken v9.0.2)
- **Gerenciamento de Pacotes**: pnpm v10.13.1
- **Desenvolvimento**: tsx v4.19.1 para hot reload
- **Containerização**: Docker + Docker Compose

## Estrutura Arquitetural

### Diretórios Principais

```
src/
├── app.ts                    # Plugin principal da aplicação
├── server.ts                 # Ponto de entrada do servidor
├── entities/                 # Entidades de domínio (opcional)
├── infraestructure/          # Camada de infraestrutura
│   ├── mongo/               # Conexão e configurações MongoDB
│   │   ├── connection.ts    # Singleton de conexão MongoDB
│   │   └── connection.test.ts
│   └── server/              # Configurações do servidor
│       ├── fastify.config.ts # Configuração Fastify (logger, etc.)
│       ├── fastify.d.ts     # Tipos customizados Fastify
│       └── modules.ts       # Sistema de registro de módulos
├── lib/                     # Utilitários e bibliotecas compartilhadas
│   └── validateEnv.ts       # Validação de variáveis ambiente com Zod
└── modules/                 # Módulos de domínio (DDD)
    └── auth/                # Módulo de autenticação
        ├── auth.controller.ts    # Controladores e rotas
        ├── auth.plugin.ts        # Plugin Fastify do módulo
        ├── repository/           # Camada de persistência
        │   ├── userAuth.repository.ts
        │   └── index.ts
        ├── strategy.ts           # Estratégias de autenticação
        ├── command.ts            # Comandos CLI (opcional)
        ├── types/                # Tipos específicos do módulo
        │   └── auth.d.ts
        └── README.md             # Documentação do módulo
```

### Arquivos de Configuração (Raiz)

- **package.json**: Scripts npm/pnpm, dependências e metadados
- **tsconfig.json**: Configuração TypeScript com NodeNext e ESNext
- **fastify.config.ts**: Configurações globais do Fastify (logger, etc.)
- **docker-compose.yml**: Orquestração para produção
- **docker-compose.dev.yml**: Ambiente de desenvolvimento
- **Dockerfile**: Imagem para produção
- **Dockerfile.dev**: Imagem otimizada para desenvolvimento

## Padrões de Desenvolvimento

### Arquitetura Modular (DDD)
- Cada domínio de negócio em seu próprio módulo
- Separação clara entre controllers, repositories e business logic
- Plugins Fastify para isolamento e reusabilidade
- Sistema de registro automático de módulos

### Configuração e Ambiente
- Validação rigorosa de variáveis ambiente com Zod
- Configuração imutável via `Object.freeze()`
- Decorator global `fastify.config` para acesso às configurações
- Suporte a múltiplos ambientes (dev, prod, test)

### Desenvolvimento Moderno
- **Hot Reload**: tsx para desenvolvimento com recarregamento automático
- **ES Modules**: Import/export nativo do Node.js
- **TypeScript Strict**: Configurações rigorosas de tipagem
- **Docker Development**: Ambiente isolado e consistente

### Segurança e Qualidade
- Sanitização de entrada com Zod
- Validação de tipos em tempo de compilação
- Autenticação JWT com refresh tokens
- Logs estruturados com Pino
- Health checks automáticos

## Documentação e Comentários

### Padrão de Comentários
- **Idioma**: Todos os comentários devem ser escritos em **inglês**
- **Formato**: Utilizar **JSDoc** para documentação estruturada
- **Cobertura**: Todo arquivo de lógica deve ter comentários adequados
- **Consistência**: Seguir padrões estabelecidos em todo o projeto

### Estrutura JSDoc Obrigatória
```typescript
/**
 * Brief description of what the function/class does
 * @param {Type} paramName - Description of parameter
 * @returns {Type} Description of return value
 * @throws {ErrorType} Description of thrown errors
 */
```

### Exemplos de Documentação
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

### Tipos de Comentários
- **JSDoc Functions**: Para todas as funções públicas e métodos
- **Class Documentation**: Para todas as classes e interfaces
- **Inline Comments**: Para lógica complexa (em inglês)
- **TODO/FIXME**: Para melhorias futuras (em inglês)
- **Error Messages**: Todas as mensagens devem ser em inglês

## Scripts Disponíveis

```bash
# Desenvolvimento
pnpm dev                    # Inicia servidor com hot reload
pnpm build                  # Compila TypeScript para JavaScript
pnpm start                  # Executa versão compilada

# Docker
pnpm docker:dev            # Inicia containers de desenvolvimento
pnpm docker:dev:down       # Para containers de desenvolvimento
pnpm docker:prod           # Inicia containers de produção
pnpm docker:prod:down      # Para containers de produção
pnpm docker:logs           # Visualiza logs dos containers
pnpm docker:build          # Constrói imagem Docker
```

## Configurações Técnicas

### TypeScript (tsconfig.json)
- **Module Resolution**: NodeNext para compatibilidade com ES Modules
- **Target**: ESNext para features modernas
- **Strict Mode**: Habilitado com validações rigorosas
- **Source Maps**: Para debugging em desenvolvimento
- **Declaration Files**: Geração automática de tipos

### Fastify Configuration
- **Logger**: Pino com pretty printing em desenvolvimento
- **Plugins**: Sistema modular de plugins
- **Hooks**: Lifecycle hooks para inicialização e shutdown
- **Decorators**: Extensões customizadas da instância Fastify

### MongoDB Integration
- **Connection**: Singleton pattern para conexão única
- **Mongoose**: ODM para modelagem de dados
- **Graceful Shutdown**: Desconexão automática no encerramento
- **Health Checks**: Verificação automática de conectividade

## Boas Práticas Implementadas

### Código
- **TypeScript Strict**: Zero any, tipos explícitos
- **ESLint/Prettier**: Padronização de código (configurar se necessário)
- **Error Handling**: Tratamento consistente de erros
- **Logging**: Logs estruturados em todos os níveis

### Segurança
- **Input Validation**: Zod schemas para todas as entradas
- **JWT Authentication**: Tokens seguros com expiração
- **Environment Variables**: Validação rigorosa de configs
- **CORS**: Configuração adequada para APIs

### Performance
- **Fastify**: Framework otimizado para performance
- **Connection Pooling**: MongoDB com pool de conexões
- **Caching**: Preparado para Redis (container disponível)
- **Health Checks**: Monitoramento contínuo da saúde

## Desenvolvimento com Docker

### Ambiente de Desenvolvimento
- **Hot Reload**: Recarregamento automático sem restart
- **Volume Mounting**: Código sincronizado em tempo real
- **Debugging**: Porta de debug exposta
- **Dependencies**: Cache otimizado para rebuilds rápidos

### Produção
- **Multi-stage Build**: Imagem otimizada e leve
- **Security**: Usuário não-root em produção
- **Health Checks**: Verificações automáticas de saúde
- **Logging**: Configuração apropriada para produção

## Extensões e Ferramentas

### VS Code Extensions Recomendadas
- **TypeScript Importer**: Auto-import inteligente
- **Prettier**: Formatação automática
- **ESLint**: Linting e correção automática
- **Docker**: Suporte completo a containers

### Testes e Verificações de Rotas
- **Playwright MCP**: Para verificações de rotas e interações de teste HTTP, utilize o MCP (Model Context Protocol) do Playwright. Este servidor permite executar testes automatizados de API, verificar endpoints e validar respostas HTTP de forma programática e integrada ao ambiente de desenvolvimento.

### Dependências de Desenvolvimento
- **tsx**: TypeScript execution com hot reload
- **@types/node**: Tipos para Node.js
- **@types/jsonwebtoken**: Tipos para JWT

## Próximos Passos e Expansão

### Funcionalidades Planejadas
- Sistema de cache com Redis
- Rate limiting e proteção DDoS
- Documentação automática da API
- Testes automatizados (Jest/Vitest)
- CI/CD pipeline
- Monitoring e observabilidade

### Estrutura para Novos Módulos
1. Criar diretório em `src/modules/`
2. Implementar controller, plugin e repository
3. Registrar no `app.ts` via `registerModule()`
4. Adicionar tipos específicos se necessário
5. Documentar no README do módulo

## Referências e Documentação

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Zod Validation](https://zod.dev/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Nota**: Este boilerplate segue as melhores práticas atuais de desenvolvimento Node.js/TypeScript, com foco em performance, segurança e manutenibilidade.
