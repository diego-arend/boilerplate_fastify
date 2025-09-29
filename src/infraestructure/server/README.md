# Server Infrastructure

Sistema de infraestrutura do servidor **Fastify v5.5.0** com plugins essenciais para CORS, Rate Limiting, Swagger e gerenciamento de módulos.

## Estrutura

```
src/infraestructure/server/
├── fastify.config.ts         # Configuração principal do servidor
├── fastify.d.ts             # Tipagens TypeScript customizadas
├── modules.ts               # Sistema de registro de módulos
├── cors.plugin.ts           # Plugin CORS com validações
├── rateLimit.plugin.ts      # Rate limiting com Redis/Memory
├── swagger.plugin.ts        # Documentação OpenAPI (dev only)
├── swagger.ts               # Exports Swagger
└── README.md
```

## Configuração Principal

### **fastify.config.ts**

```typescript
const config: FastifyServerOptions = {
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  },
  pluginTimeout: 30000 // Timeout para plugins
};
```

**Características:**

- Logger Pino estruturado com pretty print
- Timeout de 30s para carregamento de plugins
- Configuração otimizada para desenvolvimento

## Sistema de Módulos

### **modules.ts - Registro Centralizado**

```typescript
// Registrar módulo com prefixo
await registerModule(fastify, authPlugin, '/auth', 'authentication');

// Registrar sem prefixo
await registerModule(fastify, healthPlugin, '', 'health');
```

**Funcionalidades:**

- ✅ **Registro automático** com logging estruturado
- ✅ **Prefixos de rota** configuráveis
- ✅ **Error handling** durante registro
- ✅ **TypeScript** com tipagem completa

### **Ordem Recomendada**

```typescript
// 1. Cache (primeiro - dependência de outros)
await fastify.register(cachePlugin);

// 2. CORS (antes do rate limiting)
await fastify.register(corsPlugin);

// 3. Rate Limiting (proteção inicial)
await fastify.register(rateLimitPlugin);

// 4. Swagger (desenvolvimento)
await fastify.register(swaggerPlugin);

// 5. Módulos de negócio
await registerModule(fastify, healthPlugin, '', 'health');
await registerModule(fastify, authPlugin, '/auth', 'auth');
```

## Plugin CORS

### **Configuração Avançada**

```typescript
// Via variáveis de ambiente
CORS_ORIGIN=https://app.example.com,https://admin.example.com
CORS_ALLOW_CREDENTIALS=false
```

**Parsing Inteligente:**

- **String única**: `https://app.com` → `"https://app.com"`
- **Multiple URLs**: `url1,url2,url3` → `["url1", "url2", "url3"]`
- **Regex pattern**: `/localhost:\d+/` → `RegExp(/localhost:\d+/)`
- **Wildcard**: `*` → `true` (bloqueado em produção)

### **Headers Configurados**

```typescript
// Allowed Headers
[
  'Origin',
  'X-Requested-With',
  'Content-Type',
  'Accept',
  'Authorization',
  'X-API-Key',
  'X-Request-ID',
  'Cache-Control'
][
  // Exposed Headers
  ('X-Request-ID',
  'X-Response-Time',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset')
];
```

### **Validações de Segurança**

```typescript
// ❌ Produção - Bloqueia configurações inseguras
if (config.NODE_ENV === 'production' && corsConfig.origin === '*') {
  throw new Error('CORS origin cannot be wildcard (*) in production');
}

// ⚠️ Desenvolvimento - Avisos sobre configurações abertas
if (config.NODE_ENV === 'development' && corsConfig.origin === true) {
  logger.warn('CORS allows all origins - restrict in production');
}
```

## Plugin Rate Limiting

### **Configuração com Redis**

```typescript
// Configuração automática
RATE_LIMIT_MAX=100              # Requests por janela
RATE_LIMIT_WINDOW_MS=60000      # 1 minuto em ms
REDIS_HOST=localhost            # Para storage distribuído
```

