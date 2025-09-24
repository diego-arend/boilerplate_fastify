# Email Templates System

Sistema modular de templates de email para jobs de envio de email.

## Estrutura

```
src/lib/templates/
├── types.ts                    # Interface base e tipos
├── welcome.ts                  # Template de boas-vindas
├── registrationSuccess.ts      # Template de registro bem-sucedido
├── passwordReset.ts           # Template de reset de senha
├── orderConfirmation.ts       # Template de confirmação de pedido
├── invoice.ts                 # Template de fatura
├── newsletter.ts              # Template de newsletter
├── systemAlert.ts             # Template de alerta do sistema
├── custom.ts                  # Template customizado
├── index.ts                   # Exportações e factory
└── README.md                  # Esta documentação
```

## Classes Base

### BaseTemplate

Classe abstrata que define a interface comum para todos os templates:

```typescript
abstract class BaseTemplate<T extends Record<string, any>> {
  abstract getRequiredVariables(): string[];
  abstract render(variables: T): TemplateResult;
  protected validateVariables(variables: T): void;
}
```

### TemplateResult

Interface que define o resultado da renderização:

```typescript
interface TemplateResult {
  html: string; // Conteúdo HTML
  text: string; // Conteúdo texto simples
  subject: string; // Assunto do email
}
```

## Templates Disponíveis

### 1. WelcomeTemplate

Template de boas-vindas com conteúdo em inglês.

**Variáveis obrigatórias:**

- `userName`: Nome do usuário
- `companyName`: Nome da empresa
- `loginLink`: Link para login

### 2. RegistrationSuccessTemplate

Template de confirmação de registro com conteúdo em português.

**Variáveis obrigatórias:**

- `userName`: Nome do usuário
- `companyName`: Nome da empresa
- `loginLink`: Link para fazer login

### 3. PasswordResetTemplate

Template para reset de senha.

**Variáveis obrigatórias:**

- `userName`: Nome do usuário
- `resetLink`: Link para reset
- `expiresIn`: Tempo de expiração

### 4. OrderConfirmationTemplate

Template de confirmação de pedido.

**Variáveis obrigatórias:**

- `userName`: Nome do usuário
- `orderNumber`: Número do pedido
- `orderDate`: Data do pedido
- `items`: Array de itens do pedido
- `subtotal`: Subtotal
- `tax`: Taxa/imposto
- `total`: Total
- `shippingAddress`: Endereço de entrega

### 5. InvoiceTemplate

Template de fatura/cobrança.

**Variáveis obrigatórias:**

- `customerName`: Nome do cliente
- `invoiceNumber`: Número da fatura
- `invoiceDate`: Data da fatura
- `dueDate`: Data de vencimento
- `items`: Array de itens
- `subtotal`: Subtotal
- `tax`: Taxa/imposto
- `total`: Total

**Variáveis opcionais:**

- `paymentLink`: Link para pagamento

### 6. NewsletterTemplate

Template para newsletters.

**Variáveis obrigatórias:**

- `subscriberName`: Nome do assinante
- `newsletterTitle`: Título da newsletter
- `edition`: Edição
- `date`: Data
- `articles`: Array de artigos
- `unsubscribeLink`: Link para descadastro

### 7. SystemAlertTemplate

Template para alertas do sistema.

**Variáveis obrigatórias:**

- `alertTitle`: Título do alerta
- `alertMessage`: Mensagem do alerta
- `severity`: Nível de severidade (low, medium, high, critical)
- `timestamp`: Timestamp do alerta
- `systemName`: Nome do sistema

**Variáveis opcionais:**

- `actionRequired`: Ação necessária
- `contactInfo`: Informações de contato

### 8. CustomTemplate

Template customizado para conteúdo livre.

**Variáveis obrigatórias:**

- `subject`: Assunto do email
- `htmlContent`: Conteúdo HTML
- `textContent`: Conteúdo em texto

**Recursos especiais:**

- Suporte a variáveis dinâmicas no formato `{{variableName}}`
- Wrapper HTML automático se não houver estrutura HTML completa

## Uso

### Importação

```typescript
import {
  WelcomeTemplate,
  RegistrationSuccessTemplate,
  createTemplate,
  AvailableTemplates
} from '../lib/templates/index.js';
```

### Uso Direto

```typescript
const template = new WelcomeTemplate();
const result = template.render({
  userName: 'João',
  companyName: 'Minha Empresa',
  loginLink: 'https://example.com/login'
});

console.log(result.subject); // Assunto
console.log(result.html); // HTML
console.log(result.text); // Texto
```

### Uso com Factory

```typescript
const template = createTemplate('welcome');
if (template) {
  const result = template.render({
    userName: 'João',
    companyName: 'Minha Empresa',
    loginLink: 'https://example.com/login'
  });
}
```

### Uso com Enum

```typescript
import { TEMPLATE_REGISTRY, AvailableTemplates } from '../lib/templates/index.js';

const TemplateClass = TEMPLATE_REGISTRY[AvailableTemplates.WELCOME];
const template = new TemplateClass();
```

## Integração com EmailSend Job

Os templates foram projetados para se integrar com o sistema de jobs de email:

```typescript
// No emailSend.job.ts
import { createTemplate } from '../../lib/templates/index.js';

const template = createTemplate(templateType);
if (template) {
  const result = template.render(templateVariables);
  // Usar result.html, result.text, result.subject
}
```

## Validação

Todos os templates validam automaticamente se as variáveis obrigatórias foram fornecidas. Se alguma variável estiver ausente, será lançado um erro:

```typescript
// Erro será lançado se userName não for fornecido
const template = new WelcomeTemplate();
template.render({}); // Error: Missing required variables: userName, companyName, loginLink
```

## Extensão

Para criar novos templates:

1. Criar nova classe que estenda `BaseTemplate<T>`
2. Implementar `getRequiredVariables()` e `render()`
3. Adicionar ao `index.ts`
4. Atualizar `AvailableTemplates` enum
5. Atualizar `TEMPLATE_REGISTRY`

```typescript
export class MyCustomTemplate extends BaseTemplate<MyVariables> {
  getRequiredVariables(): string[] {
    return ['requiredVar1', 'requiredVar2'];
  }

  render(variables: MyVariables): TemplateResult {
    this.validateVariables(variables);

    return {
      html: `<p>Hello ${variables.requiredVar1}</p>`,
      text: `Hello ${variables.requiredVar1}`,
      subject: 'My Custom Email'
    };
  }
}
```

## Suporte a Idiomas

Atualmente temos:

- **Português**: RegistrationSuccessTemplate
- **Inglês**: Demais templates

Para adicionar mais idiomas, crie variações dos templates existentes ou adicione lógica de internacionalização dentro dos templates.
