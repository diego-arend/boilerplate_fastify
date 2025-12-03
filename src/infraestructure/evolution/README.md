# Evolution API Integration

## 📱 **Resumo dos Endpoints Encontrados**

Baseado na pesquisa na documentação oficial da Evolution API (https://doc.evolution-api.com), aqui estão os principais endpoints para integração de envio de mensagens WhatsApp:

### **🔗 Principais Endpoints**

#### **1. Envio de Texto Simples**

```http
POST /message/sendText/{instance}
```

**Headers:**

```
Content-Type: application/json
apikey: <sua-api-key>
```

**Body:**

```json
{
  "number": "5511999999999",
  "textMessage": {
    "text": "Sua mensagem aqui"
  },
  "options": {
    "delay": 1000,
    "presence": "composing",
    "linkPreview": true
  }
}
```

**Resposta (201):**

```json
{
  "key": {
    "remoteJid": "5511999999999@s.whatsapp.net",
    "fromMe": true,
    "id": "BAE594145F4C59B4"
  },
  "message": {
    "extendedTextMessage": {
      "text": "Sua mensagem aqui"
    }
  },
  "messageTimestamp": "1717689097",
  "status": "PENDING"
}
```

#### **2. Envio de Mídia**

```http
POST /message/sendMedia/{instance}
```

**Body:**

```json
{
  "number": "5511999999999",
  "mediaMessage": {
    "mediaType": "image",
    "fileName": "imagem.jpg",
    "caption": "Legenda da imagem",
    "media": "base64_da_imagem_ou_url_publica"
  },
  "options": {
    "delay": 1000,
    "presence": "composing"
  }
}
```

#### **3. Envio de Templates (WhatsApp Business)**

```http
POST /message/sendTemplate/{instance}
```

**Body:**

```json
{
  "number": "5511999999999",
  "templateMessage": {
    "name": "nome_do_template",
    "language": "pt_BR",
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "text",
            "text": "Valor do parâmetro"
          }
        ]
      }
    ]
  }
}
```

## 🏗️ **Implementação no Projeto**

### **🏛️ Arquitetura de Uso**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Client Apps   │───▶│   API Server    │───▶│  Evolution API  │
│ (Web/Mobile/API)│    │ (Container API) │    │ (External API)  │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │ Queue Jobs
                                ▼
                       ┌─────────────────┐
                       │                 │
                       │   Redis Queue   │
                       │     (BullMQ)    │
                       │                 │
                       └─────────────────┘
                                │
                                │ Process Jobs
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │                 │    │                 │
                       │ Worker Process  │───▶│  Evolution API  │
                       │(Container Worker)│    │ (External API)  │
                       │                 │    │                 │
                       └─────────────────┘    └─────────────────┘

Fluxos de Envio:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🔄 ENVIO DIRETO (Síncrono)
   Client → API Server → Evolution API → WhatsApp

2. 📤 ENVIO VIA QUEUE (Assíncrono - Recomendado)
   Client → API Server → Redis Queue → Worker → Evolution API → WhatsApp

3. 🔍 VERIFICAÇÃO DE STATUS
   Client → API Server → Evolution API (Connection Status)
```

### **📋 Componentes da Arquitetura**

| Componente         | Responsabilidade                             | Container | Environment   |
| ------------------ | -------------------------------------------- | --------- | ------------- |
| **Client Apps**    | Interface do usuário, requisições REST       | -         | -             |
| **API Server**     | Endpoints REST, Plugin Fastify, Envio direto | `api`     | `.env.api`    |
| **Redis Queue**    | Fila de mensagens BullMQ, Job storage        | `redis`   | -             |
| **Worker Process** | Processamento assíncrono, Job execution      | `worker`  | `.env.worker` |
| **Evolution API**  | Serviço externo, Envio para WhatsApp         | External  | -             |

### **🔄 Vantagens de Cada Fluxo**

**Envio Direto (Síncrono):**

- ✅ Resposta imediata
- ✅ Feedback em tempo real
- ❌ Bloqueia o request
- ❌ Sem retry automático
- 🎯 **Uso**: Alertas urgentes, verificações

**Envio via Queue (Assíncrono):**

- ✅ Alta performance
- ✅ Retry automático
- ✅ Não bloqueia requests
- ✅ Escalabilidade horizontal
- ❌ Delay no processamento
- 🎯 **Uso**: Notificações, marketing, bulk messages

### **Estrutura dos Arquivos**

```
src/infraestructure/evolution/
├── evolutionApi.service.ts     # Service principal (usa fetch nativa)
├── evolution.plugin.ts         # Plugin Fastify
└── index.ts                    # Exportações

src/infraestructure/queue/jobs/whatsapp/
└── sendMessage.job.ts          # Job para fila

src/lib/validators/
└── whatsapp.validators.ts      # Validações específicas
```

**📝 Nota**: Esta implementação usa a **Fetch API nativa** do Node.js 18+ (não requer dependências externas ou helpers HTTP customizados).

### **Variáveis de Ambiente**

Adicione ao `.env.api` e `.env.worker`:

```env
# Evolution API Configuration (required in both containers)
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_api_key_aqui
EVOLUTION_INSTANCE=sua_instancia_whatsapp
```

### **🐳 Configuração de Containers**

**Container API** (`.env.api`):

```env
# Required for API endpoints and plugins
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_api_key_aqui
EVOLUTION_INSTANCE=sua_instancia_whatsapp
WORKER_MODE=false  # Always false for API
```

**Container Worker** (`.env.worker`):

```env
# Required for queue job processing
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_api_key_aqui
EVOLUTION_INSTANCE=sua_instancia_whatsapp
WORKER_MODE=true   # Always true for Workers
```

### **1. Uso Direto do Service**

## 🚀 Uso Rápido

Para a maioria dos casos, simplesmente use a instância pré-configurada:

```typescript
import { evolutionApiService } from '../../infraestructure/evolution/index.js';

// Envio direto - usa configuração do ambiente
const result = await evolutionApiService.sendTextMessage({
  number: '5511999999999',
  text: 'Olá! Esta é uma mensagem de teste.'
});
```

**✅ Vantagens desta abordagem:**

- Zero configuração manual necessária
- Validação automática via `validateEnv.ts`
- Todas as variáveis de ambiente são validadas na inicialização
- Usa fetch nativa do Node.js (sem dependências extras)

## ⚙️ Configuração Avançada

Se precisar de configuração customizada ou múltiplas instâncias:

```typescript
import {
  EvolutionApiService,
  createEvolutionApiService
} from '../../infraestructure/evolution/index.js';

// Opção 1: Factory function (recomendado)
const customService = createEvolutionApiService({
  baseUrl: 'https://minha-evolution-customizada.com',
  apiKey: 'minha-key-customizada',
  instance: 'minha-instancia'
});

// Opção 2: Instância direta
const directService = new EvolutionApiService({
  baseUrl: 'https://outra-evolution.com',
  apiKey: 'outra-key',
  instance: 'outra-instancia'
});

// Opção 3: Misturar env + override
const mixedService = createEvolutionApiService({
  instance: 'instancia-diferente' // Outros valores vêm do ambiente
});
```

### **📝 Variáveis de Ambiente**

As variáveis são automaticamente validadas via `src/lib/validators/validateEnv.ts`:

```bash
# Evolution API Configuration (opcional)
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_api_key_aqui
EVOLUTION_INSTANCE=sua_instancia_aqui
```

**⚠️ Observação**: Se qualquer variável Evolution API estiver presente, a validação garante que todas sejam válidas.

### **2. Uso via Plugin Fastify**

```typescript
// Em app.ts ou onde registra os plugins
import evolutionPlugin from './infraestructure/evolution/evolution.plugin.js';

export default async function app(fastify: FastifyInstance) {
  // Registrar plugin Evolution API
  await fastify.register(evolutionPlugin);

  // Outros plugins...
}

// Em qualquer controller
export default async function whatsappController(fastify: FastifyInstance) {
  fastify.post('/send-message', async (request, reply) => {
    const { number, message } = request.body;

    const result = await fastify.evolutionApi.sendTextMessage({
      number,
      text: message
    });

    return { success: true, messageId: result.key.id };
  });
}
```

### **3. Uso via Queue (Recomendado)**

```typescript
import { WhatsAppMessageJobData } from '../infraestructure/queue/jobs/whatsapp/sendMessage.job.js';

// Agendar envio de mensagem
const messageData: WhatsAppMessageJobData = {
  number: '5511999999999',
  message: 'Sua conta foi criada com sucesso!',
  userId: 'user_123',
  messageType: 'notification',
  priority: 'high',
  options: {
    delay: 2000,
    presence: 'composing'
  }
};

await fastify.persistentQueueManager.addJob('whatsapp:send', messageData, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
});
```

## 🔐 **Validação e Segurança**

### **Validação de Dados**

```typescript
import { WhatsAppValidators } from '../lib/validators/whatsapp.validators.js';

