# Maintenance Jobs

Esta subpasta contém jobs de manutenção do sistema que são executados para operações de infraestrutura e otimização, diferente dos jobs assíncronos de negócio que estão no diretório principal.

## 🔧 Jobs de Manutenção

### CACHE_WARM (`cacheWarm.job.ts`)

**Propósito**: Aquecimento proativo de cache para melhorar performance

**Casos de Uso**:

- Pré-carregamento de dados críticos na inicialização
- Refresh de cache de dados computacionalmente caros
- Aquecimento de cache após deploy
- Preparação de dados antes de picos de tráfego

**Exemplo**:

```typescript
await queueManager.addJob('cache:warm', {
  cacheKey: 'users:active:list',
  dataSource: 'database:active_users',
  ttl: 3600,
  timestamp: Date.now()
});
```

### CLEANUP (`cleanup.job.ts`)

**Propósito**: Limpeza automática de arquivos temporários e logs antigos

**Casos de Uso**:

- Limpeza de arquivos temporários antigos
- Rotação e remoção de logs antigos
- Remoção de sessões expiradas
- Limpeza de cache obsoleto

**Exemplo**:

```typescript
await queueManager.addJob('cleanup', {
  target: 'temp_files',
  olderThan: 7, // 7 dias
  pattern: '*.tmp',
  timestamp: Date.now()
});
```

## 📋 Características dos Jobs de Manutenção

### Diferenças dos Jobs Assíncronos

- **Frequência**: Executados periodicamente (cron-like)
- **Prioridade**: Geralmente baixa prioridade
- **Timing**: Podem ser executados em horários de baixo tráfego
- **Resultado**: Focados em métricas de sistema (espaço liberado, cache hits, etc.)

### Integração com Sistema Principal

- **Compatibilidade Total**: Usam a mesma infraestrutura de queue
- **Monitoramento**: Mesmo sistema de logs e métricas
- **APIs**: Disponíveis através das mesmas rotas de queue
- **Worker**: Processados pelo mesmo worker principal

## 🕐 Estratégias de Execução

### Agendamento Recomendado

```typescript
// Limpeza diária às 2h da manhã
const scheduleCleanup = () => {
  queueManager.addJob(
    'cleanup',
    {
      target: 'temp_files',
      olderThan: 7
    },
    {
      priority: JobPriority.LOW,
      delay: calculateDelayUntil('02:00')
    }
  );
};

// Aquecimento de cache antes do pico de tráfego
const scheduleCacheWarm = () => {
  queueManager.addJob(
    'cache:warm',
    {
      cacheKey: 'homepage:data',
      dataSource: 'database:homepage_content',
      ttl: 7200
    },
    {
      priority: JobPriority.NORMAL,
      delay: calculateDelayUntil('07:00')
    }
  );
};
```

### Batch Processing

```typescript
// Processamento em lote para eficiência
const batchMaintenanceJobs = async () => {
  const jobs = [
    { type: 'cleanup', data: { target: 'temp_files', olderThan: 7 } },
    { type: 'cleanup', data: { target: 'old_logs', olderThan: 30 } },
    { type: 'cache:warm', data: { cacheKey: 'config:app', dataSource: 'database:config' } }
  ];

  for (const job of jobs) {
    await queueManager.addJob(job.type, job.data, { priority: JobPriority.LOW });
  }
};
```

## 📊 Monitoramento e Métricas

### Métricas Importantes

- **Cleanup Jobs**: Arquivos removidos, espaço liberado, tempo de execução
- **Cache Warm Jobs**: Hit rate improvement, cache size, warm time

### Alertas Recomendados

- Jobs de limpeza falhando consistentemente
- Cache warm jobs com tempos de execução muito altos
- Espaço em disco não sendo liberado adequadamente

## 🔄 Migração Futura

### Considerações para Cron Jobs

Estes jobs podem ser migrados para um sistema de cron jobs dedicado no futuro:

```bash
# Exemplo de cron jobs equivalentes
0 2 * * * /app/scripts/cleanup-temp-files.sh
0 6 * * * /app/scripts/warm-cache.sh
```

### Vantagens da Abordagem Atual (Queue)

- **Retry Logic**: Automático com BullMQ
- **Monitoramento**: Integrado com sistema existente
- **Scaling**: Pode ser processado por múltiplos workers
- **Logging**: Estruturado e centralizado

### Quando Migrar para Cron

- Quando precisar de timing muito preciso
- Para jobs que devem rodar independente da aplicação
- Para simplificar a arquitetura de jobs assíncronos

## 🚀 Desenvolvimento

### Adicionando Novo Job de Manutenção

1. **Criar handler**: `maintenance/newMaintenance.job.ts`
2. **Seguir padrão**: Usar mesma interface que outros handlers
3. **Atualizar exports**: No `jobs/index.ts`
4. **Documentar**: Adicionar seção neste README
5. **Testar**: Verificar integração com worker

### Padrões de Código

- Validação de entrada rigorosa
- Logging detalhado de operações
- Métricas de performance
- Tratamento de erro resiliente
- Simulação realista para desenvolvimento

---

**Nota**: Estes jobs são parte do sistema de queue mas focam em operações de sistema. Para jobs de negócio (emails, notificações, etc.), consulte o README principal do diretório `jobs/`.