**Storage Strategy:**

- ✅ **Redis** (preferido) - Distribuído entre instâncias
- ✅ **Memory** (fallback) - Quando Redis não disponível

### **Skip Routes Automático**

```typescript
skipRoutes: ['/health', '/docs', '/docs/*'];

// Lógica de skip inteligente
const shouldSkip = skipRoutes.some(route => {
  if (route.endsWith('/*')) {
    return request.url.startsWith(route.slice(0, -2));
  }
  return request.url === route || request.url.startsWith(route + '?');
});
```

### **Key Generator Customizado**

```typescript
keyGenerator: request => {
  // Usuário autenticado
  if (request.authenticatedUser) {
    return `user:${request.authenticatedUser.id}`;
  }

  // IP address (padrão)
  return `ip:${request.ip}`;
};
```

### **Error Response Customizado**

```typescript
{
  error: 'Too Many Requests',
  message: 'Rate limit exceeded. Maximum 100 requests per 60 seconds.',
  code: 429,
  retryAfter: 45,
  details: {
    limit: 100,
    windowMs: 60000,
    remainingTime: 45
  }
}
```

### **Headers Informativos**

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1642681260
Retry-After: 45
```

### **Rate Limit por Rota**

```typescript
app.post(
  '/api/upload',
  {
    config: {
      rateLimit: {
        max: 5, // 5 uploads
        timeWindow: 300000 // por 5 minutos
      }
    }
  },
  async (request, reply) => {
    // Endpoint com limite específico
  }
);
```

## Plugin Swagger

### **OpenAPI 3.0.3 Completa**

```typescript
// Apenas em desenvolvimento
if (process.env.NODE_ENV !== 'development') {
  return; // Não registra em produção
}
```

**Configuração:**

- ✅ **OpenAPI 3.0.3** com esquemas completos
- ✅ **JWT Authentication** Bearer token
- ✅ **Multiple servers** (dev/prod)
- ✅ **Tags organizadas** por módulo
- ✅ **Schemas reutilizáveis** (Error/Success)

### **Acesso à Documentação**

```bash
# Desenvolvimento
http://localhost:3001/docs

# Interface interativa com Try It Out
# Expansion mode: list
# Deep linking: disabled
```

### **Schemas Padrão**

```typescript
// Error Response
{
  success: false,
  message: "Error message",
  code: 400,
  error: "Error details"
}

// Success Response
{
  success: true,
  message: "Operation successful",
  code: 200,
  data: { /* response data */ }
}
```

### **Decorators para Documentação**

```typescript
import { swaggerDecorators } from '../infraestructure/server/swagger.js';

class AuthController {
  @swaggerDecorators.tags(['Auth'])
  @swaggerDecorators.summary('User login')
  @swaggerDecorators.description('Authenticate user with email/password')
  async login() {
    // Implementation
  }
}
```

## Tipagens TypeScript

### **fastify.d.ts - Extensões**

```typescript
declare module 'fastify' {
  interface FastifyInstance {
    // Configuração do ambiente
    config: typeof config;

    // MongoDB
    mongoConnectionManager: IMongoConnectionManager;
    transactionManager: ITransactionManager;

    // Queue system
    queueManager: QueueManager;
    addJob: (jobId: string, type: string, data: any, options?: JobOptions) => Promise<string>;

    // Legacy support
    mongo: {
      getConnection: () => mongoose.Connection;
      isConnected: () => boolean;
    };
  }
}
```

**Decorações Disponíveis:**

- ✅ **config** - Configurações de ambiente
- ✅ **mongoConnectionManager** - Conexão MongoDB
- ✅ **transactionManager** - Transações
- ✅ **queueManager** - Gerenciador de filas
- ✅ **addJob** - Adicionar job à fila
- ✅ **mongo** - Suporte legado

## Uso Prático

### **Inicialização Completa**

```typescript
import fastify from 'fastify';
import fastifyConfig from './infraestructure/server/fastify.config.js';
import corsPlugin from './infraestructure/server/cors.plugin.js';
import rateLimitPlugin from './infraestructure/server/rateLimit.plugin.js';
import swaggerPlugin from './infraestructure/server/swagger.plugin.js';
import { registerModule } from './infraestructure/server/modules.js';