// Validar número
const validatedPhone = WhatsAppValidators.validatePhone('5511999999999');

// Validar mensagem
const validatedMessage = WhatsAppValidators.validateMessage('Texto da mensagem');

// Validar dados completos
const validatedData = WhatsAppValidators.validateSendMessage({
  number: '5511999999999',
  message: 'Olá!',
  priority: 'high'
});

// Validação segura (sem throw)
const result = WhatsAppValidators.safeParse.sendMessage(requestData);
if (result.success) {
  // Dados válidos
  console.log(result.data);
} else {
  // Erro de validação
  console.log(result.error);
}
```

### **Características de Segurança**

- **XSS Protection**: Sanitização automática de mensagens
- **Injection Prevention**: Detecção de tentativas de injeção
- **Phone Masking**: Números mascarados nos logs
- **Input Validation**: Validação rigorosa com Zod
- **Rate Limiting**: Controle via delays configuráveis

## 📊 **Monitoramento e Logs**

### **Logs Estruturados**

```json
{
  "level": "info",
  "time": "2025-01-25T10:30:00.000Z",
  "context": "evolution-api-service",
  "messageId": "BAE594145F4C59B4",
  "number": "5511****9999",
  "status": "PENDING",
  "msg": "Text message sent successfully"
}
```

### **Verificação de Conexão**

```typescript
// Verificar status da conexão
const status = await evolutionService.checkConnection();
console.log('Conectado:', status.connected);
console.log('Status:', status.status);
```

## 🚀 **Exemplos Práticos**

### **1. Notificação de Boas-vindas**

```typescript
// Service de usuário
async function sendWelcomeMessage(userId: string, userPhone: string, userName: string) {
  await fastify.persistentQueueManager.addJob('whatsapp:send', {
    number: userPhone,
    message: `🎉 Olá ${userName}! Bem-vindo ao nosso sistema. Sua conta foi criada com sucesso!`,
    userId,
    messageType: 'notification',
    priority: 'high'
  });
}
```

### **2. Alerta de Sistema**

```typescript
// Notificação de erro crítico
async function sendSystemAlert(adminPhone: string, errorMessage: string) {
  await fastify.evolutionApi.sendTextMessage({
    number: adminPhone,
    text: `🚨 ALERTA DO SISTEMA: ${errorMessage}`,
    options: {
      presence: 'composing'
    }
  });
}
```

### **3. Confirmação de Pedido**

```typescript
// E-commerce: confirmação de pedido
async function sendOrderConfirmation(order: Order) {
  const message = `
✅ Pedido #${order.id} confirmado!

📦 Itens: ${order.items.length}
💰 Total: R$ ${order.total.toFixed(2)}
🚚 Previsão: ${order.deliveryDate}

Obrigado pela preferência!
  `.trim();

  await fastify.persistentQueueManager.addJob('whatsapp:send', {
    number: order.customerPhone,
    message,
    userId: order.customerId,
    messageType: 'info',
    priority: 'normal'
  });
}
```

## 🔧 **Configurações Avançadas**

### **Retry e Fallback**

```typescript
// Configuração de retry na queue
await fastify.persistentQueueManager.addJob('whatsapp:send', messageData, {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: 10,
  removeOnFail: 5
});
```

### **Priorização de Mensagens**

```typescript
// Alta prioridade (alertas críticos)
await fastify.persistentQueueManager.addJob('whatsapp:send', alertData, {
  priority: 10, // Alta prioridade na queue
  data: { ...alertData, priority: 'urgent' }
});

// Baixa prioridade (marketing)
await fastify.persistentQueueManager.addJob('whatsapp:send', marketingData, {
  priority: 1, // Baixa prioridade na queue
  data: { ...marketingData, priority: 'low' }
});
```

## 📚 **Links Úteis**

- **Documentação Oficial**: https://doc.evolution-api.com
- **Coleção Postman**: https://www.postman.com/agenciadgcode/evolution-api/collection/gqr041s/evolution-api-v2-0
- **GitHub**: https://github.com/EvolutionAPI/evolution-api
- **Comunidade**: https://evolution-api.com/

---

**Observação**: Esta implementação segue os padrões do projeto boilerplate Fastify, incluindo validações de segurança, logging estruturado, e integração com o sistema de filas BullMQ para processamento assíncrono de mensagens.
