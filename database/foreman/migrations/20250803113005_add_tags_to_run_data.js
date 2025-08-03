/**
 * Add tags support and remove unique constraint on run_data
 */

export const up = async (knex) => {
  // Drop the unique constraint on (run_id, key) to allow multiple values
  await knex.schema.alterTable('run_data', (table) => {
    table.dropUnique(['run_id', 'key']);
  });

  // Add tags column with GIN index for efficient querying
  await knex.schema.alterTable('run_data', (table) => {
    table.specificType('tags', 'text[]').notNullable().defaultTo(knex.raw("'{}'"));
  });

  // Add indexes for tags and key prefix matching
  await knex.raw('CREATE INDEX idx_run_data_tags ON run_data USING GIN(tags)');
  await knex.raw('CREATE INDEX idx_run_data_key_prefix ON run_data(key text_pattern_ops)');
};

export const down = async (knex) => {
  // Drop the indexes
  await knex.raw('DROP INDEX IF EXISTS idx_run_data_tags');
  await knex.raw('DROP INDEX IF EXISTS idx_run_data_key_prefix');

  // Remove tags column
  await knex.schema.alterTable('run_data', (table) => {
    table.dropColumn('tags');
  });

  // Re-add the unique constraint
  await knex.schema.alterTable('run_data', (table) => {
    table.unique(['run_id', 'key']);
  });
};