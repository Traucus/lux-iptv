-- Lux IPTV Database Initialization Script
-- This runs automatically when the Postgres container is first created

-- Create the licensing schema
CREATE SCHEMA IF NOT EXISTS licensing;

-- Grant permissions to the application user
GRANT ALL PRIVILEGES ON DATABASE lux_iptv TO lux_user;
GRANT ALL PRIVILEGES ON SCHEMA licensing TO lux_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA licensing TO lux_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA licensing TO lux_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA licensing GRANT ALL ON TABLES TO lux_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA licensing GRANT ALL ON SEQUENCES TO lux_user;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
