import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './repository/index.js';
import { SecurityValidators } from '../../entities/user/index.js';

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
  fastify.post('/register', async (request, reply) => {
    try {
      const { name, email, password } = request.body as RegisterRequest;

      // Validações básicas de entrada
      if (!name || !email || !password) {
        return reply.code(400).send({ error: 'Nome, email e senha são obrigatórios' });
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
        return reply.code(400).send({ error: 'Dados inválidos detectados' });
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

      return reply.code(201).send({
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
      return reply.code(400).send({ error: message });
    }
  });

  // Login route
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = request.body as LoginRequest;

      // Validações básicas
      if (!email || !password) {
        return reply.code(400).send({ error: 'Email e senha são obrigatórios' });
      }

      // Sanitiza email
      const sanitizedEmail = SecurityValidators.sanitizeInput(email).toLowerCase();

      // Busca usuário com senha (para comparação)
      const user = await authRepository.findByEmailWithPassword(sanitizedEmail);

      if (!user) {
        return reply.code(401).send({ error: 'Credenciais inválidas' });
      }

      // Verifica se usuário está ativo
      if (user.status !== 'active') {
        return reply.code(401).send({ error: 'Conta desativada' });
      }

      // TODO: Comparar senha hasheada (implementar no service)
      // Por enquanto, comparação simples (NÃO usar em produção)
      if (password !== user.password) {
        return reply.code(401).send({ error: 'Credenciais inválidas' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user._id, name: user.name, role: user.role },
        fastify.config.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return reply.send({
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
      return reply.code(500).send({ error: 'Erro interno do servidor' });
    }
  });

  // Protected route example
  fastify.get('/me', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      // Verifica se usuário está autenticado
      if (!request.authenticatedUser) {
        return reply.code(401).send({ error: 'Usuário não autenticado' });
      }

      // Busca dados atualizados do usuário
      const user = await authRepository.findById(request.authenticatedUser.id.toString());

      if (!user) {
        return reply.code(404).send({ error: 'Usuário não encontrado' });
      }

      return reply.send({
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
      return reply.code(500).send({ error: 'Erro interno do servidor' });
    }
  });
};
