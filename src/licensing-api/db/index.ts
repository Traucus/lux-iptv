import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import * as schema from './schema.js';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://lux_user:lux_password@localhost:5432/lux_iptv';

// Create PostgreSQL client
const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create Drizzle ORM instance with schema
export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