// Criar instância
const app = fastify(fastifyConfig);

// Plugins essenciais
await app.register(corsPlugin, {
  origin: ['https://app.com'],
  credentials: false
});

await app.register(rateLimitPlugin, {
  max: 50,
  timeWindow: 60000
});

await app.register(swaggerPlugin);

// Módulos de negócio
await registerModule(app, healthPlugin, '', 'health');
await registerModule(app, authPlugin, '/auth', 'auth');
```

### **Plugin Customizado**

```typescript
import fp from 'fastify-plugin';

async function customPlugin(fastify: FastifyInstance, opts: CustomOptions) {
  const logger = fastify.log.child({ context: 'custom-plugin' });

  // Validação de opções
  const config = { ...defaultOptions, ...opts };

  // Inicialização
  logger.info('Initializing custom plugin');

  // Hooks/decorators/routes
  fastify.addHook('onRequest', async (request, reply) => {
    // Plugin logic
  });

  logger.info('Custom plugin registered successfully');
}

export default fp(customPlugin, {
  name: 'custom-plugin',
  fastify: '5.x'
});
```

## Monitoramento e Logs

### **Logging Estruturado**

```json
{
  "level": 30,
  "time": 1642681200000,
  "context": "cors-plugin",
  "message": "CORS plugin registered successfully",
  "config": {
    "originType": "array",
    "credentialsEnabled": false,
    "methodsCount": 7,
    "environment": "development"
  }
}
```

### **Health Checks**

```typescript
// Endpoint automático de health
GET /health

// Response
{
  "status": "healthy",
  "timestamp": "2024-01-20T15:30:00Z",
  "services": {
    "mongodb": "connected",
    "redis": "connected",
    "queue": "ready"
  }
}
```

## Configuração de Produção

### **Variáveis de Ambiente**

```bash
# Server
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# CORS (restritivo)
CORS_ORIGIN=https://app.example.com,https://admin.example.com
CORS_ALLOW_CREDENTIALS=false

# Rate Limiting (mais restritivo)
RATE_LIMIT_MAX=50
RATE_LIMIT_WINDOW_MS=60000

# Redis (storage distribuído)
REDIS_HOST=redis-server
REDIS_PORT=6379
REDIS_DB=0
```

### **Security Best Practices**

- ✅ **CORS restritivo** - Origins específicos
- ✅ **Rate limiting** habilitado
- ✅ **Redis storage** para distribuição
- ✅ **Logs estruturados** para monitoramento
- ✅ **Swagger desabilitado** em produção
- ✅ **Headers seguros** configurados

## Melhores Práticas

### **Plugin Development**

- ✅ Use `fastify-plugin` para encapsulamento
- ✅ Implemente logging estruturado com contexto
- ✅ Valide opções com defaults sensatos
- ✅ Configure timeouts apropriados
- ✅ Adicione tipagens TypeScript completas

### **Configuração**

- ✅ **Ordem de plugins** - Cache → CORS → Rate Limit → Swagger → Módulos
- ✅ **Variáveis de ambiente** para todas as configurações
- ✅ **Validações de segurança** em produção
- ✅ **Fallbacks** para dependências externas (Redis)
- ✅ **Skip routes** para endpoints críticos (/health, /docs)

### **Segurança**

- ✅ **CORS restritivo** em produção (origins específicos)
- ✅ **Rate limiting** sempre habilitado
- ✅ **Headers seguros** configurados
- ✅ **Swagger desabilitado** em produção
- ❌ Nunca use `origin: '*'` em produção
