import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { licenses } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Validation request schema
 */
const validateRequestSchema = z.object({
  key: z.string().min(1, 'License key is required'),
  hwid: z.string().optional(),
});

/**
 * POST /api/v1/validate
 * Validates a license key (optionally with HWID check)
 */
export const validateRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/validate', async (request, reply) => {
    try {
      const body = validateRequestSchema.parse(request.body);

      // TODO: Implement validation logic
      // 1. Find license by key
      // 2. Check if license is active
      // 3. Check if HWID matches (if provided)
      // 4. Check if license is not expired
      // 5. Return validation result

      const license = await db.query.licenses.findFirst({
        where: eq(licenses.key, body.key),
      });

      if (!license) {
        return reply.status(404).send({
          valid: false,
          error: 'LICENSE_NOT_FOUND',
          message: 'License key not found',
        });
      }

      if (license.status !== 'active') {
        return reply.status(403).send({
          valid: false,
          error: 'LICENSE_NOT_ACTIVE',
          message: `License status: ${license.status}`,
        });
      }

      if (body.hwid && license.hwid && license.hwid !== body.hwid) {
        return reply.status(403).send({
          valid: false,
          error: 'HWID_MISMATCH',
          message: 'Hardware ID does not match',
        });
      }

      if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
        return reply.status(403).send({
          valid: false,
          error: 'LICENSE_EXPIRED',
          message: 'License has expired',
        });
      }

      return reply.status(200).send({
        valid: true,
        license: {
          id: license.id,
          status: license.status,
          expiresAt: license.expiresAt?.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          valid: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: error.errors,
        });
      }

      fastify.log.error(error);
      return reply.status(500).send({
        valid: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  });
};
