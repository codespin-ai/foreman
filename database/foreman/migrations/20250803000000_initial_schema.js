/**
 * Initial database schema for Foreman
 */

export const up = async (knex) => {
  // Run table - top-level execution context
  await knex.schema.createTable("run", (table) => {
    table.uuid("id").primary();
    table.string("org_id", 255).notNullable();
    table.string("status", 50).notNullable().defaultTo("pending");
    table.jsonb("input_data").notNullable();
    table.jsonb("output_data");
    table.jsonb("error_data");
    table.jsonb("metadata");
    table.integer("total_tasks").defaultTo(0);
    table.integer("completed_tasks").defaultTo(0);
    table.integer("failed_tasks").defaultTo(0);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("started_at");
    table.timestamp("completed_at");
    table.bigInteger("duration_ms");

    // Indexes
    table.index(["org_id", "created_at"]);
    table.index(["status"]);
    table.index(["created_at"]);
  });

  // Task table - individual units of work
  await knex.schema.createTable("task", (table) => {
    table.uuid("id").primary();
    table
      .uuid("run_id")
      .notNullable()
      .references("id")
      .inTable("run")
      .onDelete("CASCADE");
    table
      .uuid("parent_task_id")
      .references("id")
      .inTable("task")
      .onDelete("CASCADE");
    table.string("org_id", 255).notNullable();
    table.string("type", 255).notNullable();
    table.string("status", 50).notNullable().defaultTo("pending");
    table.jsonb("input_data").notNullable();
    table.jsonb("output_data");
    table.jsonb("error_data");
    table.jsonb("metadata");
    table.integer("retry_count").defaultTo(0);
    table.integer("max_retries").defaultTo(3);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("queued_at");
    table.timestamp("started_at");
    table.timestamp("completed_at");
    table.bigInteger("duration_ms");
    table.string("queue_job_id", 255); // External queue job ID

    // Indexes
    table.index(["run_id"]);
    table.index(["parent_task_id"]);
    table.index(["org_id", "created_at"]);
    table.index(["status"]);
    table.index(["type"]);
    table.index(["queue_job_id"]);
  });

  // Run data table - key-value storage for runs
  await knex.schema.createTable("run_data", (table) => {
    table.uuid("id").primary();
    table
      .uuid("run_id")
      .notNullable()
      .references("id")
      .inTable("run")
      .onDelete("CASCADE");
    table
      .uuid("task_id")
      .notNullable()
      .references("id")
      .inTable("task")
      .onDelete("CASCADE");
    table.string("org_id", 255).notNullable();
    table.string("key", 255).notNullable();
    table.jsonb("value").notNullable();
    table.jsonb("metadata");
    table
      .specificType("tags", "text[]")
      .notNullable()
      .defaultTo(knex.raw("'{}'"));
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(["run_id"]);
    table.index(["task_id"]);
    table.index(["org_id"]);
    table.index(["key"]);
    table.index(["created_at"]);
  });

  // Add GIN index for tags and key prefix matching
  await knex.raw("CREATE INDEX idx_run_data_tags ON run_data USING GIN(tags)");
  await knex.raw(
    "CREATE INDEX idx_run_data_key_prefix ON run_data(key text_pattern_ops)",
  );

  // Create trigger function to update updated_at on row updates
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
    
    CREATE TRIGGER update_run_updated_at BEFORE UPDATE ON run
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
    CREATE TRIGGER update_task_updated_at BEFORE UPDATE ON task
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_run_data_updated_at BEFORE UPDATE ON run_data
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
};

export const down = async (knex) => {
  // Drop triggers
  await knex.raw("DROP TRIGGER IF EXISTS update_run_updated_at ON run");
  await knex.raw("DROP TRIGGER IF EXISTS update_task_updated_at ON task");
  await knex.raw(
    "DROP TRIGGER IF EXISTS update_run_data_updated_at ON run_data",
  );
  await knex.raw("DROP FUNCTION IF EXISTS update_updated_at_column");

  // Drop custom indexes
  await knex.raw("DROP INDEX IF EXISTS idx_run_data_tags");
  await knex.raw("DROP INDEX IF EXISTS idx_run_data_key_prefix");

  // Drop tables in reverse order
  await knex.schema.dropTableIfExists("run_data");
  await knex.schema.dropTableIfExists("task");
  await knex.schema.dropTableIfExists("run");
};
