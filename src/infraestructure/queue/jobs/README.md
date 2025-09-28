# Queue Jobs System# Queue Jobs System

Jobs auto-contidos para processamento assíncrono com **MongoDB persistência** e **BullMQ performance**.Jobs auto-contidos para processamento assíncrono com **MongoDB persistência** e **BullMQ performance**.

## 🏗️ **Estrutura**## 🏗️ **Estrutura**

```

jobs/jobs/

├── business/                       # 💼 Jobs de negócio├── business/                       # 💼 Jobs de negócio

│   ├── emailSend.job.ts           # ✅ Envio de emails│   ├── emailSend.job.ts           # ✅ Envio de emails

│   ├── userNotification.job.ts    # ✅ Notificações do usuário  │   ├── userNotification.job.ts    # ✅ Notificações do usuário

│   ├── dataExport.job.ts          # ✅ Exportação de dados│   ├── dataExport.job.ts          # ✅ Exportação de dados

│   └── fileProcess.job.ts         # ✅ Processamento de arquivos│   └── fileProcess.job.ts         # ✅ Processamento de arquivos

├── maintenance/                    # 🔧 Manutenção do sistema├── maintenance/                    # 🔧 Manutenção do sistema

│   └── cacheWarm.job.ts           # ✅ Cache warming│   └── cacheWarm.job.ts           # ✅ Cache warming

└── README.md└── README.md

```

## 📧 **Email Send Job**## 📧 **Email Send Job**

Envio de emails com templates integrados.Envio de emails com templates integrados.

### **Interface**### **Interface**

`typescript`typescript

interface EmailSendData {interface EmailSendData {

userId: string; userId: string;

template: 'welcome' | 'password_reset' | 'notification'; template: 'welcome' | 'password_reset' | 'notification';

variables: Record<string, any>; variables: Record<string, any>;

to: string; to: string;

subject?: string; subject?: string;

}}

````



### **Uso**### **Uso**

```typescript```typescript

await fastify.persistentQueueManager.addJob('email:send', {await fastify.persistentQueueManager.addJob('email:send', {

  userId: '123',  userId: '123',

  template: 'welcome',  template: 'welcome',

  variables: { userName: 'John' },  variables: { userName: 'John' },

  to: 'john@example.com'  to: 'john@example.com'

});});

````

## 🔔 **User Notification Job**## 🔔 **User Notification Job**

Notificações internas do sistema.Notificações internas do sistema.

### **Interface**### **Interface**

`typescript`typescript

interface UserNotificationData {interface UserNotificationData {

userId: string; userId: string;

message: string; message: string;

type: 'info' | 'warning' | 'success' | 'error'; type: 'info' | 'warning' | 'success' | 'error';

data?: Record<string, any>; data?: Record<string, any>;

}}

````



## 📊 **Data Export Job**## 📊 **Data Export Job**



Exportação de dados em formatos CSV, JSON, Excel.Exportação de dados em formatos CSV, JSON, Excel.



### **Interface**### **Interface**

```typescript```typescript

interface DataExportData {interface DataExportData {

  exportType: 'users' | 'orders' | 'reports';  exportType: 'users' | 'orders' | 'reports';

  format: 'csv' | 'json' | 'excel';  format: 'csv' | 'json' | 'excel';

  filters?: Record<string, any>;  filters?: Record<string, any>;

  userId: string; // Usuário que solicitou  userId: string; // Usuário que solicitou

}}

````

## 🔄 **Características dos Jobs**## 🔄 **Características dos Jobs**

### **Auto-Contidos**### **Auto-Contidos**

- **Zero dependências externas**: Funcionam independentemente- **Zero dependências externas**: Funcionam independentemente

- **Testabilidade**: Testes unitários completos- **Testabilidade**: Testes unitários completos

- **Reutilização**: Usáveis fora do contexto BullMQ- **Reutilização**: Usáveis fora do contexto BullMQ

### **Persistência Inteligente** ### **Persistência Inteligente**

- **MongoDB**: Estado persistente do job- **MongoDB**: Estado persistente do job

- **BullMQ**: Processing otimizado- **BullMQ**: Processing otimizado

- **Sincronização**: Automática entre sistemas- **Sincronização**: Automática entre sistemas

### **Error Handling**### **Error Handling**

- **Retry Logic**: Configurável por job type- **Retry Logic**: Configurável por job type

- **Dead Letter Queue**: Jobs com falhas múltiplas - **Dead Letter Queue**: Jobs com falhas múltiplas

- **Logging**: Estruturado com contexto completo- **Logging**: Estruturado com contexto completo

### **Performance**### **Performance**

- **Batch Processing**: Grupos de jobs processados juntos- **Batch Processing**: Grupos de jobs processados juntos

