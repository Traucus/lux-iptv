import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { licenses } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Activation request schema
 */
const activateRequestSchema = z.object({
  key: z.string().min(1, 'License key is required'),
  hwid: z.string().min(1, 'Hardware ID is required'),
});

/**
 * POST /api/v1/activate
 * Activates a license key with a hardware ID
 */
export const activateRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/activate', async (request, reply) => {
    try {
      const body = activateRequestSchema.parse(request.body);

      // TODO: Implement activation logic
      // 1. Find license by key
      // 2. Check if license is valid (not expired, not revoked)
      // 3. Check if HWID matches or bind HWID if first activation
      // 4. Update license status to 'active'
      // 5. Return activation confirmation

      const license = await db.query.licenses.findFirst({
        where: eq(licenses.key, body.key),
      });

      if (!license) {
        return reply.status(404).send({
          error: 'LICENSE_NOT_FOUND',
          message: 'License key not found',
        });
      }

      if (license.status === 'revoked') {
        return reply.status(403).send({
          error: 'LICENSE_REVOKED',
          message: 'This license has been revoked',
        });
      }

      if (license.status === 'expired' || (license.expiresAt && new Date(license.expiresAt) < new Date())) {
        return reply.status(403).send({
          error: 'LICENSE_EXPIRED',
          message: 'This license has expired',
        });
      }

      // TODO: Complete activation logic
      return reply.status(501).send({
        error: 'NOT_IMPLEMENTED',
        message: 'Activation logic not yet implemented',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: error.errors,
        });
      }

      fastify.log.error(error);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  });
};
