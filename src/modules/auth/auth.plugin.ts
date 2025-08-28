
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { JwtStrategy } from './strategy.js';
import { AuthenticateCommand } from './command.js';

export default fp(async (fastify: FastifyInstance) => {
  const SECRET = fastify.config.JWT_SECRET;
  const jwtStrategy = new JwtStrategy(SECRET);
  const authCommand = new AuthenticateCommand(jwtStrategy);

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await authCommand.execute(request, reply);
    if (!user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    request.authenticatedUser = user;
  });
});
