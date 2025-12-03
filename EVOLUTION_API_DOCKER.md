# Evolution API Docker Configuration

Este documento descreve como usar a Evolution API integrada ao boilerplate via Docker Compose.

## 📋 **Visão Geral**

A Evolution API v2.1.1 foi adicionada ao docker-compose para fornecer integração completa com WhatsApp, incluindo:

- **Envio de mensagens de texto e mídia**
- **Webhook para recebimento de mensagens**
- **Gerenciamento de instâncias WhatsApp**
- **Interface web de gerenciamento**
- **Integração com banco PostgreSQL**
- **Cache Redis dedicado**

## 🚀 **Iniciando a Evolution API**

### **1. Desenvolvimento**

```bash
# Iniciar todos os serviços (incluindo Evolution API)
docker-compose -f docker-compose.dev.yml up -d

# Apenas Evolution API e dependências
docker-compose -f docker-compose.dev.yml up -d evolution-api evolution_db redis
```

### **2. Produção**

```bash
# Iniciar stack completa
docker-compose up -d

# Verificar logs da Evolution API
docker logs evolution_api -f
```

## 🔧 **Configuração**

### **Variáveis de Ambiente (.env.api.example)**

```bash
# Evolution API Configuration
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=B6D711FCDE4D4FD5936544120E713976
EVOLUTION_INSTANCE=desenvolvimento

# Docker-specific settings
EVOLUTION_SERVER_URL=http://localhost:8080
EVOLUTION_DATABASE_URI=postgresql://evolution:evolution_password@localhost:5433/evolution_api
EVOLUTION_WEBHOOK_URL=http://localhost:3001/api/whatsapp/webhook
```

### **Portas Utilizadas**

| Serviço       | Porta | Descrição                                |
| ------------- | ----- | ---------------------------------------- |
| Evolution API | 8080  | API principal                            |
| Evolution DB  | 5433  | PostgreSQL (para não conflitar com 5432) |
| Redis         | 6379  | Cache (database 2 para Evolution)        |

## 📱 **Primeiros Passos**

### **1. Acessar a Interface**

Após iniciar os containers:

```bash
# Verificar se a API está funcionando
curl http://localhost:8080

# Resposta esperada:
{
  "status": 200,
  "message": "Welcome to the Evolution API, it is working!",
  "version": "2.1.1",
  "swagger": "http://localhost:8080/docs",
  "manager": "http://localhost:8080/manager"
}
```

### **2. Acessar Documentação Swagger**

- **URL**: http://localhost:8080/docs
- **Manager**: http://localhost:8080/manager

### **3. Criar uma Instância WhatsApp**

```bash
# Criar instância
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: B6D711FCDE4D4FD5936544120E713976" \
  -d '{
    "instanceName": "desenvolvimento",
    "token": "seu-token-aqui",
    "qrcode": true
  }'
```

### **4. Conectar WhatsApp**

```bash
# Gerar QR Code
curl -X GET http://localhost:8080/instance/connect/desenvolvimento \
  -H "apikey: B6D711FCDE4D4FD5936544120E713976"

# A resposta incluirá o QR Code em base64
# Use o Manager (http://localhost:8080/manager) para uma interface visual
```

## 🔗 **Integração com o Boilerplate**

### **Uso nos Controllers**

```typescript
// src/modules/whatsapp/whatsapp.controller.ts
export default async function whatsappController(fastify: FastifyInstance) {
  // Enviar mensagem diretamente
  fastify.post('/send-message', async (request, reply) => {
    const result = await request.server.evolutionApi.sendTextMessage({
      number: '5511999999999',
      text: 'Mensagem teste'
    });

    return ApiResponseHandler.success(reply, 'Mensagem enviada', result);
  });

  // Verificar status da conexão
  fastify.get('/connection-status', async (request, reply) => {
    const status = await request.server.evolutionConnectionManager.forceCheck();
    return ApiResponseHandler.success(reply, 'Status da conexão', status);
  });
}
```

### **Uso nos Jobs (Queue)**

```typescript
// src/infraestructure/queue/jobs/whatsapp/sendMessage.job.ts
export async function handleWhatsAppMessageJob(data: WhatsAppMessageJobData) {
  const evolutionService = new EvolutionApiService();

  const result = await evolutionService.sendTextMessage({
    number: data.number,
    text: data.message
  });

  return { success: true, messageId: result.key.id };
}
```

