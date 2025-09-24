# Enhanced Cache Infrastructure

Sistema completo de cache usando **múltiplos clientes Redis** para aplicações Fastify com arquitetura aprimorada para separação de responsabilidades.

## 🏗️ **Nova Arquitetura Multi-Client**

### **Componentes Principais**

- **MultiRedisConnectionManager**: Gerencia múltiplas conexões Redis com padrão singleton por tipo
- **EnhancedCacheManager**: Interface de alto nível com suporte a clientes específicos
- **CacheServiceFactory**: Factory para criação de serviços especializados
- **Separação de Databases**: Isolamento completo entre cache de API e operações de queue

### **Estrutura de arquivos**

```
src/infraestructure/cache/
├── README.md                      # Esta documentação
├── redis.types.ts                 # 🆕 Tipos e configurações Redis
├── multi-redis.connection.ts      # 🆕 Gerenciador multi-client
├── enhanced-cache.manager.ts      # 🆕 Cache manager aprimorado
├── cache.factory.ts              # ✅ Factory atualizada
├── cache.service.ts              # ✅ Serviços atualizados
├── cache.plugin.ts               # ✅ Plugin Fastify atualizado
└── index.ts                      # Exportações e API pública
```

## 🎯 **Arquitetura de Clientes**

### **🔵 Cache Client** - **Database 0**

- **Propósito**: Cache de requisições de API
- **Uso**: Dados de aplicação, sessions, cache temporário
- **Namespace padrão**: `cache`, `app`, `session`, `temp`
- **TTL padrão**: 1 hora

### **🟡 Queue Client** - **Database 1**

- **Propósito**: Cache relacionado ao sistema de filas
- **Uso**: Coordenação de workers, cache de jobs, metadados de queue
- **Namespace padrão**: `queue-cache`, `queue-worker`
- **TTL padrão**: 30 minutos

## 🚀 **Configuração**

### **Variáveis de Ambiente**

```bash
# Redis Principal (Cache de API - Database 0)
REDIS_HOST=localhost            # Host do Redis
REDIS_PORT=6379                # Porta do Redis
REDIS_PASSWORD=                # Senha do Redis (opcional)
REDIS_DB=0                     # Database para cache de API

# Redis Queue (Sistema de Filas - Database 1)
QUEUE_REDIS_HOST=localhost     # Host Redis para queue (opcional, usa REDIS_HOST)
QUEUE_REDIS_PORT=6379          # Porta Redis para queue (opcional, usa REDIS_PORT)
QUEUE_REDIS_PASSWORD=          # Senha Redis para queue (opcional, usa REDIS_PASSWORD)
QUEUE_REDIS_DB=1              # Database para sistema de filas
```

> **💡 Fallback Inteligente**: Se as configurações `QUEUE_REDIS_*` não forem fornecidas, o sistema usa as configurações principais (`REDIS_*`) automaticamente, mudando apenas o database para `1`.

## 📋 **Uso da Nova API**

### **1. Inicialização Multi-Client**

```typescript
import { getMultiRedisConnectionManager } from '../infraestructure/cache/index.js';
import { config } from '../lib/validateEnv.js';

// Inicializar ambos os clientes Redis automaticamente
const connectionManager = getMultiRedisConnectionManager();
await connectionManager.initializeAll(config);

// Status de conexão para ambos os clientes
const allStatus = connectionManager.getAllConnectionStatus();
console.log('Cache Client Status:', allStatus.cache);
console.log('Queue Client Status:', allStatus.queue);
```

### **2. Cache Services com Factory**

```typescript
import { CacheServiceFactory } from '../infraestructure/cache/index.js';
import { config } from '../lib/validateEnv.js';

// Cache de API (usa database 0)
const apiCache = await CacheServiceFactory.createDefaultCacheService(config);
const sessionCache = await CacheServiceFactory.createSessionCacheService(config);

// Cache de Queue (usa database 1)
const queueCache = await CacheServiceFactory.createQueueCacheService(config);
const workerCache = await CacheServiceFactory.createQueueWorkerService(config);

// Uso isolado - sem conflitos entre databases
await apiCache.set('user:123', userData); // Database 0
await queueCache.set('job:456', jobData); // Database 1
```

