# Document Entity - Interface & Dependency Injection

## Visão Geral

A entidade Document foi implementada seguindo os padrões estabelecidos no projeto para **interface de repository** e **injeção de dependência**, mantendo a mesma estrutura utilizada na entidade User.

## Arquitetura

### 📁 Estrutura de Arquivos

```
src/entities/document/
├── index.ts                        # Exportações principais
├── documentEntity.ts               # Schema e validações Mongoose + Zod
├── documentRepository.ts           # Repository com interface IDocumentRepository
├── documentRepository.factory.ts   # Factory para injeção de dependência
└── README.md                      # Esta documentação
```

## Interface IDocumentRepository

### 📋 Operações Básicas CRUD

```typescript
interface IDocumentRepository {
  // CRUD básico
  createDocument(documentData: Partial<IDocument>, session?: ClientSession): Promise<IDocument>;
  findById(id: string, session?: ClientSession): Promise<IDocument | null>;
  updateById(
    id: string,
    updateData: Partial<IDocument>,
    session?: ClientSession
  ): Promise<IDocument | null>;
  deleteById(id: string, session?: ClientSession): Promise<boolean>;

  // Operações específicas de documentos
  findByUserId(userId: string, session?: ClientSession): Promise<IDocument[]>;
  findByUserIdPaginated(
    userId: string,
    limit: number,
    offset: number,
    session?: ClientSession
  ): Promise<{ documents: IDocument[]; total: number }>;
  findByBucketKey(bucketKey: string, session?: ClientSession): Promise<IDocument | null>;
  findByFilename(filename: string, session?: ClientSession): Promise<IDocument | null>;

  // Operações com paginação
  findDocumentsWithPagination(
    filters: Record<string, any>,
    options: PaginationOptions,
    session?: ClientSession
  ): Promise<PaginationResult<IDocument>>;

  // Operações utilitárias
  exists(filters: Record<string, any>, session?: ClientSession): Promise<boolean>;
  count(filters: Record<string, any>, session?: ClientSession): Promise<number>;
  getDocumentStats(
    session?: ClientSession
  ): Promise<{ total: number; totalSize: number; byMimeType: Record<string, number> }>;
}
```

### 🏗️ Implementação Repository

O `DocumentRepository` implementa `IDocumentRepository` usando **composição** com `BaseRepository` em vez de herança:

```typescript
export class DocumentRepository implements IDocumentRepository {
  constructor(private baseRepository: IBaseRepository<IDocument>) {}

  // Método auxiliar para sessões MongoDB
  private getRepoOptions(session?: ClientSession): RepositoryOptions {
    return session ? { session } : {};
  }

  // Implementação dos métodos da interface...
}
```

### 🏭 Factory Pattern para Injeção de Dependência

```typescript
export class DocumentRepositoryFactory {
  /**
   * Criar repository com connection manager injetado
   */
  static async createDocumentRepository(
    connectionManager?: IMongoConnectionManager
  ): Promise<IDocumentRepository> {
    let connManager: IMongoConnectionManager;

    if (connectionManager) {
      connManager = connectionManager;
    } else {
      connManager = await MongoConnectionManagerFactory.create();
    }

    if (!connManager.isConnected()) {
      await connManager.connect();
    }

    const baseRepository = new BaseRepository<IDocument>(DocumentModel, connManager);
    return new DocumentRepository(baseRepository);
  }

  /**
   * Criar repository para testes com mock
   */
  static createDocumentRepositoryForTesting(mockBaseRepository: any): IDocumentRepository {
    return new DocumentRepository(mockBaseRepository);
  }
}
```

## Uso nos Controllers

### 🎮 Controller com Injeção de Dependência

```typescript
export class DocumentsController {
  private documentService: DocumentService;
  private repository!: IDocumentRepository; // Inicializado assincronamente

  constructor(
    private fastify: FastifyInstance,
    repository?: IDocumentRepository // Opcional para testes
  ) {
    this.documentService = new DocumentService(fastify);

    if (repository) {
      this.repository = repository;
    } else {
      this.initializeRepository();
    }
  }

  private async initializeRepository(): Promise<void> {
    if (!this.repository) {
      this.repository = await DocumentRepositoryFactory.createDocumentRepository();
    }
  }

  // Métodos do controller usam await this.initializeRepository() quando necessário
}
```

