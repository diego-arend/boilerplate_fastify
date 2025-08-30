# Project Overview

Este projeto é uma API backend modular utilizando Fastify e TypeScript.

## Estrutura Básica do Projeto

- `/src/server.ts`: Ponto de entrada do servidor Fastify, responsável pela inicialização, configuração global e graceful shutdown.
- `/src/app.ts`: Plugin principal da aplicação, responsável por registrar os módulos de domínio (ex: auth, user, etc).
- `/src/fastify.config.ts`: Configurações do servidor Fastify (ex: logger, CORS, etc).
- `/src/lib/validateEnv.ts`: Validação e carregamento das variáveis de ambiente, exportando o objeto `config` global.
- `/src/modules/`: Diretório para módulos de domínio de negócio, cada um com seu próprio plugin e controlador.
- `/src/modules/auth/auth.plugin.ts`: Plugin do módulo de autenticação, registra controladores e hooks.
- `/src/modules/auth/auth.controller.ts`: Controlador do módulo de autenticação, define rotas como `/login` e `/register`.
- Outros módulos seguem o mesmo padrão.
- `/dist/`: Arquivos compilados pelo TypeScript.

## Padrões e Boas Práticas

- Modularização por domínio de negócio: cada regra de negócio implementada em um módulo separado.
- Plugins e controladores: cada módulo possui um plugin que registra seus controladores e middlewares.
- Tipagem estática com TypeScript em todo o projeto.
- Validação centralizada das variáveis de ambiente.
- Configuração global acessível via decorator `fastify.config`.
- Uso de hooks, middlewares e decorators para segurança e organização.

## MCPs disponíveis e contexto de uso

- **context7**: Utilizado para fornecer documentação e casos de uso sobre bibliotecas e frameworks de desenvolvimento de software, especialmente Fastify, TypeScript, EcmaScript, JavaScript e qualquer linguagem ou superset utilizado no projeto.
