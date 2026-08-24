import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { licenses } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { basicAuthMiddleware } from './auth.js';

/**
 * Admin routes for license management
 * All routes require HTTP Basic Auth
 */
export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply Basic Auth middleware to all admin routes
  fastify.addHook('onRequest', basicAuthMiddleware);

  /**
   * GET /admin/licenses
   * List all licenses
   */
  fastify.get('/licenses', async (_request, reply) => {
    try {
      const allLicenses = await db.query.licenses.findMany();
      return { licenses: allLicenses, count: allLicenses.length };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch licenses',
      });
    }
  });

  /**
   * GET /admin/licenses/:id
   * Get a specific license by ID
   */
  fastify.get<{ Params: { id: string } }>('/licenses/:id', async (request, reply) => {
    try {
      const license = await db.query.licenses.findFirst({
        where: eq(licenses.id, request.params.id),
      });

      if (!license) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'License not found',
        });
      }

      return { license };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch license',
      });
    }
  });

  /**
   * POST /admin/licenses
   * Create a new license
   * TODO: Implement license creation logic
   */
  fastify.post('/licenses', async (_request, reply) => {
    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'License creation not yet implemented',
    });
  });

  /**
   * PATCH /admin/licenses/:id
   * Update a license (e.g., revoke, extend)
   * TODO: Implement license update logic
   */
  fastify.patch<{ Params: { id: string } }>('/licenses/:id', async (_request, reply) => {
    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'License update not yet implemented',
    });
  });

  /**
   * DELETE /admin/licenses/:id
   * Delete a license
   * TODO: Implement license deletion logic
   */
  fastify.delete<{ Params: { id: string } }>('/licenses/:id', async (_request, reply) => {
    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'License deletion not yet implemented',
    });
  });
};
