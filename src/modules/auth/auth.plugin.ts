import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { JwtStrategy } from "./strategy.js";
import { AuthenticateCommand } from "./command.js";
import authController from "./auth.controller.js";

export default async function (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
) {
  const SECRET = fastify.config.JWT_SECRET;
  const jwtStrategy = new JwtStrategy(SECRET);
  const authCommand = new AuthenticateCommand(jwtStrategy);

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await authCommand.execute(request, reply);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      request.authenticatedUser = user;
    }
  );

  // Register auth routes
  await authController(fastify);
}