## 🛠 **Comandos Úteis**

### **Logs e Debugging**

```bash
# Logs da Evolution API
docker logs evolution_api_dev -f

# Logs do banco Evolution
docker logs evolution_db_dev -f

# Entrar no container da Evolution API
docker exec -it evolution_api_dev /bin/sh

# Verificar banco PostgreSQL
docker exec -it evolution_db_dev psql -U evolution -d evolution_api
```

### **Limpeza e Reset**

```bash
# Parar e remover containers Evolution
docker-compose -f docker-compose.dev.yml down evolution-api evolution_db

# Remover volumes (CUIDADO: apaga dados!)
docker volume rm boilerplate_fastify_evolution_instances
docker volume rm boilerplate_fastify_evolution_db_data

# Restart completo
docker-compose -f docker-compose.dev.yml up -d --force-recreate evolution-api evolution_db
```

## 🔧 **Configurações Avançadas**

### **Customizar a API Key**

```bash
# Gerar nova API key segura
openssl rand -hex 32

# Atualizar no .env e docker-compose
EVOLUTION_API_KEY=sua_nova_key_aqui
```

### **Webhook para Recebimento de Mensagens**

```bash
# Configurar webhook na instância
curl -X PUT http://localhost:8080/webhook/set/desenvolvimento \
  -H "Content-Type: application/json" \
  -H "apikey: B6D711FCDE4D4FD5936544120E713976" \
  -d '{
    "url": "http://host.docker.internal:3001/api/whatsapp/webhook",
    "enabled": true,
    "events": [
      "QRCODE_UPDATED",
      "CONNECTION_UPDATE",
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE"
    ]
  }'
```

### **Backup e Restore**

```bash
# Backup do banco Evolution
docker exec evolution_db_dev pg_dump -U evolution evolution_api > evolution_backup.sql

# Restore do banco
docker exec -i evolution_db_dev psql -U evolution evolution_api < evolution_backup.sql

# Backup das instâncias WhatsApp
docker run --rm -v boilerplate_fastify_evolution_instances:/source -v $(pwd):/backup alpine tar czf /backup/evolution_instances_backup.tar.gz -C /source .
```

## 🚨 **Troubleshooting**

### **Problemas Comuns**

1. **Evolution API não inicia**

   ```bash
   # Verificar logs
   docker logs evolution_api_dev

   # Verificar se o banco está rodando
   docker logs evolution_db_dev
   ```

2. **QR Code não aparece**

   ```bash
   # Verificar se a instância foi criada
   curl -X GET http://localhost:8080/instance/fetchInstances \
     -H "apikey: B6D711FCDE4D4FD5936544120E713976"
   ```

3. **Webhook não funciona**

   ```bash
   # Verificar conectividade do container para o host
   docker exec evolution_api_dev ping host.docker.internal

   # Usar a URL correta para ambiente Docker
   # http://host.docker.internal:3001 ao invés de http://localhost:3001
   ```

### **Health Checks**

```bash
# Verificar saúde de todos os serviços
docker-compose -f docker-compose.dev.yml ps

# Teste manual da Evolution API
curl -f http://localhost:8080 || echo "Evolution API não está respondendo"

# Teste do banco Evolution
docker exec evolution_db_dev pg_isready -U evolution -d evolution_api
```

## 📚 **Recursos Adicionais**

- **Documentação Oficial**: https://doc.evolution-api.com/v2
- **GitHub**: https://github.com/evolutionapi/evolution-api
- **Docker Hub**: https://hub.docker.com/r/atendai/evolution-api
- **Manager Web**: http://localhost:8080/manager
- **API Docs**: http://localhost:8080/docs

## 🔐 **Segurança**

### **Produção**

- Altere a `AUTHENTICATION_API_KEY` padrão
- Use HTTPS na `EVOLUTION_SERVER_URL`
- Configure senhas fortes para PostgreSQL
- Restrinja acesso às portas apenas quando necessário
- Configure firewall para limitar acesso externo

### **Desenvolvimento**

- Mantenha as configurações padrão para facilitar desenvolvimento
- Use a rede Docker interna para comunicação entre serviços
- Monitore logs regularmente para identificar problemas
