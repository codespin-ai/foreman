/**
 * Initial database schema for Foreman
 */

export const up = async (knex) => {
  // Run table - top-level execution context
  await knex.schema.createTable('run', (table) => {
    table.uuid('id').primary();
    table.string('org_id', 255).notNullable();
    table.string('status', 50).notNullable().defaultTo('pending');
    table.jsonb('input_data').notNullable();
    table.jsonb('output_data');
    table.jsonb('error_data');
    table.jsonb('metadata');
    table.integer('total_tasks').defaultTo(0);
    table.integer('completed_tasks').defaultTo(0);
    table.integer('failed_tasks').defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.bigInteger('duration_ms');
    
    // Indexes
    table.index(['org_id', 'created_at']);
    table.index(['status']);
    table.index(['created_at']);
  });

  // Task table - individual units of work
  await knex.schema.createTable('task', (table) => {
    table.uuid('id').primary();
    table.uuid('run_id').notNullable().references('id').inTable('run').onDelete('CASCADE');
    table.uuid('parent_task_id').references('id').inTable('task').onDelete('CASCADE');
    table.string('org_id', 255).notNullable();
    table.string('type', 255).notNullable();
    table.string('status', 50).notNullable().defaultTo('pending');
    table.jsonb('input_data').notNullable();
    table.jsonb('output_data');
    table.jsonb('error_data');
    table.jsonb('metadata');
    table.integer('retry_count').defaultTo(0);
    table.integer('max_retries').defaultTo(3);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('queued_at');
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.bigInteger('duration_ms');
    table.string('queue_job_id', 255); // External queue job ID
    
    // Indexes
    table.index(['run_id']);
    table.index(['parent_task_id']);
    table.index(['org_id', 'created_at']);
    table.index(['status']);
    table.index(['type']);
    table.index(['queue_job_id']);
  });

  // Run data table - key-value storage for runs
  await knex.schema.createTable('run_data', (table) => {
    table.uuid('id').primary();
    table.uuid('run_id').notNullable().references('id').inTable('run').onDelete('CASCADE');
    table.uuid('task_id').notNullable().references('id').inTable('task').onDelete('CASCADE');
    table.string('org_id', 255).notNullable();
    table.string('key', 255).notNullable();
    table.jsonb('value').notNullable();
    table.jsonb('metadata');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Unique constraint on run_id + key (last write wins)
    table.unique(['run_id', 'key']);
    
    // Indexes
    table.index(['run_id']);
    table.index(['task_id']);
    table.index(['org_id']);
    table.index(['key']);
    table.index(['created_at']);
  });

  // API keys table for authentication
  await knex.schema.createTable('api_key', (table) => {
    table.uuid('id').primary();
    table.string('org_id', 255).notNullable();
    table.string('name', 255).notNullable();
    table.string('key_hash', 255).notNullable().unique();
    table.string('key_prefix', 50).notNullable(); // First 8 chars for identification
    table.jsonb('permissions').notNullable().defaultTo('{}');
    table.timestamp('last_used_at');
    table.timestamp('expires_at');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.boolean('is_active').notNullable().defaultTo(true);
    
    // Indexes
    table.index(['org_id']);
    table.index(['key_prefix']);
    table.index(['is_active']);
  });

  // Audit log table
  await knex.schema.createTable('audit_log', (table) => {
    table.uuid('id').primary();
    table.string('org_id', 255).notNullable();
    table.string('entity_type', 50).notNullable(); // 'run', 'task', 'run_data'
    table.uuid('entity_id').notNullable();
    table.string('action', 50).notNullable(); // 'create', 'update', 'delete'
    table.jsonb('changes'); // JSON diff of changes
    table.string('api_key_id', 255);
    table.string('ip_address', 45);
    table.string('user_agent', 500);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['org_id', 'created_at']);
    table.index(['entity_type', 'entity_id']);
    table.index(['api_key_id']);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('audit_log');
  await knex.schema.dropTableIfExists('api_key');
  await knex.schema.dropTableIfExists('run_data');
  await knex.schema.dropTableIfExists('task');
  await knex.schema.dropTableIfExists('run');
};