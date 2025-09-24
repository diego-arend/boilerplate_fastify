# Queue Jobs System

Sistema de jobs assíncronos com suporte completo a templates de email e processamento em background.

## 📁 **Estrutura**

```
jobs/
├── business/               # Jobs de regras de negócio
│   ├── emailSend.job.ts   # ✅ Job de envio de emails com templates
│   └── emailSend.examples.ts # Exemplos de uso de emails
├── maintenance/           # Jobs de manutenção do sistema
└── index.ts              # Registry de todos os handlers
```

## 📧 **Email Job Handler**

### **Características Principais**

- ✅ **7 Templates Predefinidos**: Welcome, Password Reset, Order Confirmation, Invoice, Newsletter, System Alert, Custom
- ✅ **Validação Automática**: Variáveis obrigatórias por template
- ✅ **Multi-destinatários**: TO, CC, BCC com validação de emails
- ✅ **Anexos**: Suporte a múltiplos anexos (até 25MB total)
- ✅ **Agendamento**: Envio programado com timezone
- ✅ **Rastreamento**: Opens e clicks tracking
- ✅ **Prioridades**: High, Normal, Low
- ✅ **Retry Logic**: Tentativas automáticas com DLQ

### **Templates Disponíveis**

| Template             | Variáveis Obrigatórias                                     | Uso                             |
| -------------------- | ---------------------------------------------------------- | ------------------------------- |
| `WELCOME`            | userName, activationLink                                   | Boas-vindas para novos usuários |
| `PASSWORD_RESET`     | userName, resetLink, expiresIn                             | Reset de senhas                 |
| `ORDER_CONFIRMATION` | orderNumber, customerName, orderItems, totalAmount         | Confirmação de pedidos          |
| `INVOICE`            | invoiceNumber, customerName, amount, dueDate, downloadLink | Faturas e cobrança              |
| `NEWSLETTER`         | unsubscribeLink                                            | Newsletters e campanhas         |
| `SYSTEM_ALERT`       | alertType, message, timestamp                              | Alertas do sistema              |
| `CUSTOM`             | _(nenhuma - usa customHtml/customText)_                    | Emails personalizados           |

### **Como Usar**

```typescript
import { QueueJobType, JobPriority } from '../queue.types.js';
import { EmailTemplateConstants } from './jobs/index.js';

// 1. Email de boas-vindas
const welcomeJob = await queueManager.addJob({
  type: QueueJobType.EMAIL_SEND,
  data: {
    to: 'newuser@example.com',
    subject: 'Welcome to Our Platform!',
    template: EmailTemplateConstants.WELCOME,
    variables: {
      userName: 'John Doe',
      activationLink: 'https://app.example.com/activate?token=abc123'
    },
    priority: 'high',
    trackOpens: true,
    userId: 'user_123'
  },
  priority: JobPriority.HIGH,
  maxAttempts: 3
});

// 2. Reset de senha
const resetJob = await queueManager.addJob({
  type: QueueJobType.EMAIL_SEND,
  data: {
    to: 'user@example.com',
    template: EmailTemplateConstants.PASSWORD_RESET,
    variables: {
      userName: 'Jane Smith',
      resetLink: 'https://app.example.com/reset?token=xyz789',
      expiresIn: '24 hours'
    },
    priority: 'high',
    trackOpens: true
  },
  priority: JobPriority.CRITICAL
});

// 3. Confirmação de pedido
const orderJob = await queueManager.addJob({
  type: QueueJobType.EMAIL_SEND,
  data: {
    to: 'customer@example.com',
    cc: 'sales@company.com',
    template: EmailTemplateConstants.ORDER_CONFIRMATION,
    variables: {
      orderNumber: 'ORD-2024-001',
      customerName: 'Alice Johnson',
      orderItems: [
        { name: 'Widget', quantity: 2, price: '29.99' },
        { name: 'Gadget', quantity: 1, price: '49.99' }
      ],
      totalAmount: '109.97'
    },
    priority: 'high',
    trackOpens: true
  },
  priority: JobPriority.HIGH
});

// 4. Newsletter para múltiplos destinatários
const newsletterJob = await queueManager.addJob({
  type: QueueJobType.EMAIL_SEND,
  data: {
    to: ['subscriber1@example.com', 'subscriber2@example.com', 'subscriber3@example.com'],
    template: EmailTemplateConstants.NEWSLETTER,
    variables: {
      title: 'Weekly Updates',
      content: "<h2>What's New This Week</h2><p>...</p>",
      unsubscribeLink: 'https://app.example.com/unsubscribe'
    },
    priority: 'low',
    campaignId: 'weekly_2024'
  },
  priority: JobPriority.LOW
});

// 5. Email customizado
const customJob = await queueManager.addJob({
  type: QueueJobType.EMAIL_SEND,
  data: {
    to: 'client@example.com',
    subject: 'Special Offer!',
    template: EmailTemplateConstants.CUSTOM,
    customHtml: '<h1>50% Off!</h1><p>Limited time offer...</p>',
    customText: '50% Off! Limited time offer...',
    attachments: [
      {
        filename: 'offer.pdf',
        path: '/files/special-offer.pdf',
        contentType: 'application/pdf'
      }
    ],
    priority: 'normal'
  },
  priority: JobPriority.NORMAL
});

// 6. Email agendado
const scheduledJob = await queueManager.addJob({
  type: QueueJobType.EMAIL_SEND,
  data: {
    to: 'user@example.com',
    subject: 'Happy Birthday!',
    template: EmailTemplateConstants.CUSTOM,
    customHtml: '<h1>Happy Birthday! 🎂</h1>',
    sendAt: new Date('2024-03-15T09:00:00Z'),
    timezone: 'America/New_York',
    priority: 'normal'
  },
  priority: JobPriority.NORMAL,
  scheduledFor: new Date('2024-03-15T09:00:00Z')
});
```

