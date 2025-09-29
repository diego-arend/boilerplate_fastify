# MongoDB Infrastructure

Sistema MongoDB integrado ao Fastify usando **Mongoose** com dependency injection, BaseRepository genérico e suporte completo a transações.

## Estrutura

```
src/infraestructure/mongo/
├── mongodb.plugin.ts           # Plugin principal Fastify
├── baseRepository.ts           # Repository genérico com CRUD
├── connectionManager.ts        # Gerenciador de conexão
├── transactionManager.ts       # Gerenciador de transações
├── transaction.plugin.ts       # Plugin para transações automáticas
├── *.factory.ts               # Factories para DI
├── *.interface.ts             # Interfaces para DI
└── README.md
```

## Configuração

Adicione ao `.env`:

```env
MONGO_URI=mongodb://admin:password@mongodb:27017/boilerplate?authSource=admin
```

## Uso Básico

```typescript
// Via plugin (recomendado)
await fastify.register(mongoPlugin);

// Repository com DI
const repository = new BaseRepository(UserModel, fastify.mongoConnectionManager);
const user = await repository.create({ name: 'João', email: 'joao@example.com' });
```

## BaseRepository - Operações CRUD

### **Criação e Inicialização**

```typescript
import { BaseRepository } from '../infraestructure/mongo/baseRepository.js';
import { UserModel, type IUser } from '../entities/user/userEntity.js';

// Via factory (recomendado)
class UserRepository {
  private baseRepository: BaseRepository<IUser>;

  constructor(connectionManager: IMongoConnectionManager) {
    this.baseRepository = new BaseRepository(UserModel, connectionManager);
  }

  // Métodos específicos do User
  async findByEmail(email: string): Promise<IUser | null> {
    return this.baseRepository.findOne({ email });
  }
}

// Via Fastify plugin
const userRepository = new BaseRepository(UserModel, fastify.mongoConnectionManager);
```

### **Operações Create**

```typescript
// Criar documento único
const newUser = await repository.create({
  name: 'João Silva',
  email: 'joao@example.com',
  role: 'user'
});

// Criar múltiplos documentos
const users = await repository.createMany([
  { name: 'Ana', email: 'ana@example.com' },
  { name: 'Pedro', email: 'pedro@example.com' }
]);

// Criar com validação customizada
const user = await repository.create(
  { name: 'Maria', email: 'maria@example.com' },
  {
    runValidators: true, // Executar validações do schema
    session: mongoSession // Para transações
  }
);
```

### **Operações Read**

```typescript
// Buscar por ID
const user = await repository.findById('670f8b2e8a1d2c3e4f5g6h7i');

// Buscar um documento
const admin = await repository.findOne({ role: 'admin' });

// Buscar múltiplos com filtros
const activeUsers = await repository.find({
  isActive: true,
  createdAt: { $gte: new Date('2024-01-01') }
});

// Buscar todos
const allUsers = await repository.findAll();

// Buscar com paginação
const paginatedUsers = await repository.findPaginated(
  { isActive: true }, // filtro
  1, // página
  10, // limite por página
  { createdAt: -1 } // ordenação
);
// Retorna: { data: IUser[], total: number, page: number, totalPages: number }

// Contar documentos
const userCount = await repository.count({ role: 'user' });

// Verificar existência
const exists = await repository.exists({ email: 'joao@example.com' });
```

### **Operações Update**

```typescript
// Atualizar por ID
const updatedUser = await repository.updateById('670f8b2e8a1d2c3e4f5g6h7i', {
  lastLogin: new Date()
});

// Atualizar um documento
const result = await repository.updateOne(
  { email: 'joao@example.com' },
  { $set: { isActive: false } }
);

// Atualizar múltiplos documentos
const bulkResult = await repository.updateMany(
  { role: 'user' },
  { $set: { permissions: ['read'] } }
);

// Update com upsert
const user = await repository.updateOne(
  { email: 'novo@example.com' },
  { $set: { name: 'Novo Usuário' } },
  { upsert: true } // Cria se não existir
);
```

