/**
 * Initial database schema for Foreman
 */

export const up = async (knex) => {
  // Run table - top-level execution context
  await knex.schema.createTable("run", (table) => {
    table.uuid("id").primary();
    table.string("org_id", 255).notNullable();
    table.string("status", 50).notNullable();
    table.jsonb("input_data").notNullable();
    table.jsonb("output_data");
    table.jsonb("error_data");
    table.jsonb("metadata");
    table.integer("total_tasks").notNullable();
    table.integer("completed_tasks").notNullable();
    table.integer("failed_tasks").notNullable();
    table.bigint("created_at").notNullable();
    table.bigint("updated_at").notNullable();
    table.bigint("started_at");
    table.bigint("completed_at");
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
    table.string("status", 50).notNullable();
    table.jsonb("input_data").notNullable();
    table.jsonb("output_data");
    table.jsonb("error_data");
    table.jsonb("metadata");
    table.integer("retry_count").notNullable();
    table.integer("max_retries").notNullable();
    table.bigint("created_at").notNullable();
    table.bigint("updated_at").notNullable();
    table.bigint("queued_at");
    table.bigint("started_at");
    table.bigint("completed_at");
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
    table.specificType("tags", "text[]").notNullable();
    table.bigint("created_at").notNullable();
    table.bigint("updated_at").notNullable();

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
};

export const down = async (knex) => {
  // Drop custom indexes
  await knex.raw("DROP INDEX IF EXISTS idx_run_data_tags");
  await knex.raw("DROP INDEX IF EXISTS idx_run_data_key_prefix");

  // Drop tables in reverse order
  await knex.schema.dropTableIfExists("run_data");
  await knex.schema.dropTableIfExists("task");
  await knex.schema.dropTableIfExists("run");
};