### **Características Avançadas**

#### **Validação Automática**

```typescript
// ❌ Erro: variáveis obrigatórias ausentes
await queueManager.addJob({
  type: QueueJobType.EMAIL_SEND,
  data: {
    to: 'user@example.com',
    template: EmailTemplateConstants.WELCOME
    // Missing: userName, activationLink
  }
});
// Error: Missing required variables for template welcome: userName, activationLink
```

#### **Múltiplos Anexos**

```typescript
const jobWithAttachments = await queueManager.addJob({
  type: QueueJobType.EMAIL_SEND,
  data: {
    to: 'client@example.com',
    template: EmailTemplateConstants.INVOICE,
    variables: {
      /* ... */
    },
    attachments: [
      {
        filename: 'invoice.pdf',
        path: '/invoices/INV-001.pdf',
        contentType: 'application/pdf'
      },
      {
        filename: 'terms.pdf',
        content: Buffer.from('PDF content...'),
        contentType: 'application/pdf'
      }
    ]
  }
});
```

#### **Rastreamento e Analytics**

```typescript
const trackedJob = await queueManager.addJob({
  type: QueueJobType.EMAIL_SEND,
  data: {
    to: 'user@example.com',
    template: EmailTemplateConstants.NEWSLETTER,
    variables: {
      /* ... */
    },
    trackOpens: true, // Rastrear aberturas
    trackClicks: true, // Rastrear cliques
    campaignId: 'spring_promo_2024',
    metadata: {
      segment: 'premium_users',
      source: 'automated_campaign'
    }
  }
});
```

### **Monitoramento e Logs**

Todos os jobs de email incluem logs estruturados:

```bash
# Logs de processamento
INFO: Processing email send job
  jobId: "job_email_001"
  template: "welcome"
  recipients: 1
  attempt: 1

# Logs de sucesso
INFO: Email job completed successfully
  jobId: "job_email_001"
  messageId: "msg_1234567890"
  processingTime: 850
  template: "welcome"

# Logs de erro
ERROR: Email job processing failed
  jobId: "job_email_001"
  error: "Invalid email address: invalid@"
  attempt: 2
  maxAttempts: 3
```

## 🔧 **Adicionando Novos Jobs**

### **1. Criar Handler**