### **3. Enhanced Cache Manager Direto**

```typescript
import { getCacheCacheManager, getQueueCacheManager } from '../infraestructure/cache/index.js';

// Cache Manager para API (Database 0)
const apiCacheManager = getCacheCacheManager(3600, 'api');
await apiCacheManager.initialize(config);

// Cache Manager para Queue (Database 1)
const queueCacheManager = getQueueCacheManager(1800, 'queue');
await queueCacheManager.initialize(config);

// Operações com isolamento completo
await apiCacheManager.set('route:/users', responseData);
await queueCacheManager.set('worker:stats', workerStats);
```

### **4. Integração com Fastify Plugin**

```typescript
// cache.plugin.ts - Plugin aprimorado
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { CacheServiceFactory } from '../infraestructure/cache/index.js';

export default async function enhancedCachePlugin(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
) {
  // Inicializar serviços de cache
  const apiCache = await CacheServiceFactory.createDefaultCacheService(fastify.config);
  const sessionCache = await CacheServiceFactory.createSessionCacheService(fastify.config);

  // Decorar instância Fastify com ambos os serviços
  fastify.decorate('apiCache', apiCache);
  fastify.decorate('sessionCache', sessionCache);

  // Hook para cache automático de rotas GET
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.method === 'GET') {
      const cacheKey = `route:${request.url}`;
      const cached = await fastify.apiCache.get(cacheKey);

      if (cached) {
        reply.send(cached);
        return;
      }
      request.cacheKey = cacheKey;
    }
  });

  // Hook para salvar resposta no cache
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (request.cacheKey && reply.statusCode === 200) {
      await fastify.apiCache.set(request.cacheKey, payload, { ttl: 300 });
    }
    return payload;
  });
}
```

## 🎨 **Patterns de Uso**

### **1. API Response Caching (Database 0)**

```typescript
const apiCache = await CacheServiceFactory.createDefaultCacheService(config);

// Cache de resposta de API
async function getUserProfile(userId: string) {
  const cacheKey = `profile:${userId}`;

  let profile = await apiCache.get(cacheKey);
  if (!profile) {
    profile = await userRepository.findById(userId);
    await apiCache.set(cacheKey, profile, { ttl: 3600 }); // 1 hora
  }

  return profile;
}
```

### **2. Session Management (Database 0)**

```typescript
const sessionCache = await CacheServiceFactory.createSessionCacheService(config);

// Gerenciamento de sessões
async function storeUserSession(sessionId: string, userData: any) {
  await sessionCache.set(sessionId, userData, {
    ttl: 86400, // 24 horas
    namespace: 'session'
  });
}

async function getUserSession(sessionId: string) {
  return await sessionCache.get(sessionId, { namespace: 'session' });
}
```

### **3. Queue Coordination (Database 1)**

```typescript
const queueCache = await CacheServiceFactory.createQueueCacheService(config);

// Cache para coordenação de filas
async function cacheJobResult(jobId: string, result: any) {
  await queueCache.set(`result:${jobId}`, result, {
    ttl: 1800, // 30 minutos
    namespace: 'queue-cache'
  });
}

// Worker statistics
async function updateWorkerStats(workerId: string, stats: any) {
  const workerCache = await CacheServiceFactory.createQueueWorkerService(config);
  await workerCache.set(`worker:${workerId}`, stats, {
    ttl: 900, // 15 minutos
    namespace: 'queue-worker'
  });
}
```

### **4. Mixed Operations com Isolamento**