- **Priority Queues**: Jobs críticos processados primeiro- **Priority Queues**: Jobs críticos processados primeiro

- **Resource Management**: Controle de concorrência- **Resource Management**: Controle de concorrência

## 🎯 **Job Lifecycle**## 🎯 **Job Lifecycle**

1. **Creation**: Persiste no MongoDB → Envia para Redis1. **Creation**: Persiste no MongoDB → Envia para Redis

2. **Processing**: BullMQ processa via workers2. **Processing**: BullMQ processa via workers

3. **Update**: Status atualizado no MongoDB3. **Update**: Status atualizado no MongoDB

4. **Completion**: Resultado salvo + logs + cleanup4. **Completion**: Resultado salvo + logs + cleanup

5. **Error**: Retry ou move para DLQ conforme configuração5. **Error**: Retry ou move para DLQ conforme configuração

## 🔧 **Desenvolvimento**## 🔧 **Desenvolvimento**

### **Criar Novo Job**### **Criar Novo Job**

`typescript`typescript

// jobs/business/myNewJob.ts// jobs/business/myNewJob.ts

export async function handleMyNewJob(export async function handleMyNewJob(

data: MyJobData, data: MyJobData,

context: JobContext context: JobContext

): Promise<MyJobResult> {): Promise<MyJobResult> {

try { try {

    // Lógica do job    // Lógica do job

    return { success: true, result: processedData };    return { success: true, result: processedData };

} catch (error) { } catch (error) {

    return { success: false, error: error.message };    return { success: false, error: error.message };

} }

}}

````



### **Registrar Handler**### **Registrar Handler**

```typescript```typescript

// jobs/index.ts// jobs/index.ts

export const JOB_HANDLERS = {export const JOB_HANDLERS = {

  'my:newjob': handleMyNewJob,  'my:newjob': handleMyNewJob,

  // ... outros handlers  // ... outros handlers

};};

````

## 📊 **Monitoramento**## � **Monitoramento**

### **Bull Dashboard**### **Bull Dashboard**

- **URL**: http://localhost:3002/ui- **URL**: http://localhost:3002/ui

- **Jobs**: Ativos, completados, falhos em tempo real- **Jobs**: Ativos, completados, falhos em tempo real

- **Retry**: Gerenciamento de tentativas- **Retry**: Gerenciamento de tentativas

### **Logs**### **Logs**

`bash`bash

INFO: Job email:send started (jobId: email-123-1699...)INFO: Job email:send started (jobId: email-123-1699...)

INFO: Job email:send completed in 245msINFO: Job email:send completed in 245ms

ERROR: Job data:export failed after 3 attempts, moved to DLQERROR: Job data:export failed after 3 attempts, moved to DLQ

````
  dlqReason?: string;
}
```

#### **Como Usar**

```typescript
// 1. Via Fastify (usado no AuthController)
const jobId = await fastify.addJob(
  `registration-email-${user.id}-${Date.now()}`,
  'registration-email',
  {
    userId: user.id,
    userName: user.name,
    userEmail: user.email
  },
  {
    attempts: 1, // Single attempt (evita duplicatas)
    priority: 10 // Alta prioridade
  }
);

// 2. Diretamente (para testes ou CLI)
import { handleRegistrationEmailJob } from './business/registrationEmailJob.js';

const result = await handleRegistrationEmailJob(
  {
    userId: 'user_123',
    userName: 'João Silva',
    userEmail: 'joao@example.com'
  },
  'manual-job-123',
  logger
);
```

#### **Características Técnicas**

- ✅ **Template Integrado**: Usa `registration_success` template
- ✅ **SMTP Configurado**: Funciona com Mailpit/SMTP real
- ✅ **Error Handling**: Tratamento completo de erros
- ✅ **Logging Estruturado**: Logs detalhados com métricas
- ✅ **Configuração Dinâmica**: Lê configurações do ambiente
- ✅ **Single Attempt**: Evita emails duplicados
- ✅ **Performance**: ~83ms tempo médio de processamento

#### **Exemplo de Log**

```bash
# Processamento iniciado
INFO: Processing registration email job
  jobId: "registration-email-68d85d0b-1759010059"
  userId: "68d85d0b1ef3a564e56b5b63"
  userEmail: "ana@example.com"
  attempt: 1

# Email enviado com sucesso
INFO: Registration email sent successfully
  jobId: "registration-email-68d85d0b-1759010059"
  userId: "68d85d0b1ef3a564e56b5b63"
  messageId: "<7d17cbf6-ce16-37bd-d727-1c6c0826d022@boilerplate.com>"
  processingTime: 51
  template: "registration_success"
