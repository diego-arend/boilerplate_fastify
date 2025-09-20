# ApiResponseHandler

Classe utilitária para padronização de respostas da API Fastify. Centraliza o tratamento de respostas de sucesso e erro, garantindo consistência em toda a aplicação.

## Estrutura de Resposta

Todas as respostas seguem o formato padrão:

```json
{
  "success": boolean,
  "message": string,
  "code": number,
  "data"?: any,
  "error"?: string
}
```

## Métodos Disponíveis

### Respostas de Sucesso

#### `success(reply, message?, data?, code?)`
Resposta genérica de sucesso.

```typescript
import { ApiResponseHandler } from '../lib/response/index.js';

// Uso básico
return ApiResponseHandler.success(reply, 'Operação realizada');

// Com dados
return ApiResponseHandler.success(reply, 'Usuário criado', userData);

// Com código específico
return ApiResponseHandler.success(reply, 'OK', data, 200);
```

#### `created(reply, message?, data?)`
Resposta para criação de recursos (HTTP 201).

```typescript
return ApiResponseHandler.created(reply, 'Usuário registrado', userData);
```

#### `noContent(reply, message?)`
Resposta sem conteúdo (HTTP 204).

```typescript
return ApiResponseHandler.noContent(reply, 'Usuário deletado');
```

#### `paginated(reply, data, total, page, limit, message?)`
Resposta com paginação.

```typescript
return ApiResponseHandler.paginated(reply, users, 150, 1, 10, 'Usuários listados');
```

### Respostas de Erro

#### `validationError(reply, message?, details?)`
Erro de validação (HTTP 400).

```typescript
return ApiResponseHandler.validationError(reply, 'Email é obrigatório');
```

#### `authError(reply, message?, details?)`
Erro de autenticação (HTTP 401).

```typescript
return ApiResponseHandler.authError(reply, 'Token inválido');
```

#### `forbidden(reply, message?, details?)`
Erro de autorização (HTTP 403).

```typescript
return ApiResponseHandler.forbidden(reply, 'Acesso negado');
```

#### `notFound(reply, message?, details?)`
Recurso não encontrado (HTTP 404).

```typescript
return ApiResponseHandler.notFound(reply, 'Usuário não encontrado');
```

#### `conflict(reply, message?, details?)`
Conflito de dados (HTTP 409).

```typescript
return ApiResponseHandler.conflict(reply, 'Email já cadastrado');
```

#### `internalError(reply, error?, logError?)`
Erro interno do servidor (HTTP 500).

```typescript
try {
  // operação que pode falhar
} catch (error) {
  return ApiResponseHandler.internalError(reply, error);
}
```

#### `serviceUnavailable(reply, message?)`
Serviço indisponível (HTTP 503).

```typescript
return ApiResponseHandler.serviceUnavailable(reply, 'Banco de dados indisponível');
```

#### `custom(reply, success, code, message, data?, error?)`
Resposta customizada.

```typescript
return ApiResponseHandler.custom(reply, false, 422, 'Erro de validação', validationErrors);
```

## Exemplos de Uso em Controllers

### Controller de Autenticação

```typescript
import { ApiResponseHandler } from '../../lib/response/index.js';

export default async function authController(fastify: FastifyInstance) {
  // Registro
  fastify.post('/register', async (request, reply) => {
    try {
      const user = await createUser(request.body);
      return ApiResponseHandler.created(reply, 'Usuário registrado', {
        user: user,
        token: generateToken(user)
      });
    } catch (error) {
      if (error.message.includes('já cadastrado')) {
        return ApiResponseHandler.conflict(reply, error.message);
      }
      return ApiResponseHandler.internalError(reply, error);
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return ApiResponseHandler.validationError(reply, 'Email e senha são obrigatórios');
      }

      const user = await authenticateUser(email, password);
      if (!user) {
        return ApiResponseHandler.authError(reply, 'Credenciais inválidas');
      }

      return ApiResponseHandler.success(reply, 'Login realizado', {
        user: user,
        token: generateToken(user)
      });
    } catch (error) {
      return ApiResponseHandler.internalError(reply, error);
    }
  });
}
```

### Controller com Paginação

```typescript
fastify.get('/users', async (request, reply) => {
  try {
    const { page = 1, limit = 10 } = request.query;
    const { users, total } = await getUsersPaginated(page, limit);

    return ApiResponseHandler.paginated(reply, users, total, page, limit);
  } catch (error) {
    return ApiResponseHandler.internalError(reply, error);
  }
});
```

## Benefícios

- ✅ **Consistência**: Todas as respostas seguem o mesmo formato
- ✅ **Manutenibilidade**: Centralização da lógica de resposta
- ✅ **Segurança**: Controle sobre exposição de erros sensíveis
- ✅ **Testabilidade**: Facilita testes automatizados
- ✅ **Documentação**: API mais previsível para consumidores
- ✅ **Logging**: Erros críticos são logados automaticamente

## Boas Práticas

1. **Use sempre a classe** em vez de `reply.send()` direto
2. **Trate erros adequadamente** com try/catch
3. **Forneça mensagens claras** para o usuário
4. **Evite expor detalhes internos** em produção
5. **Use códigos HTTP apropriados** para cada situação
6. **Log erros críticos** para monitoramento

## Integração com Middlewares

A classe pode ser integrada com middlewares para tratamento global de erros:

```typescript
// Middleware global de erro
fastify.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    return ApiResponseHandler.validationError(reply, 'Dados inválidos', error.validation);
  }

  return ApiResponseHandler.internalError(reply, error);
});
```