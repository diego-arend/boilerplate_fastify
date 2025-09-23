# Logger Manager - Documentação de Implementação

## Visão Geral

O `LoggerManager` é um gerenciador de logs centralizado implementado utilizando a biblioteca **Pino**, projetado para aplicações Fastify de alta performance. Fornece logging estruturado, sanitização de dados sensíveis, configuração por ambiente e integração nativa com Fastify.

## Características Principais

### 🚀 Performance

- **Pino**: Uma das bibliotecas de logging mais rápidas para Node.js
- **JSON estruturado**: Logs em formato JSON para fácil parsing e análise
- **Transporte assíncrono**: Não bloqueia o thread principal da aplicação

### 🔒 Segurança

- **Sanitização automática**: Remove automaticamente dados sensíveis (passwords, tokens, etc.)
- **Stack trace**: Inclui stack trace completo para erros
- **Redação de campos**: Substitui campos sensíveis por `[REDACTED]`

### 🌍 Configuração por Ambiente

- **Desenvolvimento**: Pretty printing colorido e logs detalhados
- **Produção**: Logs JSON estruturados para sistemas de monitoramento
- **Teste**: Logs mínimos para não poluir output dos testes

### 📊 Níveis de Log Suportados

- `FATAL`: Erros que causam término da aplicação
- `ERROR`: Erros que não interrompem a aplicação
- `WARN`: Avisos e situações suspeitas
- `INFO`: Informações gerais da aplicação
- `DEBUG`: Informações detalhadas para desenvolvimento
- `TRACE`: Informações muito detalhadas para debugging profundo
- `SILENT`: Desabilita todos os logs

## Uso Básico

### Instância Singleton (Recomendado)

```typescript
import { defaultLogger } from './lib/logger';

// Logs básicos
defaultLogger.info('Servidor iniciado', { port: 3000 });
defaultLogger.warn('Conexão lenta detectada', { latency: 1500 });
defaultLogger.error('Erro na base de dados', {
  error: new Error('Connection failed'),
  query: 'SELECT * FROM users'
});

// Logger filho com contexto
const requestLogger = defaultLogger.child({ requestId: 'req-123' });
requestLogger.info('Processando requisição', { userId: 456 });
```

### Instância Customizada

```typescript
import { LoggerManager, LogLevel } from './lib/logger';

const customLogger = LoggerManager.createLogger({
  serviceName: 'auth-service',
  level: LogLevel.DEBUG,
  environment: 'staging',
  prettyPrint: true
});

customLogger.debug('Token validado', { userId: 123 });
```

## Integração com Fastify

### Opção 1: Substituir o Logger Padrão do Fastify

```typescript
// src/infraestructure/server/fastify.config.ts
import { defaultLogger } from '../../lib/logger';
import type { FastifyServerOptions } from 'fastify';

const config: FastifyServerOptions = {
  logger: defaultLogger.getPinoLogger(), // Usar nosso logger customizado
  pluginTimeout: 30000
};

export default config;
```

### Opção 2: Usar Ambos os Loggers (Atual + Novo)

```typescript
// src/server.ts
import dotenv from 'dotenv';
import { fastify } from 'fastify';
import configFastify from './infraestructure/server/fastify.config.js';
import { defaultLogger } from './lib/logger';
import app from './app.js';
import { config } from './lib/validators/validateEnv.js';

dotenv.config({ debug: false });

const server = fastify(configFastify);

// Registrar nosso logger customizado
server.decorate('logger', defaultLogger);
server.decorate('config', config);

server.register(app);

const start = async () => {
  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' });

    // Usar nosso logger customizado
    defaultLogger.info('Server running successfully', {
      port: config.PORT,
      host: '0.0.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    defaultLogger.fatal('Failed to start server', { error: err });
    process.exit(1);
  }
};

start();
```

### Opção 3: Integração em Plugins

```typescript
// Em qualquer plugin Fastify
import fp from 'fastify-plugin';
import { defaultLogger } from '../lib/logger';

export default fp(async function (fastify, opts) {
  // Registrar logger como decoração
  fastify.decorate('customLogger', defaultLogger);

  // Hook para adicionar requestId automaticamente
  fastify.addHook('onRequest', async (request, reply) => {
    const requestId =
      request.headers['x-request-id'] ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    request.logger = defaultLogger.child({
      requestId,
      method: request.method,
      url: request.url
    });
  });
});
```

## Configuração via Variáveis de Ambiente

```bash
# .env
NODE_ENV=development          # development/production/test
LOG_LEVEL=debug              # fatal/error/warn/info/debug/trace/silent
SERVICE_NAME=my-fastify-app  # Nome do serviço nos logs
```