```

### **Template de Email**

O job usa o template `registration_success` com as seguintes variáveis:

- `userName`: Nome do usuário para personalização
- **Subject**: "🎉 Parabéns {userName}! Seu cadastro foi realizado com sucesso"
- **Conteúdo**: HTML responsivo com boas-vindas e instruções

## 🔄 **Jobs Placeholder** (Para desenvolvimento futuro)

### **User Notification Job**

```typescript
// Futuro: user:notification
interface UserNotificationData {
  userId: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  channels?: ('email' | 'push' | 'sms')[];
}

// Uso futuro
await fastify.addJob('user-notification-123', 'user:notification', {
  userId: '123',
  message: 'Seu pedido foi processado com sucesso',
  type: 'info',
  channels: ['email', 'push']
});
```

### **Data Export Job**

```typescript
// Futuro: data:export
interface DataExportData {
  exportType: 'users' | 'orders' | 'reports';
  format: 'csv' | 'json' | 'xlsx';
  filters?: Record<string, any>;
  requestedBy: string;
}

// Uso futuro
await fastify.addJob('data-export-456', 'data:export', {
  exportType: 'users',
  format: 'csv',
  requestedBy: 'admin_123'
});
```

## 🔧 **Adicionando Novos Jobs**

### **1. Criar Job Auto-Contido**

```typescript
// src/infraestructure/queue/jobs/business/myNewJob.ts
import type { FastifyBaseLogger } from 'fastify';

/**
 * Data interface para o novo job
 */
export interface MyNewJobData {
  userId: string;
  action: string;
  parameters?: Record<string, any>;
}

/**
 * Result interface para o novo job
 */
export interface MyNewJobResult {
  success: boolean;
  jobId: string;
  data?: any;
  error?: string;
  processingTime: number;
  userId: string;
}

/**
 * Handler auto-contido - funciona independentemente do BullMQ
 */
export async function handleMyNewJob(
  data: MyNewJobData,
  jobId: string,
  logger: FastifyBaseLogger,
  metadata?: {
    attempt: number;
    maxAttempts: number;
    queuedAt: Date;
    processingAt: Date;
  }
): Promise<MyNewJobResult> {
  const startTime = Date.now();

  logger.info(
    {
      jobId,
      userId: data.userId,
      action: data.action,
      attempt: metadata?.attempt || 1
    },
    'Processing my new job'
  );

  try {
    // Validação dos dados
    if (!data.userId || !data.action) {
      throw new Error('Missing required fields: userId or action');
    }

    // Lógica do job (auto-contida)
    const result = await processMyNewJobLogic(data);

    const processingTime = Date.now() - startTime;

    logger.info(
      {
        jobId,
        userId: data.userId,
        action: data.action,
        processingTime,
        result: result.status
      },
      'My new job completed successfully'
    );

    return {
      success: true,
      jobId,
      data: result,
      processingTime,
      userId: data.userId
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        jobId,
        userId: data.userId,
        error: errorMessage,
        processingTime,
        attempt: metadata?.attempt || 1
      },
      'My new job failed'
    );

    return {
      success: false,
      jobId,
      error: errorMessage,
      processingTime,
      userId: data.userId
    };
  }
}

/**
 * Lógica de processamento auto-contida
 */
async function processMyNewJobLogic(data: MyNewJobData): Promise<any> {
  // Implementar a lógica específica aqui
  // Esta função não depende de BullMQ ou Fastify

  return {
    status: 'processed',
    action: data.action,
    processedAt: new Date().toISOString()
  };
}
```

### **2. Criar Adapter BullMQ**

```typescript
// src/infraestructure/queue/handlers.ts
import { handleMyNewJob, type MyNewJobData } from './jobs/business/myNewJob.js';

export async function bullmqMyNewJobHandler(
  data: MyNewJobData,
  logger?: FastifyBaseLogger
): Promise<any> {
  const jobLogger = logger || defaultLogger;
  const jobId = `my-new-job-${data.userId}-${Date.now()}`;

  try {
    const result = await handleMyNewJob(data, jobId, jobLogger, {
      attempt: 1,
      maxAttempts: 1,
      queuedAt: new Date(),
      processingAt: new Date()
    });

    if (result.success) {
      jobLogger.info(`My new job completed: ${jobId}`);
      return result.data;
    } else {
      throw new Error(result.error || 'My new job failed');
    }
  } catch (error) {
    jobLogger.error(`My new job failed: ${jobId} - ${error}`);
    throw error;
  }
}