### **Operações Delete**

```typescript
// Deletar por ID
const deleted = await repository.deleteById('670f8b2e8a1d2c3e4f5g6h7i');

// Deletar um documento
const result = await repository.deleteOne({ email: 'temp@example.com' });

// Deletar múltiplos
const bulkDelete = await repository.deleteMany({ isActive: false });

// Soft delete (se implementado no schema)
const softDeleted = await repository.updateById(userId, { deletedAt: new Date(), isActive: false });
```

## Transações Atômicas

### **Via Plugin Fastify (Recomendado)**

```typescript
import { transactionPlugin, TRANSACTION_ROUTE_CONFIG } from '../infraestructure/mongo/index.js';

// Registrar plugin de transações
await app.register(transactionPlugin, {
  defaultTimeout: 30000,
  enableLogging: true
});

// Rota com transação automática
app.post(
  '/transfer',
  {
    schema: {
      body: {
        type: 'object',
        required: ['fromAccount', 'toAccount', 'amount'],
        properties: {
          fromAccount: { type: 'string' },
          toAccount: { type: 'string' },
          amount: { type: 'number', minimum: 0.01 }
        }
      }
    },
    config: {
      [TRANSACTION_ROUTE_CONFIG]: {
        enabled: true,
        rollbackOnError: true,
        rollbackOnStatusCode: [400, 422, 500],
        options: { maxTimeMS: 15000 }
      }
    }
  },
  async (request, reply) => {
    const { fromAccount, toAccount, amount } = request.body;
    const session = request.mongoSession; // Sessão automática

    // Validar saldos
    const fromUser = await repository.findById(fromAccount, { session });
    if (!fromUser || fromUser.balance < amount) {
      return reply.status(400).send({ error: 'Insufficient balance' });
    }

    // Operações atômicas
    await repository.updateById(fromAccount, { $inc: { balance: -amount } }, { session });

    await repository.updateById(toAccount, { $inc: { balance: amount } }, { session });

    // Log da transação
    await transactionLogRepo.create(
      {
        fromAccount,
        toAccount,
        amount,
        type: 'transfer',
        timestamp: new Date()
      },
      { session }
    );

    // Commit automático se chegou aqui
    return reply.send({
      success: true,
      transactionId: request.transactionId,
      newBalance: fromUser.balance - amount
    });
  }
);
```

### **Transação Manual**

```typescript
import { withTransaction } from '../infraestructure/mongo/transaction.utils.js';

// Usando utility function
const transferResult = await withTransaction(async session => {
  // Validações
  const fromUser = await repository.findById(fromAccount, { session });
  const toUser = await repository.findById(toAccount, { session });

  if (!fromUser || !toUser) {
    throw new Error('User not found');
  }

  if (fromUser.balance < amount) {
    throw new Error('Insufficient balance');
  }

  // Operações atômicas
  const updatedFrom = await repository.updateById(
    fromAccount,
    { $inc: { balance: -amount } },
    { session, new: true }
  );

  const updatedTo = await repository.updateById(
    toAccount,
    { $inc: { balance: amount } },
    { session, new: true }
  );

  // Criar log da transação
  const transactionLog = await repository.create(
    {
      fromAccount,
      toAccount,
      amount,
      type: 'transfer'
    },
    { session }
  );

  return {
    fromUser: updatedFrom,
    toUser: updatedTo,
    transactionLog
  };
});

// Resultado contém success e data ou error
if (transferResult.success) {
  console.log('Transfer completed:', transferResult.data);
} else {
  console.error('Transfer failed:', transferResult.error);
}
```

### **TransactionManager Direto**

