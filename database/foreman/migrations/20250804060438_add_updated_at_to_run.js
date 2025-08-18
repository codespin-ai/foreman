export const up = async (knex) => {
  // Add updated_at column to run table
  await knex.schema.alterTable("run", (table) => {
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // Add updated_at column to task table for consistency
  await knex.schema.alterTable("task", (table) => {
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // Create trigger to update updated_at on run table
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
  `);
};

export const down = async (knex) => {
  // Drop triggers
  await knex.raw("DROP TRIGGER IF EXISTS update_run_updated_at ON run");
  await knex.raw("DROP TRIGGER IF EXISTS update_task_updated_at ON task");
  await knex.raw("DROP FUNCTION IF EXISTS update_updated_at_column");

  // Remove updated_at columns
  await knex.schema.alterTable("run", (table) => {
    table.dropColumn("updated_at");
  });

  await knex.schema.alterTable("task", (table) => {
    table.dropColumn("updated_at");
  });
};
