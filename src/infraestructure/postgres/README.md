# PostgreSQL Infrastructure

Sistema PostgreSQL integrado ao Fastify usando **TypeORM** com dependency injection, connection pooling e suporte a transações para arquitetura híbrida (MongoDB + PostgreSQL).

## Estrutura

```
src/infraestructure/postgres/
├── postgres.plugin.ts                      # Plugin principal Fastify
├── postgresConnectionManager.ts            # Gerenciador de conexão TypeORM
├── postgresConnectionManager.interface.ts  # Interface para DI
├── postgresConnectionManager.factory.ts    # Factory para DI
├── postgres.types.ts                       # Types e interfaces
├── index.ts                                # Exports públicos
└── README.md
```

## 📋 Quando Usar PostgreSQL vs MongoDB

### Use **PostgreSQL** para:

- ✅ Dados relacionais complexos com JOINs
- ✅ Transações ACID críticas
- ✅ Consultas analíticas e agregações complexas
- ✅ Busca vetorial com pgvector (embeddings, similarity search)
- ✅ Full-text search avançado
- ✅ Dados estruturados com schema rígido

### Use **MongoDB** para:

- ✅ Documentos flexíveis sem schema fixo
- ✅ Dados hierárquicos e nested documents
- ✅ Alta escalabilidade horizontal
- ✅ Schema dinâmico e evolutivo
- ✅ Cache de sessões e dados temporários

## 🔧 Configuração

### 1. Variáveis de Ambiente

Adicione ao `.env`:

```env
# PostgreSQL Configuration (Optional - for hybrid architecture)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=boilerplate
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_SSL=false
POSTGRES_SYNCHRONIZE=false  # NEVER true in production
POSTGRES_LOGGING=true

# Connection Pool Configuration (Optional)
POSTGRES_POOL_MIN=2
POSTGRES_POOL_MAX=10
POSTGRES_CONNECTION_TIMEOUT=5000
POSTGRES_IDLE_TIMEOUT=30000
```

**⚠️ IMPORTANTE**: PostgreSQL é **opcional**. Se não configurado, o plugin será automaticamente desabilitado sem erros.

### 2. Docker Compose

O PostgreSQL com **pgvector** já está configurado:

```yaml
# docker-compose.dev.yml
postgres:
  image: pgvector/pgvector:pg16
  container_name: boilerplate-postgres-dev
  environment:
    POSTGRES_DB: boilerplate
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  ports:
    - '5432:5432'
  volumes:
    - postgres_data:/var/lib/postgresql/data
  networks:
    - boilerplate_network
```

**Iniciar serviços**:

```bash
pnpm docker:dev
```

## 🚀 Uso Básico

### Via Fastify Plugin (Recomendado)

O plugin é automaticamente registrado em `app.ts`:

```typescript
import postgresPlugin from './infraestructure/postgres/postgres.plugin.js';

// Já registrado automaticamente após MongoDB
await fastify.register(postgresPlugin);
```

Acesso via decorator:

```typescript
// No controller ou route
const postgres = fastify.postgres;

if (!postgres) {
  // PostgreSQL não configurado
  return reply.code(501).send({ error: 'PostgreSQL not available' });
}

// Verificar conexão
if (!postgres.isConnected()) {
  throw new Error('PostgreSQL not connected');
}

// Health check
const health = await postgres.getHealthInfo();
console.log('PostgreSQL version:', health.version);
```

### Via Factory (Para Testes ou Uso Direto)

```typescript
import { createPostgresConnectionManager } from './infraestructure/postgres/index.js';

const postgres = createPostgresConnectionManager({
  host: 'localhost',
  port: 5432,
  database: 'boilerplate',
  username: 'postgres',
  password: 'postgres',
  ssl: false,
  synchronize: false, // NEVER true in production
  logging: true,
  poolMax: 10
});

await postgres.connect();
```

## 📊 Connection Manager API

### Gerenciamento de Conexão

```typescript
const postgres = fastify.postgres!;

// Conectar ao PostgreSQL
await postgres.connect();

// Desconectar
await postgres.disconnect();

// Verificar status
const isConnected = postgres.isConnected();

// Obter DataSource do TypeORM
const dataSource = postgres.getDataSource();
```

### Health Check e Monitoramento

```typescript
// Informações de saúde da conexão
const health = await postgres.getHealthInfo();

console.log({
  isConnected: health.isConnected, // true/false
  host: health.host, // "localhost"
  port: health.port, // 5432
  database: health.database, // "boilerplate"
  version: health.version, // "PostgreSQL 16.3"
  poolSize: health.poolSize, // 10
  activeConnections: health.activeConnections, // 3
  idleConnections: health.idleConnections // 7
});
```

### Executar Queries Raw