// Adicionar ao registry
export const QUEUE_HANDLERS: Record<string, QueueJobHandler> = {
  'registration-email': bullmqRegistrationEmailHandler,
  'user:notification': bullmqUserNotificationHandler,
  'data:export': bullmqDataExportHandler,
  'my-new-job': bullmqMyNewJobHandler // ← Novo handler
};
```

### **3. Usar o Novo Job**

```typescript
// No controller ou service
const jobId = await fastify.addJob(
  `my-new-job-${userId}-${Date.now()}`,
  'my-new-job',
  {
    userId: 'user_123',
    action: 'process_data',
    parameters: { type: 'full' }
  },
  {
    attempts: 1,
    priority: 5
  }
);
```

## 🧪 **Testando Jobs**

### **Teste Unitário (Job Isolado)**

```typescript
// tests/jobs/registrationEmail.test.ts
import { handleRegistrationEmailJob } from '../../../src/infraestructure/queue/jobs/business/registrationEmailJob.js';

describe('Registration Email Job', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  } as any;

  it('should process registration email successfully', async () => {
    const result = await handleRegistrationEmailJob(
      {
        userId: 'test_user_123',
        userName: 'Test User',
        userEmail: 'test@example.com'
      },
      'test_job_123',
      mockLogger
    );

    expect(result.success).toBe(true);
    expect(result.jobId).toBe('test_job_123');
    expect(result.userId).toBe('test_user_123');
    expect(result.messageId).toBeDefined();
  });

  it('should fail with missing data', async () => {
    const result = await handleRegistrationEmailJob(
      {
        userId: '',
        userName: 'Test User',
        userEmail: 'test@example.com'
      },
      'test_job_456',
      mockLogger
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required registration email data');
  });
});
```

### **Teste de Integração (BullMQ)**

```typescript
// tests/integration/queue.test.ts
describe('Queue Integration', () => {
  it('should process registration email via BullMQ', async () => {
    const jobId = await fastify.addJob(
      'test-registration-email-integration',
      'registration-email',
      {
        userId: 'test_user_integration',
        userName: 'Integration Test User',
        userEmail: 'integration@test.com'
      }
    );

    // Wait for job processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify job completion
    const stats = await fastify.queueManager.getStats();
    expect(stats.completed).toBeGreaterThan(0);
  });
});
```

### **Teste Manual via API**

```bash
# Testar job de registro via REST
curl -X POST http://localhost:3001/test-delayed-email \
  -H "Content-Type: application/json"

# Response esperado:
# {
#   "success": true,
#   "message": "Delayed job added successfully",
#   "data": {
#     "jobId": "test-delayed-email-1759010259123",
#     "delay": 10000
#   }
# }
```

## 📊 **Monitoramento de Jobs**

### **Bull Dashboard**

- **URL**: http://localhost:3002/ui
- **Métricas**: Active, Waiting, Completed, Failed, Delayed jobs
- **Real-time**: Updates automáticos conforme jobs são processados

### **Logs Estruturados**

```bash
# Job iniciado
INFO: Processing registration email job
  jobId: "registration-email-123"
  userId: "user_456"
  attempt: 1

# Job concluído
INFO: Registration email sent successfully
  jobId: "registration-email-123"
  messageId: "<abc@boilerplate.com>"
  processingTime: 83
```

### **Estatísticas Via API**

```typescript
// Estatísticas da queue
const stats = await fastify.queueManager.getStats();
console.log({
  waiting: stats.waiting, // Jobs aguardando processamento
  active: stats.active, // Jobs sendo processados
  completed: stats.completed, // Jobs concluídos
  failed: stats.failed // Jobs que falharam
});
```

## 🚀 **Roadmap de Jobs**

### **Próximos Jobs Planejados**

#### **High Priority**

- [ ] **File Processing Job**: Image resize, document conversion
- [ ] **User Notification Job**: Push, SMS, email notifications
- [ ] **Data Export Job**: CSV, JSON, Excel exports

#### **Medium Priority**

- [ ] **Cache Warming Job**: Pré-aquecimento de dados críticos
- [ ] **Cleanup Jobs**: Limpeza automática de arquivos temporários
- [ ] **Report Generation Job**: Relatórios automáticos

#### **Future Enhancements**

- [ ] **Job Scheduling**: Cron-like jobs recorrentes
- [ ] **Job Chaining**: Pipeline de jobs dependentes
- [ ] **Batch Processing**: Processamento em lotes eficiente

### **Padrões Estabelecidos** ✅

1. **Jobs Auto-Contidos**: Funcionam independentemente do BullMQ
2. **Interfaces TypeScript**: Tipagem forte para dados e resultados
3. **Logging Estruturado**: Logs detalhados e configuráveis
4. **Error Handling**: Tratamento completo de erros e edge cases
5. **Performance Tracking**: Métricas de tempo de processamento
6. **Testabilidade**: Jobs facilmente testáveis unitariamente

O sistema está preparado para expansão seguindo estes padrões estabelecidos! 🎯
````
