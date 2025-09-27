# ESLint Configuration

## Overview

ESLint configurado com **flat config format** para garantir qualidade de código consistente no projeto Fastify + TypeScript.

## Features

- **Flat Config Format**: Configuração moderna do ESLint 9.x
- **TypeScript Support**: Parser dedicado para arquivos `.ts`
- **Code Quality**: Regras de formatação, style guide e best practices
- **Project Integration**: Scripts integrados no package.json

## Configuration Structure

```javascript
// eslint.config.js
export default [
  // JavaScript files configuration
  {
    files: ['**/*.js'],
    languageOptions: { /* Node.js globals */ },
    rules: { /* Base rules */ }
  },
  
  // TypeScript files configuration  
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: '@typescript-eslint/parser'
    },
    rules: { /* TypeScript-compatible rules */ }
  },
  
  // Ignored files
  {
    ignores: ['dist/**/*', 'node_modules/**/*', ...]
  }
];
```

## Rules Overview

### **Code Quality**
- `no-console`: 'off' (permitido para logs de backend)
- `no-debugger`: 'error'
- `no-var`: 'error' 
- `prefer-const`: 'error'

### **Formatting**
- `semi`: ['error', 'always'] (ponto e vírgula obrigatório)
- `quotes`: ['error', 'single'] (aspas simples)
- `indent`: ['error', 2] (indentação 2 espaços)
- `comma-dangle`: ['error', 'never'] (sem vírgula no final)

### **Best Practices**
- `eqeqeq`: ['error', 'always'] (=== ao invés de ==)
- `curly`: ['error', 'multi-line'] (chaves em statements)
- `no-eval`: 'error'
- `prefer-arrow-callback`: 'error'

### **TypeScript Specific**
- `no-unused-vars`: 'off' (desabilitado para TS)
- Parser automático para sintaxe TypeScript
- Suporte completo a interfaces, types, generics

## Scripts Available

```bash
# Verificar problemas (sem correções)
pnpm lint:check

# Corrigir problemas automaticamente
pnpm lint:fix  

# Apenas executar linting
pnpm lint
```

## Ignored Files

- `dist/**/*` - Build output
- `build/**/*` - Build artifacts  
- `node_modules/**/*` - Dependencies
- `coverage/**/*` - Test coverage
- `*.min.js` - Minified files
- `.env*` - Environment files
- `eslint.config.js` - Own config file

## Integration

### **VS Code**
O ESLint integra automaticamente com VS Code através da extensão oficial:
- Realce de problemas em tempo real
- Correções automáticas com `Ctrl+Shift+P` → "Fix all auto-fixable problems"
- Format on save configurável

### **Pre-commit Hooks**
Pode ser integrado com husky para validação antes de commits:
```bash
pnpm lint:check
```

### **CI/CD**
Adicione ao pipeline de CI para validação automática:
```yaml
- run: pnpm lint:check
```

## Dependencies

```json
{
  "devDependencies": {
    "eslint": "^9.36.0",
    "@eslint/js": "^9.36.0", 
    "@typescript-eslint/parser": "^8.15.0",
    "@typescript-eslint/eslint-plugin": "^8.15.0"
  }
}
```

## Troubleshooting

### **Parsing Errors**
Se houver erros de parsing em arquivos TypeScript:
- Verificar se `@typescript-eslint/parser` está instalado
- Confirmar que `tsconfig.json` está válido

### **Rules Conflicts**  
Para regras conflitantes entre JS e TS:
- Regras JS são desabilitadas em arquivos TS quando necessário
- `no-unused-vars` desabilitado para TS (TypeScript já valida)

### **Performance**
Para projetos grandes:
- Usar `--cache` para melhor performance
- Considerar `--ext .ts,.js` para arquivos específicos

## Best Practices

1. **Execute linting antes de commits**
2. **Configure seu editor para mostrar erros em tempo real**  
3. **Use `pnpm lint:fix` regularmente**
4. **Mantenha regras consistentes entre equipe**
5. **Documente exceções quando necessário**

---

**Configuração alinhada com as melhores práticas do projeto Fastify + TypeScript.**