# Queu```

src/infraestructure/queue/
├── persistentQueueManager.ts # 🎯 Coordenador principal - MongoDB + Redis
├── plugin.ts # 🔌 Plugin Fastify com inicialização
├── queue.ts # ⚡ BullMQ manager (Redis)
├── handlers.ts # 🔄 Job handlers registry
├── jobs/ # 📋 Implementações de jobs
│ ├── business/ # 💼 Jobs de negócio
│ └── maintenance/ # 🔧 Jobs de manutenção
└── README.md

```ture - Persistent Job Processing

Sistema de processamento de jobs com **BullMQ v5.58.7** + **MongoDB** para persistência e **Redis** para performance, com Dead Letter Queue e batch processing.

## 🏗️ **Arquitetura**

```

src/infraestructure/queue/
├── persistentQueueManager.ts # 🎯 Coordenador principal - MongoDB + Redis
├── plugin.ts # 🔌 Plugin Fastify com inicialização
├── queue.manager.ts # ⚡ BullMQ manager (Redis)
├── resilient.queue.manager.ts # 🛡️ Resiliente com fallback Redis
├── dlq.manager.ts # � Dead Letter Queue manager
├── jobs/ # 📋 Implementações de jobs
│ ├── business/ # 💼 Jobs de negócio
│ └── maintenance/ # 🔧 Jobs de manutenção
└── README.md

````

## ⚙️ **Configuração**

### **Environment Variables**
```env
# Redis (Queue + Cache)
QUEUE_REDIS_HOST=redis
QUEUE_REDIS_PORT=6379
QUEUE_REDIS_DB=1

# MongoDB (Persistência)
MONGODB_URI=mongodb://mongo:27017/boilerplate

# Processing
BATCH_SIZE=10
BATCH_TIMEOUT=30000
````

## 🚀 **Uso**

### **Adicionar Jobs**

```typescript
// Via PersistentQueueManager
const jobId = await fastify.persistentQueueManager.addJob(
  'email:send',
  { userId: '123', template: 'welcome' },
  { priority: 10, attempts: 3 }
);
```

### **Jobs Disponíveis**

- `email:send` - Envio de emails
- `user:notification` - Notificações do usuário
- `data:export` - Exportação de dados
- `file:process` - Processamento de arquivos

## 📊 **Monitoramento**

### **Bull Dashboard**

- **URL**: http://localhost:3002/ui
- **Estatísticas**: Jobs ativos, completados, falhos
- **Retry Management**: Gerenciamento de tentativas

### **Estatísticas MongoDB**

```typescript
const stats = await fastify.persistentQueueManager.getJobStats();
// { pending: 5, processing: 2, completed: 100, failed: 1 }
```

## 🔧 **Funcionalidades**

### **Persistência Dupla**

- **MongoDB**: Armazenamento permanente de jobs
- **Redis/BullMQ**: Processing de alta performance
- **Sincronização**: Automática entre sistemas

### **Dead Letter Queue**

- **Falhas**: Jobs que falharam múltiplas vezes
- **Análise**: Tracking de motivos de falha
- **Reprocessamento**: Possibilidade de retry manual

### **Batch Processing**

- **Lotes**: Processamento em grupos de 10 jobs
- **Timeout**: 30s por batch
- **Eficiência**: Reduz overhead de I/O

### **Resiliência**

- **Redis Failure**: Fallback para processamento local
- **Cleanup**: Limpeza automática de jobs antigos
- **Retry**: Exponential backoff configurável

## 🎯 **Fluxo de Processamento**

1. **Job Creation**: Persiste no MongoDB → Envia para Redis
2. **Batch Processing**: Carrega lotes do MongoDB
3. **BullMQ Processing**: Processa via Redis workers
4. **Status Update**: Atualiza MongoDB com resultado
5. **Error Handling**: Jobs falhos → Dead Letter Queue

## 🔄 **Lifecycle Management**

- **Startup**: Inicialização automática de batch processing
- **Shutdown**: Graceful shutdown com cleanup
- **Health Check**: Monitoramento de conexões
- **Auto Recovery**: Recuperação automática de falhas Redis