```typescript
// Operações simultâneas sem conflitos
async function mixedOperations() {
  const apiCache = await CacheServiceFactory.createDefaultCacheService(config);
  const queueCache = await CacheServiceFactory.createQueueCacheService(config);

  // Mesmo key, databases diferentes - sem conflito
  await apiCache.set('user:123', { name: 'API User Data' }); // Database 0
  await queueCache.set('user:123', { job: 'Queue Job Data' }); // Database 1

  const apiData = await apiCache.get('user:123'); // { name: 'API User Data' }
  const queueData = await queueCache.get('user:123'); // { job: 'Queue Job Data' }
}
```

## 🔧 **Advanced Features**

### **Health Monitoring**

```typescript
const connectionManager = getMultiRedisConnectionManager();

// Status individual de cada cliente
const cacheStatus = connectionManager.getConnectionStatus(RedisClientType.CACHE);
const queueStatus = connectionManager.getConnectionStatus(RedisClientType.QUEUE);

// Ping específico para cada cliente
try {
  await connectionManager.ping(RedisClientType.CACHE);
  await connectionManager.ping(RedisClientType.QUEUE);
  console.log('Ambos os clientes estão operacionais');
} catch (error) {
  console.error('Problema de conectividade:', error);
}
```

### **Graceful Shutdown**

```typescript
// Desconectar todos os clientes graciosamente
process.on('SIGTERM', async () => {
  const connectionManager = getMultiRedisConnectionManager();
  await connectionManager.disconnectAll();
  console.log('Todos os clientes Redis desconectados');
});
```

### **Custom Client Configuration**

```typescript
// Criar serviço personalizado
const customCache = await CacheServiceFactory.createCustomCacheService(
  config,
  7200, // 2 horas TTL
  'custom-namespace', // Namespace personalizado
  RedisClientType.QUEUE // Usar cliente de queue explicitamente
);
```

## 📊 **Monitoramento e Métricas**

### **Connection Status**

```typescript
const allStatus = connectionManager.getAllConnectionStatus();

console.log('🔵 Cache Client (DB0):', {
  connected: allStatus.cache.connected,
  host: allStatus.cache.host,
  db: allStatus.cache.db
});

console.log('🟡 Queue Client (DB1):', {
  connected: allStatus.queue.connected,
  host: allStatus.queue.host,
  db: allStatus.queue.db
});
```

### **Cache Statistics por Cliente**

```typescript
const apiCache = getCacheCacheManager();
const queueCache = getQueueCacheManager();

console.log('📈 API Cache Stats:', {
  hitRatio: apiCache.getHitRatio(),
  stats: apiCache.getStats(),
  clientType: apiCache.getClientType()
});

console.log('📈 Queue Cache Stats:', {
  hitRatio: queueCache.getHitRatio(),
  stats: queueCache.getStats(),
  clientType: queueCache.getClientType()
});
```

## 🔒 **Isolamento e Segurança**

### **Database Isolation**

- **Database 0 (Cache)**: Exclusivamente para cache de API
- **Database 1 (Queue)**: Exclusivamente para operações de queue
- **Zero Cross-Contamination**: Chaves idênticas não conflitam
- **Independent TTLs**: Políticas de expiração independentes

### **Namespace Isolation**

```typescript
// Mesmo database, namespaces diferentes
await apiCache.set('user:123', data1, { namespace: 'session' });
await apiCache.set('user:123', data2, { namespace: 'temp' });

// Keys finais: 'session:user:123' e 'temp:user:123'
```

## 🚀 **Migration Guide**

### **Backward Compatibility**

```typescript
// ✅ Código existente continua funcionando (usa o novo sistema internamente)
import { getDefaultCache } from '../infraestructure/cache/index.js';

const cache = getDefaultCache(); // Agora usa EnhancedCacheManager com Cache Client (DB0)
await cache.initialize(config);
await cache.set('key', 'value');
```

### **Novo Código (Recomendado)**

