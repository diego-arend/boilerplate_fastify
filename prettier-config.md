# Prettier Configuration

## Overview

Prettier configurado para formatação automática e consistente de código no projeto **Fastify + TypeScript**.

## Features

- **Formatação Automática**: Consistency de código em todo o projeto
- **Integração ESLint**: Sem conflitos entre linting e formatação
- **VS Code Integration**: Format-on-save e correções automáticas
- **Multiple File Types**: TypeScript, JavaScript, JSON, Markdown

## Configuration

### **Prettier Rules** (`.prettierrc`)

```json
{
  "semi": true, // Sempre usar ponto e vírgula
  "trailingComma": "none", // Sem vírgula no final
  "singleQuote": true, // Aspas simples
  "printWidth": 100, // Quebra de linha em 100 caracteres
  "tabWidth": 2, // Indentação com 2 espaços
  "useTabs": false, // Usar espaços ao invés de tabs
  "bracketSpacing": true, // Espaços em { objeto }
  "bracketSameLine": false, // > em linha separada
  "arrowParens": "avoid", // Parênteses apenas quando necessário
  "endOfLine": "lf", // Line ending Unix (LF)
  "quoteProps": "as-needed" // Quotes em propriedades apenas quando necessário
}
```

### **Ignored Files** (`.prettierignore`)

- `dist/`, `build/`, `coverage/` - Build outputs
- `node_modules/` - Dependencies
- `.env*` - Environment files
- `*.min.js`, `*.min.css` - Minified files
- `pnpm-lock.yaml`, `package-lock.json` - Lock files
- `Dockerfile*`, `docker-compose*.yml` - Docker files

## Scripts Available

### **Formatting Scripts**

```bash
# Formatar arquivos do projeto
pnpm format

# Verificar formatação (sem alterar arquivos)
pnpm format:check

# Formatar todos os arquivos do projeto (incluindo config)
pnpm format:all
```

### **Combined Scripts**

```bash
# Verificar formatação + linting
pnpm code:check

# Corrigir formatação + linting automaticamente
pnpm code:fix
```

## ESLint Integration

### **Plugins Instalados**

- `eslint-config-prettier` - Desabilita regras conflitantes
- `eslint-plugin-prettier` - Executa Prettier como regra ESLint

### **Configuration in ESLint**

```javascript
// eslint.config.js
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'error' // Tratar diferenças como erro
    }
  }
];
```

## VS Code Integration

### **Settings** (`.vscode/settings.json`)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "prettier.configPath": ".prettierrc"
}
```

### **Required Extensions**

- `esbenp.prettier-vscode` - Prettier formatter
- `dbaeumer.vscode-eslint` - ESLint integration

## Workflow Integration

### **Pre-commit Hooks**

```bash
# Exemplo com husky
pnpm code:check  # Verifica antes do commit
```

### **CI/CD Pipeline**

```yaml
- name: Check Code Quality
  run: |
    pnpm format:check
    pnpm lint:check
```

## File Types Supported

- **TypeScript**: `.ts`, `.tsx`
- **JavaScript**: `.js`, `.jsx`
- **JSON**: `.json`
- **Markdown**: `.md`
- **YAML**: `.yml`, `.yaml` (com format:all)

## Rules Explanation

### **Code Style**

- `printWidth: 100` - Quebra linhas longas para melhor legibilidade
- `singleQuote: true` - Consistência com ESLint
- `semi: true` - Sempre ponto e vírgula para clareza

### **Spacing & Indentation**

- `tabWidth: 2` - Indentação padrão do projeto
- `bracketSpacing: true` - `{ key: value }` ao invés de `{key: value}`
- `arrowParens: "avoid"` - `x => x` ao invés de `(x) => x`

### **Trailing Comma**

- `trailingComma: "none"` - Sem vírgula final (compatibilidade ESLint)

## Troubleshooting

### **Conflitos ESLint/Prettier**

Se houver conflitos:

1. Verificar se `eslint-config-prettier` está instalado
2. Confirmar que `...prettierConfig.rules` está no ESLint config
3. Executar `pnpm code:fix` para resolver automaticamente

### **Format on Save não funciona**

1. Instalar extensão `esbenp.prettier-vscode`
2. Verificar `.vscode/settings.json`
3. Confirmar que Prettier é o formatter padrão

### **Performance**

Para projetos grandes:

- Prettier já é rápido por padrão
- Usar `--cache` se necessário
- Considerar formatar apenas arquivos alterados

## Best Practices

1. **Execute `pnpm code:fix` antes de commits**
2. **Configure format-on-save no seu editor**
3. **Use `pnpm code:check` em pipelines CI/CD**
4. **Mantenha configuração simples e consistente**
5. **Documente exceções quando necessário**

## Example Workflow

```bash
# Durante desenvolvimento
pnpm dev  # Auto-format on save no VS Code

# Antes de commit
pnpm code:fix  # Formatar + corrigir ESLint

# Verificação final
pnpm code:check  # Garantir que está tudo correto
```

---

**Configuração alinhada com as melhores práticas do projeto Fastify + TypeScript + ESLint.**
