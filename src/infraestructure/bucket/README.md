# Bucket Infrastructure Module

Este módulo gerencia conexões e operações com serviços de bucket S3-compatíveis (MinIO local e AWS S3).

## Arquitetura

```
src/infraestructure/bucket/
├── bucket.types.ts                    # Definições de tipos
├── bucketConnectionManager.interface.ts # Interface do gerenciador de conexão
├── bucketConnectionManager.ts          # Implementação do gerenciador
├── bucketConnectionManager.factory.ts  # Factory para instâncias
├── bucket.service.ts                   # Serviço de alto nível
├── bucket.plugin.ts                    # Plugin Fastify
├── index.ts                           # Exports principais
└── README.md                          # Esta documentação
```

## Componentes

### BucketConnectionManager

Gerencia conexões com serviços de bucket (MinIO/S3):

- **Conexão**: Estabelece e monitora conexões
- **Health Check**: Verifica saúde da conexão
- **Reconexão**: Reconecta automaticamente em falhas
- **Status**: Fornece status da conexão

### BucketService

Serviço de alto nível para operações de bucket:

- **Upload**: Enviar arquivos para buckets
- **Download**: Baixar arquivos de buckets
- **Delete**: Remover arquivos
- **List**: Listar arquivos em buckets
- **Presigned URLs**: Gerar URLs temporárias
- **Bucket Management**: Criar e gerenciar buckets

### BucketPlugin

Plugin Fastify que registra os serviços:

- **Auto-connect**: Conexão automática baseada em ambiente
- **Decorators**: Disponibiliza serviços via `fastify.bucketService`
- **Graceful Shutdown**: Desconexão limpa ao parar servidor

## Configuração

### Variáveis de Ambiente

#### Desenvolvimento (MinIO Local)

```bash
NODE_ENV=development
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
AWS_REGION=us-east-1
```

#### Produção (AWS S3)

```bash
NODE_ENV=production
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

## Uso

### 1. Registro Automático

O plugin é registrado automaticamente no `app.ts`:

```typescript
await fastify.register(bucketPlugin, {
  autoConnect: true // Conecta automaticamente usando env vars
});
```

### 2. Uso nos Controllers

```typescript
// Upload de arquivo
const fileUrl = await fastify.bucketService.uploadFile({
  bucket: 'uploads',
  key: 'users/profile-123.jpg',
  body: fileBuffer,
  contentType: 'image/jpeg',
  metadata: { userId: '123' }
});

// Download de arquivo
const fileBuffer = await fastify.bucketService.downloadFile('uploads', 'users/profile-123.jpg');

// Listar arquivos
const files = await fastify.bucketService.listFiles('uploads', 'users/');

// URL temporária (1 hora)
const presignedUrl = await fastify.bucketService.getPresignedUrl({
  bucket: 'uploads',
  key: 'users/profile-123.jpg',
  expiresIn: 3600
});

// Deletar arquivo
await fastify.bucketService.deleteFile('uploads', 'users/profile-123.jpg');
```

### 3. Configuração Manual

```typescript
import { BucketConnectionManagerFactory, BucketService } from '@/infraestructure/bucket';

const manager = BucketConnectionManagerFactory.create({
  endpoint: 'http://localhost:9000', // MinIO local
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin123'
  },
  forcePathStyle: true
});

await manager.connect();
const bucketService = new BucketService(manager);
```

## Docker Compose

O módulo funciona com os containers MinIO configurados:

### Desenvolvimento

- **MinIO API**: `http://localhost:9000`
- **MinIO Console**: `http://localhost:9001`
- **Credenciais**: `minioadmin` / `minioadmin123`

### Container para Container

- **Endpoint**: `http://minio:9000`
- **Network**: `boilerplate_network`

## Funcionalidades

### ✅ Implementadas

- [x] Conexão com MinIO e AWS S3
- [x] Upload/download de arquivos
- [x] Listagem de arquivos
- [x] Geração de URLs presigned
- [x] Criação automática de buckets
- [x] Health check e monitoramento
- [x] Reconexão automática
- [x] Plugin Fastify integrado
- [x] Suporte a metadados
- [x] Configuração por ambiente

### 🔄 Planejadas

- [ ] Cache de arquivos locais
- [ ] Compressão automática
- [ ] Thumbnails para imagens
- [ ] Backup automático entre serviços
- [ ] Políticas de retenção
- [ ] Criptografia client-side

## Padrões de Uso

### Upload de Imagens de Usuário

```typescript
async uploadUserAvatar(userId: string, imageBuffer: Buffer) {
  return await fastify.bucketService.uploadFile({
    bucket: 'user-avatars',
    key: `${userId}/avatar-${Date.now()}.jpg`,
    body: imageBuffer,
    contentType: 'image/jpeg',
    metadata: {
      userId,
      uploadedAt: new Date().toISOString()
    }
  });
}
```

### Export de Dados

```typescript
async exportUserData(userId: string, data: any) {
  const jsonData = JSON.stringify(data, null, 2);
  return await fastify.bucketService.uploadFile({
    bucket: 'exports',
    key: `users/${userId}/export-${Date.now()}.json`,
    body: Buffer.from(jsonData),
    contentType: 'application/json'
  });
}
```

### Logs e Backups

```typescript
async backupLogs(date: string, logData: string) {
  return await fastify.bucketService.uploadFile({
    bucket: 'backups',
    key: `logs/${date}/app.log`,
    body: Buffer.from(logData),
    contentType: 'text/plain'
  });
}
```

## Monitoramento

### Health Check

```typescript
const isHealthy = await fastify.bucketService.healthCheck();
if (!isHealthy) {
  // Serviço não está saudável
}
```

### Status da Conexão

```typescript
const status = fastify.bucketConnectionManager.getConnectionStatus();
console.log({
  connected: status.isConnected,
  endpoint: status.endpoint,
  region: status.region,
  lastCheck: status.lastChecked
});
```

## Tratamento de Erros

### Erros Comuns

- **Bucket não existe**: Criado automaticamente
- **Arquivo não encontrado**: Throw error específico
- **Permissões**: Logs de erro detalhados
- **Conexão**: Reconexão automática

### Logs Estruturados

```json
{
  "level": "info",
  "component": "BucketService",
  "message": "File uploaded: users/123/avatar.jpg to bucket user-avatars",
  "timestamp": "2025-09-30T10:00:00Z"
}
```

## Migração AWS S3 ↔ MinIO

O módulo é **transparente** entre MinIO local e AWS S3:

- **Desenvolvimento**: MinIO automático
- **Produção**: AWS S3 automático
- **Código**: Mesmo em ambos ambientes
- **URLs**: Formato automático baseado no endpoint

## Integração com Jobs

```typescript
// Em jobs de processamento
await fastify.bucketService.uploadFile({
  bucket: 'processed-files',
  key: `jobs/${jobId}/result.json`,
  body: Buffer.from(JSON.stringify(result))
});
```

---

## Próximos Passos

1. **Testar Upload**: Criar endpoint de teste para upload
2. **Testar Download**: Criar endpoint para download
3. **Dashboard**: Interface para gerenciar arquivos
4. **Integração Jobs**: Usar bucket em jobs de processamento
5. **Métricas**: Coletar estatísticas de uso

O módulo está **pronto para uso** e segue os padrões da infraestrutura do projeto!
