import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// Mock user database - in real app, this would be a proper database
const users: Array<{ id: number; name: string; email: string; password: string; role: string }> = [];

export default async function authController(fastify: FastifyInstance) {

  // Register route
  fastify.post('/register', async (request, reply) => {
    const { name, email, password } = request.body as RegisterRequest;

    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return reply.code(400).send({ error: 'User already exists' });
    }

    // Create new user
    const newUser = {
      id: users.length + 1,
      name,
      email,
      password, // In real app, hash the password
      role: 'user'
    };
    users.push(newUser);

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, role: newUser.role },
      fastify.config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return reply.code(201).send({
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      token
    });
  });

  // Login route
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as LoginRequest;

    // Find user
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      fastify.config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return reply.send({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token
    });
  });

  // Protected route example
  fastify.get('/me', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    return reply.send({ user: request.authenticatedUser });
  });
};