```typescript
// src/infraestructure/queue/jobs/business/myJob.job.ts
import type { FastifyBaseLogger } from 'fastify';
import type { JobResult } from '../../queue.types.js';

export interface MyJobData {
  userId: string;
  action: string;
  // ... outras propriedades
}

export async function handleMyJob(
  data: MyJobData,
  jobId: string,
  logger: FastifyBaseLogger,
  metadata?: {
    attempt: number;
    maxAttempts: number;
    queuedAt: Date;
    processingAt: Date;
  }
): Promise<JobResult> {
  const startTime = Date.now();

  logger.info({ jobId, userId: data.userId }, 'Processing my custom job');

  try {
    // Validação dos dados
    if (!data.userId) {
      throw new Error('userId is required');
    }

    // Processamento do job
    const result = await processMyJob(data);

    return {
      success: true,
      jobId,
      data: result,
      processedAt: Date.now(),
      processingTime: Date.now() - startTime,
      workerId: process.env.WORKER_ID || 'unknown'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      jobId,
      error: errorMessage,
      processedAt: Date.now(),
      processingTime: Date.now() - startTime,
      workerId: process.env.WORKER_ID || 'unknown'
    };
  }
}

async function processMyJob(data: MyJobData): Promise<any> {
  // Implementar lógica do job
  return { processed: true };
}
```

### **2. Registrar no Index**

```typescript
// src/infraestructure/queue/jobs/index.ts
import { handleMyJob } from './business/myJob.job.js';

export const JOB_HANDLERS: Record<string, JobHandler> = {
  [QueueJobType.EMAIL_SEND]: handleEmailSend,
  [QueueJobType.MY_JOB]: handleMyJob // ← Adicionar novo handler
} as const;

// Re-export
export { handleMyJob } from './business/myJob.job.js';
export type { MyJobData } from './business/myJob.job.js';
```

### **3. Adicionar Tipo ao Queue Types**

```typescript
// src/infraestructure/queue/queue.types.ts
export const QueueJobType = {
  EMAIL_SEND: 'email_send',
  MY_JOB: 'my_job' // ← Adicionar novo tipo
  // ...
} as const;
```

### **4. Usar o Job**

```typescript
const job = await queueManager.addJob({
  type: QueueJobType.MY_JOB,
  data: {
    userId: 'user_123',
    action: 'process_data'
  },
  priority: JobPriority.NORMAL,
  maxAttempts: 3
});
```

## 🧪 **Testando Jobs**

### **Testes Unitários**

```typescript
// tests/jobs/emailSend.test.ts
import { handleEmailSend } from '../src/infraestructure/queue/jobs/business/emailSend.job.js';

describe('Email Send Job', () => {
  it('should send welcome email successfully', async () => {
    const result = await handleEmailSend(
      {
        to: 'test@example.com',
        template: 'welcome',
        variables: {
          userName: 'Test User',
          activationLink: 'https://test.com/activate'
        }
      },
      'test_job_123',
      logger
    );

    expect(result.success).toBe(true);
    expect(result.data.messageId).toBeDefined();
  });

  it('should fail with missing variables', async () => {
    const result = await handleEmailSend(
      {
        to: 'test@example.com',
        template: 'welcome',
        variables: {} // Missing required variables
      },
      'test_job_456',
      logger
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required variables');
  });
});
```

### **Teste Manual com HTTP**

```bash
# Teste via API REST
curl -X POST http://localhost:3001/api/queue/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email_send",
    "data": {
      "to": "test@example.com",
      "template": "welcome",
      "variables": {
        "userName": "Test User",
        "activationLink": "https://test.com/activate"
      }
    },
    "priority": 15,
    "maxAttempts": 3
  }'
```

## 📊 **Métricas e Monitoramento**

### **Jobs Stats**

```typescript
// Estatísticas por tipo de job
const stats = await queueManager.getStats();
console.log({
  emailJobs: {
    pending: stats.emailSend.pending,
    completed: stats.emailSend.completed,
    failed: stats.emailSend.failed
  }
});
```

### **DLQ (Dead Letter Queue)**

```typescript
// Jobs que falharam múltiplas vezes
const dlqStats = await queueManager.getDLQStats();
console.log({
  totalInDLQ: dlqStats.total,
  emailJobsInDLQ: dlqStats.byType['email_send'] || 0
});

// Reprocessar jobs do DLQ
await queueManager.reprocessDLQJobs({
  jobType: 'email_send',
  limit: 10,
  resetAttempts: true
});
```

## 🚀 **Próximos Jobs Planejados**

- [ ] **User Notification Job**: Notificações push, SMS, in-app
- [ ] **Data Export Job**: Exportação CSV, JSON, Excel
- [ ] **File Process Job**: Resize, compression, conversion
- [ ] **Cache Warm Job**: Pré-aquecimento de cache
- [ ] **Cleanup Job**: Limpeza de arquivos temporários

O sistema está pronto para expansão com novos jobs seguindo os mesmos padrões! 🎯
