import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * HTTP Basic Auth middleware for admin routes
 * Credentials are read from environment variables
 */
export async function basicAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    reply.header('WWW-Authenticate', 'Basic realm="Admin Area"');
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  const base64Credentials = authHeader.substring(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword) {
    request.log.error('ADMIN_PASSWORD environment variable is not set');
    return reply.status(500).send({
      error: 'CONFIGURATION_ERROR',
      message: 'Server authentication is not configured',
    });
  }

  if (username !== expectedUsername || password !== expectedPassword) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid credentials',
    });
  }
}