## Benefícios da Implementação

### ✅ **Seguindo Padrões do Projeto**

1. **Interface Repository**: Mesma estrutura do `IUserRepository`
2. **Factory Pattern**: Mesmo padrão do `UserRepositoryFactory`
3. **Composição vs Herança**: Usa `BaseRepository` injetado via construtor
4. **Suporte a Transações**: Todos os métodos aceitam `ClientSession`
5. **Tipagem TypeScript**: Interfaces strongly-typed para type safety

### ✅ **Testabilidade**

```typescript
// Em testes unitários
const mockRepository = createMockDocumentRepository();
const controller = new DocumentsController(fastify, mockRepository);

// O repository é injetado diretamente, permitindo mocking completo
```

### ✅ **Separation of Concerns**

- **Entity**: Define schema e validações (`documentEntity.ts`)
- **Repository**: Operações de banco de dados (`documentRepository.ts`)
- **Factory**: Gerenciamento de dependências (`documentRepository.factory.ts`)
- **Controller**: Lógica de negócio e HTTP (`documents.controller.ts`)
- **Service**: Integração com MinIO S3 (`document.service.ts`)

### ✅ **Flexibilidade**

- **Connection Manager**: Pode ser injetado para diferentes ambientes
- **BaseRepository**: Operações padronizadas reutilizadas
- **Session Support**: Transações MongoDB nativas
- **Testing**: Mocking facilitado via factory pattern

## Exportações

### 📦 index.ts

```typescript
// Classes
export { DocumentModel } from './documentEntity.js';
export { DocumentRepository } from './documentRepository.js';
export { DocumentRepositoryFactory } from './documentRepository.factory.js';

// Interfaces
export type { IDocument, DocumentValidationSchema } from './documentEntity.js';
export type { IDocumentRepository } from './documentRepository.js';
```

## Comparação com Padrão User

| Aspecto          | User Entity                       | Document Entity                   |
| ---------------- | --------------------------------- | --------------------------------- |
| **Interface**    | `IUserRepository`                 | `IDocumentRepository`             |
| **Factory**      | `UserRepositoryFactory`           | `DocumentRepositoryFactory`       |
| **Composição**   | ✅ BaseRepository injetado        | ✅ BaseRepository injetado        |
| **Transações**   | ✅ ClientSession em todos métodos | ✅ ClientSession em todos métodos |
| **Testes**       | ✅ Factory para mocking           | ✅ Factory para mocking           |
| **Dependências** | ✅ ConnectionManager injetado     | ✅ ConnectionManager injetado     |

## Exemplos de Uso

### 🔧 Uso Básico no Controller

```typescript
// Listar documentos do usuário
const { documents, total } = await this.repository.findByUserIdPaginated(userId, limit, offset);

// Encontrar por ID
const document = await this.repository.findById(documentId);

// Criar novo documento
const newDocument = await this.repository.createDocument({
  filename: 'file.csv',
  originalName: 'original.csv',
  uploadedBy: userId
  // ... outros campos
});
```

### 🧪 Uso em Testes

```typescript
describe('DocumentsController', () => {
  let mockRepository: jest.Mocked<IDocumentRepository>;
  let controller: DocumentsController;

  beforeEach(() => {
    mockRepository = createMockDocumentRepository();
    controller = new DocumentsController(fastify, mockRepository);
  });

  it('should list user documents', async () => {
    mockRepository.findByUserIdPaginated.mockResolvedValue({
      documents: [mockDocument],
      total: 1
    });

    // Test implementation...
  });
});
```

---

## ✨ Resultado

A entidade Document agora segue exatamente os mesmos padrões de **interface**, **injeção de dependência** e **factory pattern** estabelecidos pela entidade User, garantindo:

- **Consistência arquitetural** em todo o projeto
- **Facilidade de manutenção** e extensão
- **Testabilidade completa** com mocking
- **Type safety** com TypeScript
- **Suporte nativo a transações MongoDB**
- **Reutilização** do BaseRepository existente

Todas as rotas de documentos (`/api/documents/*`) continuam funcionando normalmente com a nova implementação! 🎉
