# Worker Container Separation

## Implementação Completa ✅

O sistema foi separado em dois containers independentes:

### 📦 **Container API** (Publisher)

- **Responsabilidade**: Receber requisições HTTP e publicar jobs na fila
- **Modo**: `WORKER_MODE=false` (padrão)
- **Componentes**: Fastify server + PersistentQueueManager (apenas publishing)

### 🏭 **Container Worker** (Consumer)

- **Responsabilidade**: Processar jobs da fila Redis/BullMQ
- **Modo**: `WORKER_MODE=true`
- **Componentes**: StandaloneWorker + QueueManager + JobHandlers

---

## 🚀 **Como Usar**

### **Desenvolvimento**

```bash
# Iniciar todos os serviços (API + 1 Worker + Dependencies)
pnpm run docker:dev

# Worker local (sem Docker)
pnpm run worker:dev

# Parar ambiente de desenvolvimento
pnpm run docker:dev:down
```

### **Produção**

```bash
# Iniciar produção com 1 worker (padrão)
pnpm run docker:prod

# Parar ambiente de produção
pnpm run docker:prod:down

# Build manual dos containers
pnpm run docker:build         # API container
pnpm run docker:build:worker  # Worker container
```

### **Escalando Workers Manualmente**

Para ajustar o número de workers, edite diretamente os arquivos docker-compose:

```yaml
# docker-compose.yml (produção)
worker:
  deploy:
    replicas: 3 # Altere para o número desejado

# docker-compose.dev.yml (desenvolvimento)
worker-dev:
  deploy:
    replicas: 2 # Altere para o número desejado
```

### **Monitoramento e Controle**

```bash
# Logs da API
pnpm run docker:logs

# Logs dos Workers
pnpm run docker:logs:worker

# Logs de todos os serviços
pnpm run docker:logs:all

# Status dos containers
pnpm run docker:ps

# Restart específico
pnpm run docker:restart:api      # Apenas API
pnpm run docker:restart:workers  # Apenas Workers
pnpm run docker:restart          # Todos os serviços
```

---

## 🏗️ **Arquitetura Implementada**

### **Publisher-Consumer Pattern**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Fastify API   │    │   Redis Queue   │    │  Worker Nodes   │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │PersistentQM │ ├────┤ │    BullMQ   │ ├────┤ │QueueManager │ │
│ │(Publisher)  │ │    │ │   (Queue)   │ │    │ │(Consumer)   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Componentes Criados**

### **Implementation Files**

#### **src/infraestructure/workers/worker.ts**

```typescript
class StandaloneWorker {
  - mongoManager: MongoConnectionManagerFactory
  - queueCache: QueueCache (Redis db1)
  - queueManager: QueueManager
  - handlers: QUEUE_HANDLERS integration
}
```

#### **src/infraestructure/workers/index.ts**

- Entry point para worker container
- Validation de environment variables
- Graceful shutdown handling
- Health check endpoint

#### **Dockerfile.worker**

- Container otimizado para worker
- Health check via HTTP endpoint
- Production-ready configuration

---

## 🔧 **Configuração**

### **Environment Variables**

As configurações são carregadas dos arquivos de environment:

#### **API Container (.env / .env.production):**

```bash
WORKER_MODE=false           # API mode (publisher only)
WORKER_CONCURRENCY=5        # (unused in API mode)
WORKER_BATCH_SIZE=50        # (unused in API mode)
WORKER_PROCESSING_INTERVAL=5000  # (unused in API mode)
QUEUE_NAME=app-queue        # Queue name for publishing
```

#### **Worker Container (.env.worker.development / .env.worker.production):**

```bash
WORKER_MODE=true            # Worker mode (consumer only)
WORKER_CONCURRENCY=5        # Number of concurrent jobs
WORKER_BATCH_SIZE=50        # Batch size for processing
WORKER_PROCESSING_INTERVAL=5000  # Processing interval (ms)
QUEUE_NAME=app-queue        # Queue name for consuming

# Database
MONGODB_URI=mongodb://mongo:27017/app

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
QUEUE_REDIS_HOST=redis
QUEUE_REDIS_PORT=6379
QUEUE_REDIS_DB=1

# Worker Health Check
PORT=3003                   # Health check endpoint port
```

### **Arquivos de Environment**

A configuração foi reorganizada para uma estrutura mais clara e específica:

```
.env.api.development      # API development container
.env.api.production       # API production container
.env.worker.development   # Worker development container
.env.worker.production    # Worker production container
.env.example             # Template com todas as variáveis
```

### **Mapeamento Docker Compose:**

````yaml
# docker-compose.yml (Produção)
app:    env_file: .env.api.production
worker: env_file: .env.worker.production

# docker-compose.dev.yml (Desenvolvimento)
app:        env_file: .env.api.development
worker-dev: env_file: .env.worker.development
```### **Validação Automática**

Todas as variáveis são validadas automaticamente pelo `validateEnv.ts`:

- **WORKER_MODE**: boolean (true/false)
- **WORKER_CONCURRENCY**: number (1-50, default: 5)
- **WORKER_BATCH_SIZE**: number (1-1000, default: 50)
- **WORKER_PROCESSING_INTERVAL**: number (1000-60000ms, default: 5000)
- **QUEUE_NAME**: string (min 1 char, default: 'app-queue')

### **Docker Compose Services**

#### **docker-compose.yml** (Produção)

```yaml
services:
  app: # API container (WORKER_MODE=false)
  worker: # Worker container
    replicas: 1 # 1 worker por padrão
    resources:
      limits: { cpus: '0.8', memory: 768M }
      reservations: { cpus: '0.3', memory: 256M }
````

#### **docker-compose.dev.yml** (Desenvolvimento)

```yaml
services:
  app: # API development
  worker-dev: # Worker development
    replicas: 1 # 1 worker por padrão
```

### **Escalabilidade Manual**

Para ajustar workers conforme a necessidade, edite diretamente:

```bash
# Editar número de replicas
vim docker-compose.yml        # Produção
vim docker-compose.dev.yml    # Desenvolvimento

# Ou usar docker-compose scale (runtime)
docker-compose up --scale worker=3      # 3 workers em produção
docker-compose -f docker-compose.dev.yml up --scale worker-dev=2  # 2 workers em dev
```

---

## 📊 **Benefícios da Separação**

### **Escalabilidade Independente**

- Escalar workers sem afetar API
- Escalar API sem afetar workers
- Resource allocation otimizado

### **Isolamento de Responsabilidades**

- API: HTTP handling + job publishing
- Worker: Job processing + business logic
- Failure isolation entre componentes

### **Performance**

- API responsivo (sem blocking jobs)
- Workers dedicados para processamento
- Paralelização horizontal

### **Deployment**

- Deploy independente de API e workers
- Rolling updates sem downtime
- A/B testing em workers

---

## 🧪 **Testing**

### **Local Testing**

```bash
# Test compilation
pnpm run build

# Test worker standalone
node scripts/test-worker.js

# Test API mode
WORKER_MODE=false pnpm run dev

# Test worker mode
WORKER_MODE=true pnpm run worker:dev
```

### **Integration Testing**

```bash
# Full environment test
pnpm run docker:dev

# Verify services
curl http://localhost:3001/health
curl http://localhost:3003/health  # Worker health
```

---

## 🎯 **Próximos Passos**

### **Monitoring & Observability**

- [ ] Metrics collection (Prometheus)
- [ ] Distributed tracing
- [ ] Custom dashboards

### **Advanced Scaling**

- [ ] Kubernetes deployment
- [ ] Auto-scaling based on queue size
- [ ] Multi-region workers

### **Enhanced Features**

- [ ] Job priorities
- [ ] Dead letter queue processing
- [ ] Worker specialization por job type

---

## 🔍 **Troubleshooting**

### **Common Issues**

1. **Worker não conecta ao Redis**

   ```bash
   # Check Redis connection
   docker-compose logs redis
   ```

2. **Jobs não são processados**

   ```bash
   # Check worker logs
   pnpm run docker:logs:worker
   ```

3. **API não publica jobs**
   ```bash
   # Verify WORKER_MODE=false
   docker-compose logs app
   ```

### **Debug Commands**

```bash
# Enter container
docker-compose exec worker bash

# Check processes
docker-compose ps

# Resource usage
docker-compose top
```

---

## ✅ **Status da Implementação**

- [x] StandaloneWorker class implementation
- [x] Worker entry point with health check
- [x] Dockerfile.worker configuration
- [x] Queue plugin mode separation
- [x] Docker Compose orchestration
- [x] Package.json scripts
- [x] Environment variable setup
- [x] Graceful shutdown handling
- [x] Error handling and logging
- [x] Development and production modes

**🎉 Worker separation implementation is complete and ready for use!**
