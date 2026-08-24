import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import { activateRoute } from './routes/activate.js';
import { validateRoute } from './routes/validate.js';
import { adminRoutes } from './admin/routes.js';

dotenv.config();

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
});

async function start(): Promise<void> {
  // Register plugins
  await server.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
  });

  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // Register routes
  await server.register(activateRoute, { prefix: '/api/v1' });
  await server.register(validateRoute, { prefix: '/api/v1' });
  await server.register(adminRoutes, { prefix: '/admin' });

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Start server
  const port = parseInt(process.env.API_PORT || '3000', 10);
  const host = process.env.API_HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    server.log.info(`Licensing API server listening on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (): Promise<void> => {
  server.log.info('Shutting down gracefully...');
  await server.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default server;
