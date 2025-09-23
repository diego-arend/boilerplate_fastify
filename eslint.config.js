import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    rules: {
      // Code quality
      'no-console': 'off',
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'arrow-spacing': 'error',
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'eol-last': 'error',
      'no-trailing-spaces': 'error',
      
      // Best practices
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'multi-line'],
      'no-eval': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-shadow': 'error',
      'prefer-arrow-callback': 'error'
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        NodeJS: 'readonly'
      }
    },
    rules: {
      // TypeScript-compatible rules
      'no-console': 'off',
      'no-debugger': 'error', 
      'no-var': 'error',
      'prefer-const': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'arrow-spacing': 'error',
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'eol-last': 'error',
      'no-trailing-spaces': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'multi-line'],
      'no-eval': 'error',
      'no-unused-vars': 'off', // Disabled for TS files - TypeScript handles this
      'prefer-arrow-callback': 'error'
    }
  },
  {
    ignores: [
      'dist/**/*',
      'build/**/*',
      'node_modules/**/*',
      'coverage/**/*',
      '*.min.js',
      '.env*',
      'eslint.config.js'
    ]
  }
];