## Uso Avançado

### Logger Filho para Contexto

```typescript
// Criar logger com contexto específico
const userLogger = defaultLogger.child({
  module: 'user-service',
  version: '1.2.0'
});

// Todos os logs incluirão o contexto automaticamente
userLogger.info('Usuário criado', { userId: 123, email: 'user@example.com' });
// Output: {"level":"info","time":"...","module":"user-service","version":"1.2.0","userId":123,"email":"user@example.com","msg":"Usuário criado"}
```

### Sanitização de Dados Sensíveis

```typescript
// Dados sensíveis são automaticamente sanitizados
defaultLogger.info('Login attempt', {
  email: 'user@example.com',
  password: 'secret123', // Será: [REDACTED]
  token: 'abc123', // Será: [REDACTED]
  apiKey: 'key123' // Será: [REDACTED]
});
```

### Tratamento de Erros

```typescript
try {
  // Código que pode falhar
  await riskyOperation();
} catch (error) {
  defaultLogger.error('Operation failed', {
    error, // Stack trace será incluído automaticamente
    operationId: 'op-456',
    userId: 123
  });
}
```

### Verificação de Nível

```typescript
// Evitar processamento desnecessário em logs caros
if (defaultLogger.isLevelEnabled(LogLevel.DEBUG)) {
  const expensiveDebugData = generateExpensiveData();
  defaultLogger.debug('Debug information', { data: expensiveDebugData });
}
```

## Boas Práticas

### ✅ Fazer

- Usar níveis apropriados (`info` para eventos importantes, `debug` para detalhes)
- Incluir contexto relevante (requestId, userId, operationId)
- Usar logger filho para contextos específicos
- Logar início e fim de operações importantes
- Incluir métricas relevantes (tempo, tamanho, contadores)

### ❌ Evitar

- Logar dados sensíveis manualmente (use a sanitização automática)
- Logs excessivos em loops (pode impactar performance)
- Strings longas em produção (prefira objetos estruturados)
- Logs de debug em produção sem necessidade

## Exemplos por Cenário

### Autenticação

```typescript
const authLogger = defaultLogger.child({ module: 'auth' });

// Login bem-sucedido
authLogger.info('User authenticated successfully', {
  userId: user.id,
  email: user.email,
  loginMethod: 'password'
});

// Falha na autenticação
authLogger.warn('Authentication failed', {
  email: 'user@example.com',
  reason: 'invalid_credentials',
  attemptCount: 3
});
```

### Base de Dados

```typescript
const dbLogger = defaultLogger.child({ module: 'database' });

// Consulta lenta
dbLogger.warn('Slow query detected', {
  query: 'SELECT * FROM users WHERE status = ?',
  executionTime: 1500,
  rowCount: 10000
});

// Erro de conexão
dbLogger.error('Database connection failed', {
  error: connectionError,
  host: 'localhost:5432',
  database: 'myapp',
  retryAttempt: 3
});
```

### API Externa

```typescript
const apiLogger = defaultLogger.child({ module: 'external-api' });

// Chamada bem-sucedida
apiLogger.info('External API call completed', {
  service: 'payment-gateway',
  endpoint: '/api/v1/payments',
  statusCode: 200,
  responseTime: 250
});

// Rate limit
apiLogger.warn('API rate limit reached', {
  service: 'email-service',
  remainingQuota: 0,
  resetTime: '2024-01-01T12:00:00Z'
});
```

## Monitoramento e Observabilidade

### Logs Estruturados para Análise

Os logs são gerados em formato JSON, facilitando:

- **Agregação** em sistemas como ELK Stack, Grafana Loki
- **Alertas** baseados em campos específicos
- **Métricas** derivadas dos logs
- **Correlação** através de requestId e outros identificadores

### Integração com APM

```typescript
// Exemplo com OpenTelemetry ou similar
import { trace } from '@opentelemetry/api';

const span = trace.getActiveSpan();
const traceLogger = defaultLogger.child({
  traceId: span?.spanContext().traceId,
  spanId: span?.spanContext().spanId
});

traceLogger.info('Operation completed', { result: 'success' });
```

---

## Conclusão

O `LoggerManager` fornece uma solução completa e robusta para logging em aplicações Fastify, combinando performance, segurança e facilidade de uso. A integração com Pino garante alta performance, enquanto as funcionalidades de sanitização e configuração por ambiente tornam-no adequado para uso em produção.

Para usar o logger, simplesmente importe `defaultLogger` e comece a logar. Para necessidades mais específicas, use `LoggerManager.createLogger()` com configuração customizada.
