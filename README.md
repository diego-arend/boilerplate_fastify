# Boilerplate Fastify

Boilerplate para aplicações Fastify com TypeScript, MongoDB e Redis.

## 🚀 Executando com Docker

### Pré-requisitos

- Docker
- Docker Compose

### Ambiente de Desenvolvimento

Para executar em modo desenvolvimento com hot reload:

```bash
# Construir e executar todos os serviços
docker-compose -f docker-compose.dev.yml up --build

# Ou em background
docker-compose -f docker-compose.dev.yml up -d --build
```

### Ambiente de Produção

Para executar em modo produção:

```bash
# Construir e executar todos os serviços
docker-compose up --build

# Ou em background
docker-compose up -d --build
```

### Serviços Disponíveis

- **App** (Fastify): http://localhost:3001
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

### Comandos Úteis

```bash
# Ver logs da aplicação
docker-compose logs app

# Ver logs de todos os serviços
docker-compose logs

# Parar todos os serviços
docker-compose down

# Parar e remover volumes
docker-compose down -v

# Executar comandos no container da aplicação
docker-compose exec app sh

# Verificar status dos serviços
docker-compose ps
```

## 📚 Documentação da API

### Swagger UI (Desenvolvimento)
A documentação interativa da API está disponível apenas em ambiente de desenvolvimento:

- **URL**: `http://localhost:3001/docs`
- **Ambiente**: `NODE_ENV=development`
- **Funcionalidades**: Testes interativos, schemas, autenticação

Para acessar:
```bash
# Definir ambiente de desenvolvimento
export NODE_ENV=development

# Iniciar aplicação
docker-compose -f docker-compose.dev.yml up --build
```

Em seguida, acesse: `http://localhost:3001/docs`

### Arquivos de Documentação
- `http-docs/auth.http` - Testes HTTP para autenticação
- `src/lib/response/README.md` - Documentação da classe ApiResponseHandler

### Scripts de Desenvolvimento

```bash
# Executar em modo desenvolvimento (com Swagger se NODE_ENV=development)
pnpm dev

# Para habilitar Swagger, defina a variável de ambiente:
NODE_ENV=development pnpm dev
```

### Health Checks

Todos os serviços incluem health checks automáticos:

- **App**: Verifica se a rota `/health` responde
- **MongoDB**: Testa conexão com o banco
- **Redis**: Testa conexão com o cache

### Variáveis de Ambiente

As seguintes variáveis são configuradas automaticamente:

- `PORT=3001`
- `MONGO_URI=mongodb://admin:password@mongodb:27017/boilerplate?authSource=admin`
- `JWT_SECRET` (configurado no docker-compose)
- `NODE_ENV=production` (ou development)

### Desenvolvimento Local

Para desenvolvimento local sem Docker:

```bash
# Instalar dependências
pnpm install

# Executar em modo desenvolvimento
pnpm run dev

# Build para produção
pnpm run build

# Executar em produção
pnpm run start
```

### Estrutura do Projeto

```
src/
├── app.ts                 # Configuração principal da aplicação
├── server.ts             # Inicialização do servidor
├── infraestructure/
│   ├── mongo/           # Conexão e repositório MongoDB
│   └── server/          # Configurações Fastify
├── entities/            # Schemas das entidades
├── modules/             # Módulos de negócio
└── lib/                 # Utilitários
```

### Segurança

O projeto inclui múltiplas camadas de segurança:

- Validações rigorosas nos schemas
- Sanitização de entrada
- Proteção contra injeções
- Autenticação JWT
- HTTPS obrigatório em produção

Para mais detalhes sobre segurança, consulte o arquivo `PlanTask.chatmode.md`.