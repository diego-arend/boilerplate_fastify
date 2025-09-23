# Server Infrastructure

Este diretório contém a infraestrutura do servidor Fastify, incluindo configurações, plugins e middleware essenciais para o funcionamento da aplicação.

## 📁 Estrutura

```
src/infraestructure/server/
├── README.md              # Este arquivo
├── fastify.config.ts      # Configuração do Fastify
├── fastify.d.ts          # Tipos TypeScript do Fastify
├── modules.ts            # Sistema de registro de módulos
├── cors.plugin.ts        # Plugin CORS
└── rateLimit.plugin.ts   # Plugin Rate Limiting
```

## 🔧 Configuração do Fastify

### `fastify.config.ts`

Configuração principal do servidor Fastify com:

- Logger estruturado (Pino)
- Configurações de desenvolvimento vs produção
- Trust proxy para ambientes containerizados
- Body limits e timeouts

```typescript
export const fastifyConfig: FastifyServerOptions = {
  logger: {
    level: config.LOG_LEVEL,
    transport:
      config.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty'
          }
        : undefined
  },
  trustProxy: true,
  bodyLimit: 1048576, // 1MB
  connectionTimeout: 30000
};
```

## 📦 Sistema de Registro de Módulos

### `modules.ts`

Sistema centralizado para registro de plugins/módulos na aplicação.

#### Funcionalidades

- **Registro Automático**: Registra plugins com prefixos e nomes
- **Logging**: Log estruturado de cada módulo registrado
- **Error Handling**: Tratamento de erros durante o registro
- **TypeScript**: Tipagem completa com interfaces Fastify

#### Uso

```typescript
import { registerModule } from './modules.js';
import authPlugin from './modules/auth/auth.plugin.js';

// Registra módulo com prefixo
await registerModule(fastify, authPlugin, '/auth', 'authentication');

// Registra módulo sem prefixo
await registerModule(fastify, healthPlugin, '', 'health');
```

#### Função `registerModule`

```typescript
async function registerModule(
  fastify: FastifyInstance,
  plugin: FastifyPluginAsync | FastifyPluginCallback,
  prefix: string,
  name: string
): Promise<void>;
```

**Parâmetros:**

- `fastify`: Instância do Fastify
- `plugin`: Plugin a ser registrado
- `prefix`: Prefixo da rota (ex: '/auth', '/api')
- `name`: Nome do módulo para logging

#### Ordem de Registro

A ordem de registro é importante para o funcionamento correto:

```typescript
// 1. Cache (deve ser primeiro)
await fastify.register(cachePlugin);

// 2. CORS (antes do rate limiting)
await fastify.register(corsPlugin);

// 3. Rate Limiting (antes da autenticação)
await fastify.register(rateLimitPlugin);

// 4. Swagger (desenvolvimento)
await fastify.register(swaggerPlugin);

// 5. Módulos da aplicação
await registerModule(fastify, healthPlugin, '', 'health');
await registerModule(fastify, authPlugin, '/auth', 'auth');
```

## 🛡️ CORS Plugin

### `cors.plugin.ts`

Plugin para configuração de Cross-Origin Resource Sharing (CORS).

#### Características

- **Configuração Flexível**: Via variáveis de ambiente
- **Múltiplas Origens**: String, array, regex ou função
- **Segurança**: Validações automáticas para produção
- **Logging**: Monitoramento detalhado da configuração

#### Configuração de Origem

```typescript
// Origem única
CORS_ORIGIN=http://localhost:3000

// Múltiplas origens (separadas por vírgula)
CORS_ORIGIN=http://localhost:3000,https://app.example.com

// Todas as origens (⚠️ NÃO recomendado em produção)
CORS_ORIGIN=*

// Padrão regex
CORS_ORIGIN=/localhost:\d+/
```

#### Variáveis de Ambiente

| Variável                 | Tipo      | Padrão      | Descrição                        |
| ------------------------ | --------- | ----------- | -------------------------------- |
| `CORS_ORIGIN`            | `string`  | `undefined` | Origens permitidas               |
| `CORS_ALLOW_CREDENTIALS` | `boolean` | `false`     | Permitir cookies/headers de auth |

#### Configuração Padrão