```typescript
// Query simples
const result = await postgres.runQuery<{ count: number }>('SELECT COUNT(*) as count FROM users');

console.log('Total users:', result.rows[0].count);
console.log('Rows affected:', result.rowCount);
console.log('Command:', result.command); // "SELECT"

// Query com parâmetros (previne SQL injection)
const users = await postgres.runQuery<{ id: number; name: string; email: string }>(
  'SELECT id, name, email FROM users WHERE email = $1',
  ['user@example.com']
);

users.rows.forEach(user => {
  console.log(`${user.name} - ${user.email}`);
});

// Query com múltiplos parâmetros
const activeUsers = await postgres.runQuery(
  'SELECT * FROM users WHERE created_at >= $1 AND status = $2',
  [new Date('2024-01-01'), 'active']
);
```

## 🔐 Transações com TypeORM

### Transação Automática com QueryRunner

```typescript
const queryRunner = postgres.createQueryRunner();

// Iniciar transação
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  // Executar múltiplas queries dentro da transação
  await queryRunner.query('INSERT INTO users (name, email) VALUES ($1, $2)', [
    'João Silva',
    'joao@example.com'
  ]);

  await queryRunner.query('INSERT INTO user_profiles (user_id, bio) VALUES ($1, $2)', [
    userId,
    'Bio do João'
  ]);

  // Commit se tudo deu certo
  await queryRunner.commitTransaction();
} catch (error) {
  // Rollback em caso de erro
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  // Sempre liberar o QueryRunner
  await queryRunner.release();
}
```

### Transação com TypeORM Repository (Quando usar Entities)

```typescript
const dataSource = postgres.getDataSource();

await dataSource.transaction(async transactionalEntityManager => {
  // Usar o transactionalEntityManager ao invés do repository normal
  const user = await transactionalEntityManager.save(User, {
    name: 'Maria Silva',
    email: 'maria@example.com'
  });

  const profile = await transactionalEntityManager.save(UserProfile, {
    userId: user.id,
    bio: 'Bio da Maria'
  });

  // Commit automático ao final do callback
  // Rollback automático se houver erro
});
```

## 🔍 Busca Vetorial com pgvector

PostgreSQL inclui a extensão **pgvector** para similarity search e embeddings.

### 1. Habilitar Extensão

```typescript
await postgres.runQuery('CREATE EXTENSION IF NOT EXISTS vector');
```

### 2. Criar Tabela com Coluna Vector

```typescript
await postgres.runQuery(`
  CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI embeddings dimension
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Criar índice para busca eficiente
await postgres.runQuery(`
  CREATE INDEX IF NOT EXISTS documents_embedding_idx 
  ON documents 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
`);
```

### 3. Inserir Documentos com Embeddings

```typescript
// Exemplo com embedding OpenAI (1536 dimensões)
const embedding = [0.1, 0.2, 0.3 /* ... */]; // Array com 1536 números

await postgres.runQuery('INSERT INTO documents (content, embedding) VALUES ($1, $2)', [
  'Conteúdo do documento',
  JSON.stringify(embedding)
]);
```

### 4. Busca por Similaridade

```typescript
// Buscar os 10 documentos mais similares
const queryEmbedding = [0.1, 0.2, 0.3 /* ... */];

const similar = await postgres.runQuery<{
  id: number;
  content: string;
  similarity: number;
}>(
  `
  SELECT id, content, 
         1 - (embedding <=> $1::vector) as similarity
  FROM documents
  ORDER BY embedding <=> $1::vector
  LIMIT 10
  `,
  [JSON.stringify(queryEmbedding)]
);

similar.rows.forEach(doc => {
  console.log(`[${doc.similarity.toFixed(4)}] ${doc.content}`);
});
```

## 🏗️ TypeORM Entities (Opcional)

Para uso avançado com TypeORM entities:

### 1. Criar Entity

```typescript
// src/entities/product/productEntity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
```

### 2. Adicionar Entity à Config

```typescript
// Atualizar postgresConnectionManager.factory.ts
const config: PostgresConfig = {
  // ... outras configs
  entities: [Product],
  synchronize: process.env.NODE_ENV === 'development' // Apenas em dev
};
```

### 3. Usar Repository Pattern

```typescript
const dataSource = fastify.postgres!.getDataSource();
const productRepository = dataSource.getRepository(Product);

// Criar produto
const product = await productRepository.save({
  name: 'Notebook',
  description: 'Notebook Dell i5',
  price: 3500.0,
  stock: 10
});

// Buscar produtos
const products = await productRepository.find({
  where: { stock: MoreThan(0) },
  order: { createdAt: 'DESC' },
  take: 10
});

