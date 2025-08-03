/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Add tags column to run_data
  await knex.schema.alterTable('run_data', (table) => {
    table.specificType('tags', 'TEXT[]').defaultTo('{}').notNullable();
  });

  // Drop the unique constraint on (run_id, key)
  await knex.schema.alterTable('run_data', (table) => {
    table.dropUnique(['run_id', 'key']);
  });

  // Create indexes for efficient querying
  // GIN index for tag array searches
  await knex.raw('CREATE INDEX idx_run_data_tags ON run_data USING GIN(tags)');
  
  // B-tree index for key prefix searches (already efficient with existing index)
  // But let's add a composite index for run_id + key for better performance
  await knex.raw('CREATE INDEX idx_run_data_run_id_key ON run_data(run_id, key)');
  
  // Index for efficient sorting by created_at within a run
  await knex.raw('CREATE INDEX idx_run_data_run_id_created_at ON run_data(run_id, created_at DESC)');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // Drop the indexes
  await knex.raw('DROP INDEX IF EXISTS idx_run_data_run_id_created_at');
  await knex.raw('DROP INDEX IF EXISTS idx_run_data_run_id_key');
  await knex.raw('DROP INDEX IF EXISTS idx_run_data_tags');

  // Re-add the unique constraint
  await knex.schema.alterTable('run_data', (table) => {
    table.unique(['run_id', 'key']);
  });

  // Remove tags column
  await knex.schema.alterTable('run_data', (table) => {
    table.dropColumn('tags');
  });
}