```typescript
{
  origin: true, // Em desenvolvimento
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Origin', 'X-Requested-With', 'Content-Type', 'Accept',
    'Authorization', 'Cache-Control', 'X-Forwarded-For', 'User-Agent'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset',
    'X-Response-Time', 'Content-Length'
  ],
  maxAge: 86400 // 24 horas
}
```

#### Validações de Segurança

**Produção:**

- ❌ Bloqueia `origin: '*'`
- ❌ Bloqueia `credentials: true` + `origin: '*'`
- ⚠️ Avisos para configurações inseguras

**Desenvolvimento:**

- ⚠️ Permite todas as origens por padrão
- ⚠️ Avisos sobre restrições necessárias em produção

#### Parseamento de Origens

```typescript
// String única
parseOrigin('http://localhost:3000'); // → 'http://localhost:3000'

// Múltiplas (CSV)
parseOrigin('http://localhost:3000,https://app.com'); // → ['http://localhost:3000', 'https://app.com']

// Regex
parseOrigin('/localhost:\d+/'); // → RegExp(/localhost:\d+/)

// Valores especiais
parseOrigin('*'); // → true
parseOrigin('false'); // → false
```

#### Uso

```typescript
// Registro básico (usa env vars)
await fastify.register(corsPlugin);

// Registro com opções personalizadas
await fastify.register(corsPlugin, {
  origin: 'http://localhost:3000',
  credentials: true
});
```

## 🚦 Rate Limiting Plugin

### `rateLimit.plugin.ts`

Plugin para limitação de taxa de requisições (Rate Limiting).

#### Características

- **Redis Storage**: Usa Redis para armazenamento distribuído
- **Memory Fallback**: Fallback para memória se Redis indisponível
- **Skip Routes**: Pula limitação em rotas específicas
- **Headers**: Headers informativos sobre limites
- **Configurável**: Via variáveis de ambiente ou opções

#### Variáveis de Ambiente

| Variável               | Tipo     | Padrão  | Descrição             |
| ---------------------- | -------- | ------- | --------------------- |
| `RATE_LIMIT_MAX`       | `number` | `100`   | Máximo de requisições |
| `RATE_LIMIT_WINDOW_MS` | `number` | `60000` | Janela de tempo (ms)  |

#### Configuração Padrão

```typescript
{
  max: 100,                    // 100 requisições
  timeWindow: 60000,          // por minuto (60000ms)
  skipRoutes: [               // Rotas que pulam rate limit
    '/health',
    '/docs',
    '/docs/*'
  ],
  enableGlobal: true,         // Aplica globalmente
  useRedis: true,             // Tenta usar Redis

  // Headers de resposta
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true
  }
}
```

#### Storage Strategies

**Redis (Preferido):**

- ✅ Distribuído entre instâncias
- ✅ Persistente
- ✅ Escalável
- ⚠️ Requer Redis disponível

**Memory (Fallback):**

- ✅ Sem dependências externas
- ❌ Por instância apenas
- ❌ Perdido ao reiniciar
- ⚠️ Não escalável

