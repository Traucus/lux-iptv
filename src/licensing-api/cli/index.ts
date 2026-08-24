#!/usr/bin/env tsx
import { Command } from 'commander';
import { db } from '../db/index.js';
import { licenses } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const program = new Command();

program
  .name('lux-license-cli')
  .description('CLI for managing Lux IPTV licenses')
  .version('0.1.0');

/**
 * Generate a random license key
 */
function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    const segment = crypto.randomBytes(4).toString('hex').toUpperCase();
    segments.push(segment);
  }
  return segments.join('-');
}

/**
 * Create a new license
 */
program
  .command('create')
  .description('Create a new license key')
  .option('-e, --expires <date>', 'Expiration date (ISO 8601 format)')
  .action(async (options) => {
    try {
      const key = generateLicenseKey();
      const expiresAt = options.expires ? new Date(options.expires) : null;

      const newLicense = await db
        .insert(licenses)
        .values({
          key,
          status: 'pending',
          expiresAt,
        })
        .returning();

      console.log('✅ License created successfully:');
      console.log(`   Key: ${newLicense[0]?.key}`);
      console.log(`   ID: ${newLicense[0]?.id}`);
      console.log(`   Status: ${newLicense[0]?.status}`);
      if (expiresAt) {
        console.log(`   Expires: ${expiresAt.toISOString()}`);
      }
    } catch (error) {
      console.error('❌ Failed to create license:', error);
      process.exit(1);
    }
  });

/**
 * List all licenses
 */
program
  .command('list')
  .description('List all licenses')
  .option('-s, --status <status>', 'Filter by status (active, expired, revoked, pending)')
  .action(async (options) => {
    try {
      let allLicenses = await db.query.licenses.findMany();

      if (options.status) {
        allLicenses = allLicenses.filter((l) => l.status === options.status);
      }

      if (allLicenses.length === 0) {
        console.log('No licenses found.');
        return;
      }

      console.log(`\n📋 Found ${allLicenses.length} license(s):\n`);
      console.log('ID'.padEnd(38) + 'Key'.padEnd(40) + 'Status'.padEnd(12) + 'Expires');
      console.log('-'.repeat(100));

      for (const license of allLicenses) {
        const expires = license.expiresAt ? new Date(license.expiresAt).toISOString().split('T')[0] : 'Never';
        console.log(
          `${license.id?.padEnd(38)}${license.key?.padEnd(40)}${license.status?.padEnd(12)}${expires}`,
        );
      }
      console.log('');
    } catch (error) {
      console.error('❌ Failed to list licenses:', error);
      process.exit(1);
    }
  });

/**
 * Revoke a license
 */
program
  .command('revoke')
  .description('Revoke a license by key or ID')
  .requiredOption('-k, --key <key>', 'License key to revoke')
  .action(async (options) => {
    try {
      const license = await db.query.licenses.findFirst({
        where: eq(licenses.key, options.key),
      });

      if (!license) {
        console.error(`❌ License not found: ${options.key}`);
        process.exit(1);
      }

      if (license.status === 'revoked') {
        console.log(`⚠️  License ${options.key} is already revoked.`);
        return;
      }

      await db
        .update(licenses)
        .set({ status: 'revoked', updatedAt: new Date() })
        .where(eq(licenses.key, options.key));

      console.log(`✅ License revoked successfully: ${options.key}`);
    } catch (error) {
      console.error('❌ Failed to revoke license:', error);
      process.exit(1);
    }
  });

program.parse();