```typescript
// ✅ Novo padrão com multi-client
import { CacheServiceFactory } from '../infraestructure/cache/index.js';

const apiCache = await CacheServiceFactory.createDefaultCacheService(config);
await apiCache.set('key', 'value');
```

### **Queue Integration**

```typescript
// ❌ Antes: Queue e Cache no mesmo database
const cache = getDefaultCache();
await cache.set('queue:job:123', jobData);

// ✅ Agora: Queue isolado em database separado
const queueCache = await CacheServiceFactory.createQueueCacheService(config);
await queueCache.set('job:123', jobData);
```

## 🎯 **Best Practices**

### **1. Client Selection**

- **API Data, Sessions, Temp**: Use `CacheServiceFactory.createDefaultCacheService()`
- **Queue Jobs, Worker Stats**: Use `CacheServiceFactory.createQueueCacheService()`
- **Worker Coordination**: Use `CacheServiceFactory.createQueueWorkerService()`

### **2. TTL Strategy**

- **API Cache**: 1-4 horas (frequentemente acessado)
- **Session Cache**: 24 horas (longa duração)
- **Queue Cache**: 30 minutos (processamento rápido)
- **Worker Cache**: 15 minutos (coordenação frequente)

### **3. Error Handling**

```typescript
try {
  const apiCache = await CacheServiceFactory.createDefaultCacheService(config);
  await apiCache.set('key', value);
} catch (error) {
  logger.error({ error, client: 'cache' }, 'Cache operation failed');
  // Fallback to direct database operation
}
```

### **4. Performance**

- Use **batch operations** quando possível
- **Monitor hit ratios** para otimizar TTLs
- **Clean up** namespaces regularmente
- **Connection pooling** é automático

## 🔍 **Troubleshooting**

### **Connection Issues**

```bash
# Verificar ambas as conexões Redis
redis-cli -h localhost -p 6379 -n 0 ping  # Cache client
redis-cli -h localhost -p 6379 -n 1 ping  # Queue client
```

### **Debug Mode**

```typescript
// Habilitar logs detalhados
const manager = getCacheCacheManager();
const connectionManager = getMultiRedisConnectionManager();

// Ver status detalhado
console.log('Manager ready:', manager.isReady());
console.log('All connections:', connectionManager.getAllConnectionStatus());
```

### **Common Issues**

1. **Wrong database**: Verifique `QUEUE_REDIS_DB=1`
2. **Mixed operations**: Use factory methods corretos
3. **Connection limit**: Monitor número de conexões Redis
4. **Memory usage**: Implemente limpeza regular de namespaces

---

## ✅ **Summary**

**Esta nova arquitetura multi-client oferece:**

- 🔵 **Separação Completa**: Cache de API (db0) e Queue (db1)
- 🔒 **Isolamento Total**: Zero conflitos entre sistemas
- 📈 **Performance**: Otimizações específicas por uso
- 🔧 **Flexibilidade**: Factory patterns para customização
- 📊 **Observabilidade**: Monitoring independente
- ⚡ **Backward Compatibility**: Código existente funciona sem modificações

**A arquitetura está pronta para produção com todas as funcionalidades necessárias para aplicações modernas!** 🚀

## Configuração

### Variáveis de ambiente

Adicione ao seu arquivo `.env`:

```bash
# Redis Configuration
REDIS_HOST=localhost      # Host do Redis (padrão: localhost)
REDIS_PORT=6379          # Porta do Redis (padrão: 6379)
REDIS_PASSWORD=          # Senha do Redis (opcional)
REDIS_DB=0              # Número do database (padrão: 0)
```

### Inicialização

```typescript
import { getCacheManager } from '../infraestructure/cache/index.js';
import { config } from '../lib/validateEnv.js';

// Inicializar o cache manager
const cacheManager = getCacheManager();
await cacheManager.initialize(config);
```

## Uso Básico

### Instâncias Pré-configuradas