// Buscar com relações
const productWithRelations = await productRepository.findOne({
  where: { id: 1 },
  relations: ['category', 'reviews']
});
```

## 🔒 Boas Práticas

### Segurança

```typescript
// ❌ NUNCA: Concatenar strings (SQL Injection)
await postgres.runQuery(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ SEMPRE: Usar parâmetros posicionais
await postgres.runQuery('SELECT * FROM users WHERE email = $1', [email]);

// ✅ Validar inputs com Zod antes de queries
import { z } from 'zod';

const emailSchema = z.string().email();
const validEmail = emailSchema.parse(userInput);
```

### Performance

```typescript
// ✅ Usar connection pooling (já configurado)
POSTGRES_POOL_MIN = 2;
POSTGRES_POOL_MAX = 10;

// ✅ Criar índices para queries frequentes
await postgres.runQuery(`
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
`);

// ✅ Usar EXPLAIN para analisar queries lentas
const plan = await postgres.runQuery('EXPLAIN ANALYZE SELECT * FROM users WHERE email = $1', [
  email
]);
console.log(plan.rows);

// ✅ Limitar resultados com LIMIT
await postgres.runQuery('SELECT * FROM users ORDER BY created_at DESC LIMIT 100');
```

### Transações

```typescript
// ✅ Sempre usar try/finally com QueryRunner
const queryRunner = postgres.createQueryRunner();
try {
  await queryRunner.connect();
  await queryRunner.startTransaction();

  // ... operações

  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  await queryRunner.release(); // IMPORTANTE: Liberar conexão
}
```

## 🧪 Testes

### Setup de Teste

```typescript
// tests/setup/postgres.ts
import { createPostgresConnectionManager } from '../../src/infraestructure/postgres/index.js';

export async function setupTestPostgres() {
  const postgres = createPostgresConnectionManager({
    host: 'localhost',
    port: 5432,
    database: 'boilerplate_test',
    username: 'postgres',
    password: 'postgres',
    logging: false
  });

  await postgres.connect();
  return postgres;
}

export async function cleanupTestPostgres(postgres: IPostgresConnectionManager) {
  // Limpar tabelas de teste
  await postgres.runQuery('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  await postgres.disconnect();
}
```

### Exemplo de Teste

```typescript
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { setupTestPostgres, cleanupTestPostgres } from './setup/postgres.js';

describe('User CRUD with PostgreSQL', () => {
  let postgres: IPostgresConnectionManager;

  beforeAll(async () => {
    postgres = await setupTestPostgres();
  });

  afterAll(async () => {
    await cleanupTestPostgres(postgres);
  });

  it('should create user', async () => {
    const result = await postgres.runQuery<{ id: number }>(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
      ['Test User', 'test@example.com']
    );

    expect(result.rows[0].id).toBeGreaterThan(0);
  });

  it('should find user by email', async () => {
    const result = await postgres.runQuery<{ name: string; email: string }>(
      'SELECT name, email FROM users WHERE email = $1',
      ['test@example.com']
    );

    expect(result.rows[0].email).toBe('test@example.com');
  });
});
```

## 🔄 Migração de Dados MongoDB → PostgreSQL

Exemplo de migração de dados entre MongoDB e PostgreSQL:

```typescript
// Migrar usuários do MongoDB para PostgreSQL
async function migrateUsers(fastify: FastifyInstance) {
  const mongoUsers = await fastify.mongoConnectionManager
    .getConnection()
    .collection('users')
    .find({})
    .toArray();

  const postgres = fastify.postgres!;
  const queryRunner = postgres.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    for (const user of mongoUsers) {
      await queryRunner.query(
        'INSERT INTO users (mongo_id, name, email, created_at) VALUES ($1, $2, $3, $4)',
        [user._id.toString(), user.name, user.email, user.createdAt]
      );
    }

    await queryRunner.commitTransaction();
    fastify.log.info(`Migrated ${mongoUsers.length} users to PostgreSQL`);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

## 📚 Referências

- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Fastify Plugin Guide](https://fastify.dev/docs/latest/Reference/Plugins/)

## 🆘 Troubleshooting

### PostgreSQL não conecta

```bash
# Verificar se o serviço está rodando
docker ps | grep postgres

# Ver logs do container
docker logs boilerplate-postgres-dev

# Testar conexão manual
psql -h localhost -U postgres -d boilerplate
```

### Erro de pool esgotado

```env
# Aumentar tamanho do pool
POSTGRES_POOL_MAX=20
POSTGRES_CONNECTION_TIMEOUT=10000
```

### Query muito lenta

```typescript
// Analisar query com EXPLAIN
const plan = await postgres.runQuery(`
  EXPLAIN ANALYZE 
  SELECT * FROM users WHERE email LIKE '%@example.com'
`);

// Criar índice se necessário
await postgres.runQuery('CREATE INDEX idx_users_email ON users USING btree (email)');
```

---

**Nota**: PostgreSQL é **opcional** neste boilerplate. O sistema funciona perfeitamente apenas com MongoDB. Use PostgreSQL quando precisar de recursos específicos como transações ACID complexas, busca vetorial com pgvector, ou consultas relacionais avançadas.
