/**
 * Enable Row Level Security (RLS) for multi-tenant isolation
 *
 * This migration:
 * 1. Creates database users for RLS
 * 2. Grants appropriate permissions
 * 3. Enables RLS on tenant-scoped tables
 * 4. Creates security policies
 *
 * Special handling: If x-org-id header is "ROOT", uses unrestricted access
 * Otherwise, uses RLS policies to filter by organization
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  // Note: User creation requires superuser privileges
  // These may need to be run separately by a DBA in production

  // Create users (wrapped in DO block to handle existing users)
  await knex.raw(`
    DO $$
    BEGIN
      -- Create RLS user if not exists
      IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'rls_db_user') THEN
        CREATE USER rls_db_user WITH PASSWORD 'changeme_rls_password';
      END IF;
      
      -- Create unrestricted user if not exists  
      IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'unrestricted_db_user') THEN
        CREATE USER unrestricted_db_user WITH PASSWORD 'changeme_admin_password';
      END IF;
    EXCEPTION WHEN duplicate_object THEN
      -- Users already exist, continue
      NULL;
    END $$;
  `);

  // Grant permissions
  await knex.raw(`
    -- Grant schema permissions
    GRANT USAGE ON SCHEMA public TO rls_db_user;
    GRANT ALL ON SCHEMA public TO unrestricted_db_user;
    
    -- Grant table permissions to unrestricted user
    GRANT ALL ON ALL TABLES IN SCHEMA public TO unrestricted_db_user;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO unrestricted_db_user;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO unrestricted_db_user;
    
    -- Grant table permissions to RLS user (will be filtered by policies)
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rls_db_user;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rls_db_user;
    
    -- Set default privileges for future tables
    ALTER DEFAULT PRIVILEGES IN SCHEMA public 
      GRANT ALL ON TABLES TO unrestricted_db_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public 
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rls_db_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public 
      GRANT USAGE ON SEQUENCES TO rls_db_user;
  `);

  // Enable RLS on tenant-scoped tables (all tables have org_id)
  const tenantTables = ["run", "task", "run_data"];

  // Enable RLS on each table
  for (const table of tenantTables) {
    await knex.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  }

  // Create RLS policies

  // All tables have org_id and follow the same pattern
  for (const table of tenantTables) {
    await knex.raw(`
      CREATE POLICY ${table}_isolation ON ${table}
        FOR ALL
        TO rls_db_user
        USING (org_id = current_setting('app.current_org_id', true));
    `);
  }

  // Grant BYPASSRLS to unrestricted user (requires superuser)
  await knex.raw(`
    DO $$
    BEGIN
      ALTER USER unrestricted_db_user BYPASSRLS;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Cannot grant BYPASSRLS - requires superuser. unrestricted_db_user will still work but queries will be checked against policies.';
    END $$;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  // Drop all policies
  const tenantTables = ["run", "task", "run_data"];

  // Drop policies
  for (const table of tenantTables) {
    await knex.raw(`DROP POLICY IF EXISTS ${table}_isolation ON ${table}`);
  }

  // Disable RLS
  for (const table of tenantTables) {
    await knex.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
  }

  // Revoke permissions
  await knex.raw(`
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM rls_db_user;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM rls_db_user;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM rls_db_user;
    REVOKE USAGE ON SCHEMA public FROM rls_db_user;
    
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM unrestricted_db_user;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM unrestricted_db_user;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM unrestricted_db_user;
    REVOKE ALL ON SCHEMA public FROM unrestricted_db_user;
  `);

  // Note: We don't drop users as they might be used elsewhere
  // DBAs can manually drop users if needed:
  // DROP USER IF EXISTS rls_db_user;
  // DROP USER IF EXISTS unrestricted_db_user;
};
