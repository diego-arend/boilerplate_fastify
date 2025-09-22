# Business Jobs

Este diretório contém todos os **job handlers para operações de negócio assíncronas**. Estes são os jobs principais do sistema queue, focados em operações críticas que afetam diretamente os usuários e o negócio.

## 🎯 Propósito

Os jobs de negócio são responsáveis por:
- **Operações críticas**: Transações que impactam diretamente usuários
- **Processamento assíncrono**: Tarefas que não podem bloquear requisições HTTP
- **Escalabilidade**: Operações que podem ser distribuídas e executadas em paralelo
- **Confiabilidade**: Processamento com retry, logging e monitoramento

## 📁 Jobs Disponíveis

### `emailSend.job.ts` - Envio de Emails
- **Propósito**: Envio de emails transacionais e promocionais
- **Casos de Uso**: 
  - Confirmações de pedido
  - Recuperação de senha
  - Notificações importantes
  - Emails promocionais
- **Prioridade**: CRITICAL para transacionais, NORMAL para promocionais

### `userNotification.job.ts` - Notificações de Usuário
- **Propósito**: Entrega multi-canal de notificações para usuários
- **Casos de Uso**:
  - Notificações push mobile
  - Notificações in-app
  - SMS críticos
  - Alerts de sistema
- **Prioridade**: HIGH para alerts, NORMAL para notificações gerais

### `dataExport.job.ts` - Exportação de Dados
- **Propósito**: Geração de relatórios e exportações de dados
- **Casos de Uso**:
  - Relatórios de vendas
  - Exportação de dados do usuário (GDPR)
  - Backups automatizados
  - Análises customizadas
- **Prioridade**: NORMAL (pode ser processado de forma batch)

### `fileProcess.job.ts` - Processamento de Arquivos
- **Propósito**: Transformações e manipulações de arquivos uploaded
- **Casos de Uso**:
  - Redimensionamento de imagens
  - Conversão de formatos
  - Geração de thumbnails
  - Validação de conteúdo
- **Prioridade**: NORMAL para otimizações, HIGH para validações

## 🔧 Como Usar

### Exemplo Básico
```typescript
import { queueManager } from '../queue.manager.js';
import { JobType, JobPriority } from '../queue.types.js';

// Email transacional crítico
await queueManager.addJob(JobType.EMAIL_SEND, {
  to: 'customer@example.com',
  subject: 'Order Confirmation #12345',
  body: 'Your order has been confirmed.',
  template: 'order_confirmation',
  variables: { orderNumber: '12345' },
  timestamp: Date.now()
}, {
  priority: JobPriority.CRITICAL,
  attempts: 5,
  delay: 0 // Imediato
});

// Notificação para usuário
await queueManager.addJob(JobType.USER_NOTIFICATION, {
  userId: 'user_123',
  title: 'Payment Processed',
  message: 'Your payment has been successfully processed.',
  type: 'success',
  channels: ['push', 'email'],
  timestamp: Date.now()
}, {
  priority: JobPriority.HIGH,
  attempts: 3
});
```

### Configuração de Prioridades
```typescript
// Prioridades recomendadas para jobs de negócio:

// CRITICAL - Operações que afetam diretamente o fluxo do usuário
- Emails de confirmação de transação
- Validações de pagamento
- Notificações de segurança

// HIGH - Importantes mas não bloqueantes
- Notificações push
- Processamento de uploads críticos
- Atualizações de status

// NORMAL - Processamento em background
- Relatórios e exportações
- Otimizações de imagens
- Análises e métricas
```

## 📊 Monitoramento e Métricas

### Métricas Importantes
- **Taxa de sucesso**: % de jobs completados com sucesso
- **Tempo médio de processamento**: Latência por tipo de job
- **Jobs com falha**: Identificar padrões de erro
- **Throughput**: Jobs processados por minuto

### Alertas Recomendados
```typescript
// Configurar alertas para:
- Taxa de falha > 5% em jobs CRITICAL
- Tempo de processamento > 30s para emails
- Queue size > 1000 jobs pendentes
- Memory usage > 80% nos workers
```

## 🔒 Segurança e Validação

### Validações Implementadas
- **Input sanitization**: Todos os dados são validados
- **Rate limiting**: Prevenção de spam e abuso  
- **Authorization**: Verificação de permissões
- **Data encryption**: Dados sensíveis criptografados

### Exemplo de Validação
```typescript
// Exemplo de como os jobs validam dados
export async function handleEmailSend(
  data: EmailSendJobData,
  jobId: string,
  logger: FastifyBaseLogger
): Promise<JobResult> {
  // 1. Validação de schema
  if (!data.to || !data.subject) {
    return { success: false, error: 'Missing required fields' };
  }

  // 2. Sanitização de dados
  const sanitizedData = sanitizeEmailData(data);

  // 3. Validação de rate limiting
  if (!await checkRateLimit(data.to)) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  // 4. Processamento seguro
  // ...
}
```

## 🚀 Performance

### Otimizações Implementadas
- **Batch processing**: Agrupamento de operações similares
- **Connection pooling**: Reutilização de conexões DB/API
- **Caching**: Cache de dados frequentemente acessados
- **Parallel execution**: Processamento paralelo quando possível

### Configurações Recomendadas
```typescript
// Configurações de performance por job type
const JOB_CONFIGS = {
  [JobType.EMAIL_SEND]: {
    concurrency: 5,      // Emails simultâneos
    batchSize: 10,       // Emails por batch
    timeout: 30000       // 30s timeout
  },
  [JobType.USER_NOTIFICATION]: {
    concurrency: 10,     // Notificações simultâneas
    batchSize: 50,       // Notificações por batch
    timeout: 15000       // 15s timeout
  },
  [JobType.DATA_EXPORT]: {
    concurrency: 2,      // Exports simultâneos (resource intensive)
    batchSize: 1,        // Processar um por vez
    timeout: 300000      // 5min timeout
  },
  [JobType.FILE_PROCESS]: {
    concurrency: 3,      // Files simultâneos
    batchSize: 5,        // Files por batch
    timeout: 60000       // 1min timeout
  }
};
```

## 🔍 Debugging e Troubleshooting

### Logs Estruturados
Todos os jobs de negócio implementam logging estruturado:

```typescript
logger.info({
  jobId,
  jobType: 'EMAIL_SEND',
  userId: data.userId,
  status: 'started',
  metadata: { template: data.template }
}, 'Email job started');
```

### Ferramentas de Debug
- **Queue dashboard**: Visualização em tempo real
- **Job inspector**: Detalhes de execução por job
- **Error tracking**: Monitoramento de falhas
- **Performance profiler**: Análise de bottlenecks

---

## 📚 Recursos Adicionais

- [Queue Types Documentation](../queue.types.ts)
- [Queue Manager Documentation](../queue.manager.ts)  
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Fastify Logging](https://fastify.dev/docs/latest/Reference/Logging/)

---

**Lembre-se**: Jobs de negócio são o coração do sistema assíncrono. Mantenha-os simples, confiáveis e bem monitorados! 🚀