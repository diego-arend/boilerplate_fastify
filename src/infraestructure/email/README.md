# Email Infrastructure Documentation

Este documento descreve o sistema de email integrado ao boilerplate Fastify, incluindo configuração, uso e exemplos práticos.

## 📧 Visão Geral

O sistema de email utiliza **Nodemailer** para envio de emails através de **configuração SMTP pura**, integrado com o sistema de jobs em background para processamento assíncrono e confiável.

## 🏗️ Arquitetura

```
src/infraestructure/email/
├── email.plugin.ts      # Plugin principal do Fastify
├── index.ts            # Exportações do módulo
├── templates/          # Sistema de templates
│   ├── types.ts       # Interfaces base
│   ├── welcome.ts     # Template de boas-vindas
│   ├── passwordReset.ts # Template de reset de senha
│   └── ...           # Outros templates
└── README.md           # Esta documentação

src/infraestructure/queue/jobs/business/
└── emailSend.job.ts    # Job handler para envio de emails
```

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env`:

```bash
# Configuração SMTP (obrigatória em produção)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@example.com

# Configurações opcionais para alta performance
EMAIL_POOL=true
EMAIL_MAX_CONNECTIONS=5
EMAIL_MAX_MESSAGES=100
```

**Exemplos de provedores SMTP populares:**

```bash
# Gmail (requer App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false

# Outlook/Hotmail
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false

# Yahoo Mail
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false

# SendGrid
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key

# Mailgun
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
```

### 2. Validação de Ambiente

O sistema valida automaticamente as variáveis de ambiente junto com outras configurações:

- **Todas as situações**: Configuração SMTP é obrigatória quando qualquer variável SMTP for definida
- **Configuração requerida**: Se qualquer variável SMTP for definida, todas as obrigatórias devem estar presentes:
  - `SMTP_HOST` - Servidor SMTP
  - `SMTP_USER` - Usuário de autenticação
  - `SMTP_PASS` - Senha de autenticação
  - `EMAIL_FROM` - Email remetente (validado formato)

### 3. Modo Desenvolvimento

**⚠️ Importante**: A partir desta versão, não há mais pré-configuração automática com Ethereal Email. O sistema **sempre requer configuração SMTP válida** para funcionar, tanto em desenvolvimento quanto em produção.## 🚀 Uso Básico

### 1. Envio Direto via Service

```typescript
// Em um controller ou service
async function sendWelcomeEmail(fastify: FastifyInstance, userEmail: string, userName: string) {
  try {
    const result = await fastify.emailService.sendMail({
      to: userEmail,
      subject: 'Bem-vindo!',
      html: `<h1>Olá, ${userName}!</h1><p>Bem-vindo ao nosso sistema!</p>`,
      text: `Olá, ${userName}! Bem-vindo ao nosso sistema!`
    });

    console.log('Email enviado:', result.messageId);
  } catch (error) {
    console.error('Erro ao enviar email:', error);
  }
}
```

### 2. Envio via Job Queue (Recomendado)

```typescript
import { QueueManager } from './infraestructure/queue/queue.manager.js';
import {
  EmailJobData,
  EmailTemplate
} from './infraestructure/queue/jobs/business/emailSend.job.js';

