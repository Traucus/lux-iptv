import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/main/db/schema.ts',
  out: './src/main/db/migrations',
  dialect: 'sqlite',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: './catalog.db',
  },
});