#### Headers de Rate Limit

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642681200
```

#### Skip Routes

Certas rotas não são limitadas:

- `/health` - Health checks
- `/docs`, `/docs/*` - Documentação Swagger
- Rotas definidas em `skipRoutes`

#### Uso

```typescript
// Registro básico (usa env vars)
await fastify.register(rateLimitPlugin);

// Registro com opções personalizadas
await fastify.register(rateLimitPlugin, {
  max: 50,
  timeWindow: 30000,
  skipRoutes: ['/public/*'],
  enableGlobal: false
});
```

#### Rate Limit por Rota

```typescript
fastify.get(
  '/api/data',
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 60000
      }
    }
  },
  async (request, reply) => {
    // Esta rota tem limite específico de 10/min
  }
);
```

## 🔄 Fluxo de Inicialização

### Ordem de Carregamento

1. **Cache Plugin** - Deve ser primeiro para estar disponível
2. **CORS Plugin** - Configuração de origens cruzadas
3. **Rate Limit Plugin** - Limitação de requisições
4. **Swagger** - Documentação (apenas desenvolvimento)
5. **Health Module** - Endpoints de saúde
6. **Auth Module** - Autenticação e autorização
7. **Outros Modules** - Módulos específicos da aplicação

### Hooks do Ciclo de Vida

```typescript
// onReady: Após todos plugins registrados
fastify.addHook('onReady', async () => {
  // Conecta ao MongoDB
  const mongoConnection = MongoConnection.getInstance();
  await mongoConnection.connect();
});

// onClose: Limpeza ao fechar
fastify.addHook('onClose', async () => {
  // Desconecta do MongoDB
  const mongoConnection = MongoConnection.getInstance();
  await mongoConnection.disconnect();
});
```

## 🏗️ Arquitetura de Plugins

### Plugin Structure

```typescript
import fp from 'fastify-plugin';

async function myPlugin(fastify: FastifyInstance, options: MyPluginOptions) {
  // 1. Validação de opções
  const config = { ...defaultOptions, ...options };

  // 2. Inicialização
  fastify.log.info('Initializing My Plugin');

  // 3. Registro de hooks/decorators/routes
  fastify.addHook('onRequest', async (request, reply) => {
    // Plugin logic
  });

  // 4. Logging de sucesso
  fastify.log.info('My Plugin registered successfully');
}

export default fp(myPlugin, {
  name: 'my-plugin',
  fastify: '5.x'
});
```

### Plugin Options Pattern

```typescript
interface PluginOptions {
  // Configurações específicas do plugin
  enabled?: boolean;
  config?: Record<string, any>;
}

const defaultOptions: PluginOptions = {
  enabled: true,
  config: {}
};
```

## 📊 Monitoramento e Logs

### Structured Logging

Todos os plugins usam logging estruturado:

```typescript
fastify.log.info({
  context: 'plugin-name',
  message: 'Plugin initialized successfully',
  config: sanitizedConfig
});
```

### Log Levels

- `DEBUG`: Detalhes de debugging
- `INFO`: Informações gerais
- `WARN`: Avisos (configurações inseguras)
- `ERROR`: Erros que precisam atenção
- `FATAL`: Erros críticos

### Health Monitoring

O sistema inclui endpoints de monitoramento:

- `GET /health` - Status geral da aplicação
- Headers de rate limit para monitoramento
- Logs estruturados para observabilidade

## 🛠️ Desenvolvimento

### Adicionando Novos Plugins

1. **Criar o arquivo**: `src/infraestructure/server/[nome].plugin.ts`
2. **Implementar interface**:

   ```typescript
   import fp from 'fastify-plugin';

   async function myPlugin(fastify: FastifyInstance, options: MyOptions) {
     // Implementation
   }

   export default fp(myPlugin, {
     name: 'my-plugin',
     fastify: '5.x'
   });
   ```

3. **Registrar em app.ts**:
   ```typescript
   import myPlugin from './infraestructure/server/my.plugin.js';
   await fastify.register(myPlugin, options);
   ```

### Testing

```typescript
import { build } from '../../../test-helper';

describe('My Plugin', () => {
  test('should register plugin', async () => {
    const app = await build();
    // Test implementation
  });
});
```

## 🔐 Segurança

### Boas Práticas

- ✅ **Rate Limiting**: Sempre habilitado em produção
- ✅ **CORS Restritivo**: Origens específicas em produção
- ✅ **Headers Seguros**: Headers de segurança apropriados
- ✅ **Validação**: Validação rigorosa de entrada
- ✅ **Logging**: Log de atividades suspeitas

### Configuração de Produção

```bash
# CORS - Origens específicas
CORS_ORIGIN=https://app.example.com,https://admin.example.com
CORS_ALLOW_CREDENTIALS=false

# Rate Limiting - Mais restritivo
RATE_LIMIT_MAX=50
RATE_LIMIT_WINDOW_MS=60000

# Logs - Nível apropriado
LOG_LEVEL=info
```

## 🤝 Contribuindo

1. Siga os padrões existentes de plugins
2. Use TypeScript com tipagem completa
3. Inclua logging estruturado
4. Documente variáveis de ambiente
5. Implemente tratamento de erro
6. Adicione testes unitários

---

Para mais informações sobre Fastify plugins, consulte a [documentação oficial](https://fastify.dev/docs/latest/Reference/Plugins/).