// Agendar envio de email
async function scheduleWelcomeEmail(
  queueManager: QueueManager,
  userEmail: string,
  userName: string
) {
  const emailData: EmailJobData = {
    to: userEmail,
    subject: 'Bem-vindo ao Sistema!',
    template: EmailTemplate.WELCOME,
    variables: {
      userName,
      loginUrl: 'https://app.example.com/login'
    },
    priority: 'high',
    trackOpens: true
  };

  await queueManager.addJob('email-send', emailData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
}
```

## 📝 Templates Disponíveis

O sistema inclui templates pré-construídos para casos comuns:

### Templates Incluídos

1. **WELCOME** - Boas-vindas

   ```typescript
   {
     template: EmailTemplate.WELCOME,
     variables: { userName: 'João', loginUrl: 'https://app.com/login' }
   }
   ```

2. **REGISTRATION_SUCCESS** - Cadastro realizado

   ```typescript
   {
     template: EmailTemplate.REGISTRATION_SUCCESS,
     variables: { userName: 'João', activationUrl: 'https://app.com/activate/token' }
   }
   ```

3. **PASSWORD_RESET** - Reset de senha

   ```typescript
   {
     template: EmailTemplate.PASSWORD_RESET,
     variables: { userName: 'João', resetUrl: 'https://app.com/reset/token' }
   }
   ```

4. **ORDER_CONFIRMATION** - Confirmação de pedido

   ```typescript
   {
     template: EmailTemplate.ORDER_CONFIRMATION,
     variables: { orderNumber: '12345', total: 'R$ 99,90', items: [...] }
   }
   ```

5. **INVOICE** - Fatura

   ```typescript
   {
     template: EmailTemplate.INVOICE,
     variables: { invoiceNumber: 'INV-001', amount: 'R$ 150,00', dueDate: '2025-01-30' }
   }
   ```

6. **NEWSLETTER** - Newsletter

   ```typescript
   {
     template: EmailTemplate.NEWSLETTER,
     variables: { title: 'Novidades', content: '...', unsubscribeUrl: '...' }
   }
   ```

7. **SYSTEM_ALERT** - Alerta do sistema

   ```typescript
   {
     template: EmailTemplate.SYSTEM_ALERT,
     variables: { alertType: 'warning', message: 'Sistema em manutenção', severity: 'high' }
   }
   ```

8. **CUSTOM** - Template personalizado
   ```typescript
   {
     template: EmailTemplate.CUSTOM,
     subject: 'Assunto customizado',
     customHtml: '<h1>Seu HTML aqui</h1>',
     customText: 'Versão texto aqui'
   }
   ```

## 🔧 Funcionalidades Avançadas

### 1. Anexos

```typescript
const emailData: EmailJobData = {
  to: 'user@example.com',
  subject: 'Documento anexo',
  template: EmailTemplate.CUSTOM,
  customHtml: '<p>Segue documento em anexo.</p>',
  attachments: [
    {
      filename: 'documento.pdf',
      path: '/path/to/documento.pdf',
      contentType: 'application/pdf'
    },
    {
      filename: 'imagem.png',
      content: Buffer.from('...'), // Buffer da imagem
      contentType: 'image/png'
    }
  ]
};
```

### 2. Cópia e Cópia Oculta

```typescript
const emailData: EmailJobData = {
  to: 'destinatario@example.com',
  cc: ['copia@example.com', 'outra-copia@example.com'],
  bcc: 'copia-oculta@example.com',
  subject: 'Email com cópias',
  template: EmailTemplate.CUSTOM,
  customHtml: '<p>Email com múltiplos destinatários</p>'
};
```

### 3. Prioridade e Agendamento

```typescript
const emailData: EmailJobData = {
  to: 'user@example.com',
  subject: 'Email urgente',
  template: EmailTemplate.SYSTEM_ALERT,
  variables: { message: 'Ação necessária imediatamente' },
  priority: 'high',
  sendAt: new Date(Date.now() + 3600000), // Enviar em 1 hora
  timezone: 'America/Sao_Paulo'
};
```

### 4. Rastreamento

```typescript
const emailData: EmailJobData = {
  to: 'user@example.com',
  subject: 'Email com rastreamento',
  template: EmailTemplate.NEWSLETTER,
  variables: { title: 'Newsletter Semanal' },
  trackOpens: true,
  trackClicks: true,
  campaignId: 'newsletter-2025-01'
};
```

## 🧪 Testes

### 1. Configuração de Teste

Para testes, configure um servidor SMTP de teste como Mailtrap, MailHog ou similar:

```bash
# Exemplo com Mailtrap
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
EMAIL_FROM=test@example.com
```

### 2. Teste Manual

```typescript
// Em um endpoint de teste - REQUER configuração SMTP válida
fastify.get('/test-email', async (request, reply) => {
  try {
    const result = await fastify.emailService.sendMail({
      to: 'test@example.com',
      subject: 'Email de Teste',
      html: '<h1>Teste do Sistema de Email</h1>',
      text: 'Teste do Sistema de Email'
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

## 🔒 Segurança

### 1. Configuração SMTP Segura

Para máxima segurança em produção:

```bash
# Use sempre conexões seguras quando possível
SMTP_SECURE=true          # Para porta 465
# ou
SMTP_SECURE=false         # Para porta 587 com STARTTLS
```

### 2. Credenciais SMTP

- **Gmail**: Use App Passwords (senhas de aplicativo)
- **Outros provedores**: Use credenciais específicas para aplicação
- **Servidores próprios**: Configure autenticação forte

### 3. Validação de Emails

O sistema valida automaticamente:

- Formato de email válido no `EMAIL_FROM`
- Múltiplos destinatários
- Tamanho de anexos (máx. 25MB total)
- Número de anexos (máx. 10 por email)

### 4. Validação de Ambiente

A validação SMTP é integrada ao sistema principal:

- **Produção**: Falha na inicialização se SMTP incompleto
- **Desenvolvimento**: Logs informativos sobre configuração
- **Ambiente misto**: Configuração opcional mas consistente

### 5. Rate Limiting

Controle de taxa configurável:

```bash
EMAIL_MAX_MESSAGES=100    # Máx. 100 emails por conexão
EMAIL_MAX_CONNECTIONS=5   # Máx. 5 conexões simultâneas
```

## 🐛 Troubleshooting

### Problemas Comuns

1. **"Connection timeout"**

   ```bash
   # Verifique porta e configuração TLS
   SMTP_PORT=587
   SMTP_SECURE=false
   ```

2. **"Authentication failed"**

   ```bash
   # Verifique credenciais SMTP
   SMTP_USER=your-username
   SMTP_PASS=your-secure-password
   ```

3. **"SMTP configuration required"**

   ```bash
   # O sistema agora sempre requer configuração SMTP
   SMTP_HOST=smtp.example.com
   SMTP_USER=username
   SMTP_PASS=password
   EMAIL_FROM=noreply@example.com
   ```

4. **"Too many connections"**
   ```bash
   # Reduza o pool de conexões
   EMAIL_MAX_CONNECTIONS=1
   EMAIL_POOL=false
   ```

### Logs Úteis

O sistema gera logs detalhados:

````
[INFO] Email transporter connection verified
[INFO] Sending email to 1 recipients
[INFO] Email sent successfully: messageId=<xxx@smtp.example.com>
[ERROR] Email sending failed: Authentication failed
[ERROR] SMTP configuration required: Missing SMTP_HOST
```## 🔗 Integração com Worker

O sistema está totalmente integrado com o worker de background jobs:

```bash
# Worker processará jobs de email automaticamente
pnpm run worker:dev
````

Os jobs de email são processados com:

- ✅ Retry automático (3 tentativas por padrão)
- ✅ Dead Letter Queue para falhas permanentes
- ✅ Logs detalhados de processamento
- ✅ Estatísticas de performance

## 📊 Monitoramento

### Métricas Disponíveis

- Emails enviados com sucesso
- Emails falhados
- Tempo de processamento
- Taxa de rejeição por provedor
- Performance de templates

### Logs Estruturados

```json
{
  "level": "info",
  "time": "2025-01-25T10:30:00.000Z",
  "component": "email-service",
  "messageId": "<xxx@smtp.example.com>",
  "accepted": 1,
  "rejected": 0,
  "processingTime": 1250,
  "msg": "Email sent successfully"
}
```

---

## 🎯 Próximos Passos

1. **Configure suas variáveis de ambiente SMTP** no arquivo `.env` (obrigatório)
2. **Teste o sistema** com servidor SMTP válido
3. **Customize os templates** conforme sua necessidade
4. **Configure um servidor SMTP** confiável para produção
5. **Monitore os logs** para otimização e troubleshooting

**⚠️ Importante**: Configuração SMTP é sempre obrigatória. Para testes, use serviços como Mailtrap, MailHog ou configure um servidor SMTP de desenvolvimento.

Para dúvidas ou problemas, consulte os logs da aplicação ou verifique a configuração das variáveis de ambiente SMTP.
