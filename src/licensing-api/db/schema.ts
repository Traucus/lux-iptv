import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';

/**
 * License status enum
 */
export const licenseStatusEnum = pgEnum('license_status', ['active', 'expired', 'revoked', 'pending']);

/**
 * Licenses table
 * Stores all license keys and their activation status
 */
export const licenses = pgTable('licenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  hwid: varchar('hwid', { length: 255 }), // Hardware ID bound to this license
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  status: licenseStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Type exports for use in application code
 */
export type License = typeof licenses.$inferSelect;
export type NewLicense = typeof licenses.$inferInsert;