```typescript
import { TransactionManagerFactory } from '../infraestructure/mongo/transactionManager.factory.js';

const connectionManager = MongoConnectionManagerFactory.create();
const transactionManager = TransactionManagerFactory.create(connectionManager);

// Controle manual completo
const session = await transactionManager.startTransaction({
  maxTimeMS: 30000,
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority', j: true }
});

try {
  // Operação 1
  const order = await repository.create(
    {
      customerId: 'customer123',
      items: [{ product: 'item1', quantity: 2 }],
      total: 100.0
    },
    { session }
  );

  // Operação 2
  await inventoryRepo.updateMany(
    { productId: { $in: ['item1'] } },
    { $inc: { stock: -2 } },
    { session }
  );

  // Operação 3
  await customerRepo.updateById('customer123', { $push: { orders: order._id } }, { session });

  // Commit manual
  await transactionManager.commitTransaction(session);
  console.log('Order created successfully');
} catch (error) {
  // Rollback manual
  await transactionManager.rollbackTransaction(session);
  console.error('Order creation failed:', error);
  throw error;
}
```

### **Transações Complexas**

```typescript
// Transação com múltiplos repositories
async function complexBusinessOperation(orderData: any) {
  return await withTransaction(async session => {
    // 1. Criar pedido
    const order = await orderRepo.create(
      {
        customerId: orderData.customerId,
        items: orderData.items,
        status: 'pending'
      },
      { session }
    );

    // 2. Atualizar estoque de cada item
    for (const item of orderData.items) {
      const product = await productRepo.findById(item.productId, { session });

      if (!product || product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.productId}`);
      }

      await productRepo.updateById(
        item.productId,
        { $inc: { stock: -item.quantity } },
        { session }
      );
    }

    // 3. Atualizar dados do cliente
    await customerRepo.updateById(
      orderData.customerId,
      {
        $push: { orders: order._id },
        $inc: { totalOrders: 1 }
      },
      { session }
    );

    // 4. Criar entrada no log de auditoria
    await auditRepo.create(
      {
        action: 'order_created',
        entityType: 'order',
        entityId: order._id,
        userId: orderData.userId,
        metadata: {
          items: orderData.items.length,
          total: orderData.total
        }
      },
      { session }
    );

    // 5. Enviar para fila de processamento (se suportar transações)
    await queueRepo.create(
      {
        type: 'process_order',
        payload: { orderId: order._id },
        priority: 'high'
      },
      { session }
    );

    return {
      order,
      message: 'Order created successfully'
    };
  });
}

// Uso
const result = await complexBusinessOperation({
  customerId: 'customer123',
  userId: 'user456',
  items: [
    { productId: 'prod1', quantity: 2 },
    { productId: 'prod2', quantity: 1 }
  ],
  total: 150.0
});
```

### **Configurações Avançadas de Transação**

```typescript
// Plugin com configurações customizadas
await app.register(transactionPlugin, {
  defaultTimeout: 45000,
  enableLogging: true,

  // Rotas com transações automáticas
  autoTransactionRoutes: [
    '/api/orders',
    '/api/transfers',
    /^\/api\/admin\// // Todas as rotas de admin
  ],

  // Configurações padrão
  defaultOptions: {
    maxTimeMS: 30000,
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority', j: true }
  }
});

// Configuração por rota específica
app.post(
  '/api/complex-operation',
  {
    config: {
      [TRANSACTION_ROUTE_CONFIG]: {
        enabled: true,
        rollbackOnStatusCode: [400, 422, 500],
        options: {
          maxTimeMS: 60000, // Transação mais longa
          readConcern: { level: 'majority' },
          writeConcern: { w: 'majority', j: true, wtimeout: 5000 }
        }
      }
    }
  },
  async (request, reply) => {
    // Lógica complexa com transação personalizada
  }
);
```

## Melhores Práticas

### **BaseRepository**

- ✅ Use factory pattern para injeção de dependência
- ✅ Implemente repositories específicos por entidade
- ✅ Valide dados antes de operações
- ✅ Use paginação para grandes conjuntos de dados
- ❌ Não execute queries pesadas sem índices

### **Transações**

- ✅ Use plugin para rotas web (automático)
- ✅ Use `withTransaction` para lógica de negócio
- ✅ Mantenha transações curtas e focadas
- ✅ Configure timeouts apropriados
- ❌ Não use transações para operações simples de leitura
