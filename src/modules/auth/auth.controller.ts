import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './repository/index.js';
import { SecurityValidators } from '../../entities/user/index.js';
import { ApiResponseHandler } from '../../lib/response/index.js';

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// Instância do repositório de autenticação
const authRepository = new AuthRepository();

export default async function authController(fastify: FastifyInstance) {

  // Register route
  fastify.post('/register', {
    schema: {
      description: 'Registra um novo usuário no sistema',
      tags: ['Auth'],
      summary: 'Registrar Usuário',
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Usuário registrado com sucesso' },
            code: { type: 'number', example: 201 },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                    name: { type: 'string', example: 'João Silva' },
                    email: { type: 'string', example: 'joao@example.com' },
                    role: { type: 'string', example: 'user' },
                    status: { type: 'string', example: 'active' }
                  }
                },
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Nome, email e senha são obrigatórios' },
            code: { type: 'number', example: 400 },
            error: { type: 'string', example: 'VALIDATION_ERROR' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { name, email, password } = request.body as RegisterRequest;

      // Validações básicas de entrada
      if (!name || !email || !password) {
        return ApiResponseHandler.validationError(reply, 'Nome, email e senha são obrigatórios');
      }

      // Sanitiza os dados de entrada
      const sanitizedData = {
        name: SecurityValidators.sanitizeInput(name),
        email: SecurityValidators.sanitizeInput(email).toLowerCase(),
        password
      };

      // Validações de segurança
      if (SecurityValidators.hasInjectionAttempt(sanitizedData.name) ||
          SecurityValidators.hasInjectionAttempt(sanitizedData.email)) {
        return ApiResponseHandler.validationError(reply, 'Dados inválidos detectados');
      }

      // Cria o usuário usando o repositório
      const newUser = await authRepository.createUser({
        name: sanitizedData.name,
        email: sanitizedData.email,
        password: sanitizedData.password // Será hasheada no service posteriormente
      });

      // Generate JWT token
      const token = jwt.sign(
        { id: newUser._id, name: newUser.name, role: newUser.role },
        fastify.config.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return ApiResponseHandler.created(reply, 'Usuário registrado com sucesso', {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status
        },
        token
      });
    } catch (error) {
      console.error('Erro no registro:', error);
      const message = error instanceof Error ? error.message : 'Erro interno do servidor';
      return ApiResponseHandler.validationError(reply, message);
    }
  });

  // Login route
  fastify.post('/login', {
    schema: {
      description: 'Faz login do usuário e retorna token JWT',
      tags: ['Auth'],
      summary: 'Login do Usuário',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login realizado com sucesso' },
            code: { type: 'number', example: 200 },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                    name: { type: 'string', example: 'João Silva' },
                    email: { type: 'string', example: 'joao@example.com' },
                    role: { type: 'string', example: 'user' },
                    status: { type: 'string', example: 'active' }
                  }
                },
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Credenciais inválidas' },
            code: { type: 'number', example: 401 },
            error: { type: 'string', example: 'AUTHENTICATION_ERROR' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password } = request.body as LoginRequest;

      // Validações básicas
      if (!email || !password) {
        return ApiResponseHandler.validationError(reply, 'Email e senha são obrigatórios');
      }

      // Sanitiza email
      const sanitizedEmail = SecurityValidators.sanitizeInput(email).toLowerCase();

      // Busca usuário com senha (para comparação)
      const user = await authRepository.findByEmailWithPassword(sanitizedEmail);

      if (!user) {
        return ApiResponseHandler.authError(reply, 'Credenciais inválidas');
      }

      // Verifica se usuário está ativo
      if (user.status !== 'active') {
        return ApiResponseHandler.authError(reply, 'Conta desativada');
      }

      // TODO: Comparar senha hasheada (implementar no service)
      // Por enquanto, comparação simples (NÃO usar em produção)
      if (password !== user.password) {
        return ApiResponseHandler.authError(reply, 'Credenciais inválidas');
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user._id, name: user.name, role: user.role },
        fastify.config.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return ApiResponseHandler.success(reply, 'Login realizado com sucesso', {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        },
        token
      });
    } catch (error) {
      console.error('Erro no login:', error);
      return ApiResponseHandler.internalError(reply, error instanceof Error ? error : String(error));
    }
  });

  // Protected route example
  fastify.get('/me', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Retorna os dados do usuário autenticado',
      tags: ['Auth'],
      summary: 'Perfil do Usuário',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Dados do usuário retornados' },
            code: { type: 'number', example: 200 },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                    name: { type: 'string', example: 'João Silva' },
                    email: { type: 'string', example: 'joao@example.com' },
                    role: { type: 'string', example: 'user' },
                    status: { type: 'string', example: 'active' },
                    createdAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Usuário não autenticado' },
            code: { type: 'number', example: 401 },
            error: { type: 'string', example: 'AUTHENTICATION_ERROR' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Verifica se usuário está autenticado
      if (!request.authenticatedUser) {
        return ApiResponseHandler.authError(reply, 'Usuário não autenticado');
      }

      // Busca dados atualizados do usuário
      const user = await authRepository.findById(request.authenticatedUser.id.toString());

      if (!user) {
        return ApiResponseHandler.notFound(reply, 'Usuário não encontrado');
      }

      return ApiResponseHandler.success(reply, 'Dados do usuário retornados', {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return ApiResponseHandler.internalError(reply, error instanceof Error ? error : String(error));
    }
  });
};