```typescript
import {
  getDefaultCache, // TTL: 1 hora, namespace: 'app'
  getSessionCache, // TTL: 24 horas, namespace: 'session'
  getTempCache // TTL: 5 minutos, namespace: 'temp'
} from '../infraestructure/cache/index.js';

// Inicializar as instâncias
const cache = getDefaultCache();
const sessionCache = getSessionCache();
const tempCache = getTempCache();

await cache.initialize(config);
await sessionCache.initialize(config);
await tempCache.initialize(config);
```

### Operações Básicas

```typescript
// Salvar no cache
await cache.set('user:123', { id: 123, name: 'João' });

// Salvar com TTL customizado (30 segundos)
await cache.set('temp:data', { data: 'temporary' }, { ttl: 30 });

// Salvar com namespace customizado
await cache.set('config:app', { theme: 'dark' }, { namespace: 'settings' });

// Buscar do cache
const user = await cache.get<{ id: number; name: string }>('user:123');
if (user) {
  console.log(`Usuário: ${user.name}`);
}

// Verificar existência
const exists = await cache.exists('user:123');

// Deletar
const deleted = await cache.del('user:123');

// Limpar namespace inteiro
const cleared = await cache.clear('temp');
```

### Operações Avançadas

```typescript
// Definir TTL para chave existente
await cache.expire('user:123', 3600); // 1 hora

// Verificar TTL restante
const ttl = await cache.ttl('user:123'); // Segundos restantes (-1 se não tem TTL, -2 se não existe)

// Estatísticas do cache
const stats = cache.getStats();
console.log(`Hit ratio: ${cache.getHitRatio()}%`);
console.log(`Total hits: ${stats.hits}`);
console.log(`Total misses: ${stats.misses}`);

// Reset estatísticas
cache.resetStats();

// Verificar conectividade
const pong = await cache.ping(); // 'PONG'
```

## Integração com Fastify

### Plugin de Cache

```typescript
// cache.plugin.ts
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getDefaultCache } from '../infraestructure/cache/index.js';

export default async function cachePlugin(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Inicializar cache
  const cache = getDefaultCache();
  await cache.initialize(fastify.config);

  // Decorar instância Fastify
  fastify.decorate('cache', cache);

  // Hook para verificar cache antes das rotas
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.method === 'GET') {
      const cacheKey = `route:${request.url}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        reply.send(cached);
        return;
      }

      // Armazenar chave para usar no onSend
      request.cacheKey = cacheKey;
    }
  });

  // Hook para salvar resposta no cache
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (request.cacheKey && reply.statusCode === 200) {
      await cache.set(request.cacheKey, payload, { ttl: 300 }); // 5 minutos
    }
    return payload;
  });
}

// Registrar no app.ts
await fastify.register(cachePlugin);
```

### Uso em Controladores

```typescript
// auth.controller.ts
export default async function authController(fastify: FastifyInstance) {
  fastify.get('/auth/profile/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cacheKey = `profile:${id}`;

    // Tentar buscar no cache primeiro
    let profile = await fastify.cache.get(cacheKey);

    if (!profile) {
      // Não está no cache, buscar no banco
      profile = await getUserProfile(id);

      // Salvar no cache por 1 hora
      await fastify.cache.set(cacheKey, profile, { ttl: 3600 });
    }

    return { profile };
  });

  fastify.post('/auth/login', async (request, reply) => {
    // ... lógica de login ...

    // Invalidar cache do perfil após login
    await fastify.cache.del(`profile:${user.id}`);

    return { token, user };
  });
}
```

## Patterns de Cache

### 1. Cache-Aside (Lazy Loading)

```typescript
async function getUserData(userId: string) {
  const cacheKey = `user:${userId}`;

  // Tentar cache primeiro
  let user = await cache.get<User>(cacheKey);

  if (!user) {
    // Cache miss - buscar no banco
    user = await userRepository.findById(userId);

    if (user) {
      // Salvar no cache
      await cache.set(cacheKey, user, { ttl: 3600 });
    }
  }

  return user;
}
```

### 2. Write-Through

```typescript
async function updateUser(userId: string, data: Partial<User>) {
  // Atualizar banco primeiro
  const user = await userRepository.update(userId, data);

  // Atualizar cache também
  const cacheKey = `user:${userId}`;
  await cache.set(cacheKey, user, { ttl: 3600 });

  return user;
}
```

### 3. Write-Behind (Write-Back)

```typescript
async function updateUserAsync(userId: string, data: Partial<User>) {
  const cacheKey = `user:${userId}`;

  // Atualizar cache imediatamente
  await cache.set(cacheKey, { ...(await getUserFromCache(userId)), ...data });

  // Agendar atualização do banco (queue, timer, etc.)
  scheduleDBUpdate(userId, data);
}
```

## Monitoramento

### Logs e Diagnósticos

O sistema de cache registra automaticamente erros e informações importantes:

```typescript
// Os logs são emitidos automaticamente pela conexão Redis
// Exemplos de logs que você verá:

// Sucesso na conexão
// Redis: Successfully connected

// Erro de conexão
// Redis: Connection failed Error: connect ECONNREFUSED 127.0.0.1:6379

// Cache hits/misses (debug level)
// Cache hit for route:GET:/auth/me:user:123
// Cache miss for route:GET:/auth/me:user:123

// Estatísticas (através de fastify.cache.getStats())
const stats = fastify.cache.getStats();
console.log({
  hits: stats.hits,
  misses: stats.misses,
  hitRatio: fastify.cache.getHitRatio()
});
```

### Middleware de Logging

```typescript
// middleware de logging
fastify.addHook('preHandler', async request => {
  const startTime = Date.now();

  request.onResponseComplete = () => {
    const duration = Date.now() - startTime;
    const stats = fastify.cache.getStats();

    fastify.log.info({
      url: request.url,
      method: request.method,
      duration,
      cacheHitRatio: fastify.cache.getHitRatio(),
      cacheStats: stats
    });
  };
});
```

## Segurança

### Sanitização de Chaves

O CacheManager automaticamente sanitiza as chaves para prevenir:

- Injection attacks
- Caracteres inválidos no Redis
- Chaves muito longas

```typescript
// Chaves são automaticamente sanitizadas
await cache.set('user/123<script>', data); // Vira: 'user_123_script'
```

### Namespaces

Use namespaces para isolar dados:

```typescript
await cache.set('user:123', userData, { namespace: 'public' });
await cache.set('user:123', sensitiveData, { namespace: 'private' });
```

## Troubleshooting

### Problemas Comuns

1. **Erro de conexão Redis**:

   ```bash
   # Verificar se Redis está rodando
   redis-cli ping
   ```

2. **TTL não funcionando**:

   ```typescript
   // Verificar TTL
   const ttl = await cache.ttl('key');
   console.log(ttl); // -1 = sem TTL, -2 = não existe
   ```

3. **Serialização/Deserialização**:
   ```typescript
   // Dados complexos podem ter problemas
   const data = { date: new Date(), regex: /test/ };
   await cache.set('complex', data); // Date vira string, regex se perde
   ```

### Debug Mode

```typescript
// Habilitar logs detalhados
const cache = new CacheManager();
// Logs automáticos em debug level
```

## Performance

### Benchmarks Internos

- **Set**: ~0.5ms por operação
- **Get**: ~0.3ms por operação
- **Hit ratio**: Aim for >80%
- **Memory usage**: Monitore com Redis INFO

### Otimizações

1. **Use TTL apropriado**: Não deixe dados órfãos
2. **Batch operations**: Use pipelines para múltiplas operações
3. **Compress large data**: Para objetos >1KB
4. **Monitor hit ratios**: Ajuste strategy se <70%

---

O sistema de cache está pronto para uso em produção com todas as funcionalidades necessárias para uma aplicação moderna! 🚀
