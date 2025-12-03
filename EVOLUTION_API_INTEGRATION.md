# 📱 Evolution API - Documentação Completa dos Endpoints

## 🔍 **Pesquisa Realizada na Documentação Oficial**

Utilizando o Context7 para pesquisar na documentação oficial da Evolution API (https://doc.evolution-api.com), foram identificados os principais endpoints para integração de envio de mensagens WhatsApp.

## 🔗 **Endpoints Identificados**

### **1. Envio de Texto Simples**
**URL**: `POST /message/sendText/{instance}`

**Headers Obrigatórios**:
- `Content-Type: application/json`
- `apikey: <sua-api-key>`

**Parâmetros**:
- `{instance}`: ID da instância WhatsApp configurada

**Body JSON**:
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

**Resposta (201 Created)**:
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

### **2. Envio de Mídia**
**URL**: `POST /message/sendMedia/{instance}`

**Body JSON**:
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

### **3. Envio de Templates (WhatsApp Business)**
**URL**: `POST /message/sendTemplate/{instance}`

**Body JSON**:
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

## 🛠️ **Implementação Completa no Projeto**

**Arquivos principais criados:**

1. **`evolutionApi.service.ts`** - Service principal com fetch nativa do Node.js
2. **`evolution.plugin.ts`** - Plugin Fastify para integração
3. **`index.ts`** - Exportações centralizadas do módulo
4. **`sendMessage.job.ts`** - Job para processamento via BullMQ
5. **`whatsapp.validators.ts`** - Validações de segurança com Zod
6. **`whatsapp.controller.ts`** - Controller REST de exemplo
7. **`README.md`** - Documentação completa de uso

**📝 Nota**: Usa a **Fetch API nativa** do Node.js 18+ (sem dependências extras).

## ⚙️ **Configuração de Ambiente**

As variáveis são **automaticamente validadas** através do `src/lib/validators/validateEnv.ts`:

```bash
# .env.api.example e .env.worker.example
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_api_key_aqui
EVOLUTION_INSTANCE=sua_instancia_aqui
```

**✅ Benefícios da validação automática:**
- Todas as variáveis são validadas na inicialização da aplicação
- Erro claro se alguma configuração estiver incorreta
- Zero configuração manual necessária nos services
- Suporte completo a override via parâmetros quando necessário

## ⚙️ **Configuração de Ambiente**

Adicione ao `.env`:
```env
# Evolution API Configuration
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_api_key_aqui
EVOLUTION_INSTANCE=sua_instancia_whatsapp
```

## 🚀 **Exemplos de Uso**

### **1. Uso Direto**
## 🚀 **Como usar**

### **Uso Simples (Recomendado)**
```typescript
import { evolutionApiService } from './src/infraestructure/evolution/index.js';

// Envio direto - usa configuração do ambiente
const result = await evolutionApiService.sendTextMessage({
  number: '5511999999999',
  text: 'Olá! Mensagem via Evolution API.'
});
```

### **Configuração Customizada (Se necessário)**
```typescript
import { createEvolutionApiService } from './src/infraestructure/evolution/index.js';

const customService = createEvolutionApiService({
  baseUrl: 'https://minha-evolution.com',
  apiKey: 'minha-key',
  instance: 'minha-instancia'
});
```

### **2. Via Queue (Recomendado)**
```typescript
await fastify.persistentQueueManager.addJob('whatsapp:send', {
  number: '5511999999999',
  message: 'Mensagem via fila',
  userId: 'user_123',
  priority: 'high'
});
```

### **3. Via Controller REST**
```bash
curl -X POST http://localhost:3001/api/whatsapp/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -d '{
    "number": "5511999999999",
    "message": "Olá! Esta é uma mensagem via API REST."
  }'
```

## 🔐 **Recursos de Segurança**

- **Validação rigorosa** com Zod
- **Sanitização XSS** automática
- **Máscaras de logs** para números de telefone
- **Rate limiting** configurável
- **Prevenção de injeção** NoSQL/SQL

## 📊 **Monitoramento**

- **Logs estruturados** com contexto completo
- **Métricas de performance** via logger
- **Verificação de conexão** automática
- **Tratamento de erros** detalhado

## 🎯 **Padrões Seguidos**

A implementação segue todos os padrões do boilerplate Fastify:

- ✅ **Modular DDD**: Separação clara de responsabilidades
- ✅ **Repository Pattern**: BaseRepository inheritance
- ✅ **Global Validators**: Reutilização de validações
- ✅ **Queue Jobs**: Processamento assíncrono com BullMQ
- ✅ **Plugin Architecture**: Integração nativa com Fastify
- ✅ **Error Handling**: ApiResponseHandler padronizado
- ✅ **Security First**: Validação e sanitização rigorosa
- ✅ **Logging**: Structured logging com contexto
- ✅ **TypeScript**: Tipagem forte e interfaces claras

## 📚 **Links de Referência**

- **Documentação Evolution API**: https://doc.evolution-api.com
- **Repositório GitHub**: https://github.com/EvolutionAPI/evolution-api
- **Coleção Postman**: https://www.postman.com/agenciadgcode/evolution-api/collection/gqr041s/evolution-api-v2-0

---

**Status**: ✅ **Implementação Completa e Funcional**
**Compatibilidade**: Evolution API v2.x
**Integração**: Pronta para uso em produção