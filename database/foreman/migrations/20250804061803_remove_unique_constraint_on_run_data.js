export const up = async (knex) => {
  // Drop the unique constraint on run_id + key to allow multiple values per key
  // Check if constraint exists first
  const constraintExists = await knex.raw(`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'run_data' 
      AND constraint_type = 'UNIQUE' 
      AND constraint_name LIKE '%run_id%key%'
  `);
  
  if (constraintExists.rows.length > 0) {
    await knex.schema.alterTable('run_data', (table) => {
      table.dropUnique(['run_id', 'key']);
    });
  }
};

export const down = async (knex) => {
  // Re-add the unique constraint
  await knex.schema.alterTable('run_data', (table) => {
    table.unique(['run_id', 'key']);
  });
};