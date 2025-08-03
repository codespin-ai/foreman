import knex from 'knex';
import { Knex } from 'knex';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class TestDatabase {
  private static instance: TestDatabase;
  private db: Knex | null = null;

  private constructor() {}

  public static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  public async setup(): Promise<void> {
    console.log('📦 Setting up test database...');

    // Create database connection
    this.db = knex({
      client: 'pg',
      connection: {
        host: process.env.FOREMAN_DB_HOST || 'localhost',
        port: parseInt(process.env.FOREMAN_DB_PORT || '5432'),
        database: process.env.FOREMAN_DB_NAME || 'foreman_test',
        user: process.env.FOREMAN_DB_USER || 'postgres',
        password: process.env.FOREMAN_DB_PASSWORD || 'postgres'
      }
    });

    // Run migrations
    const migrationsPath = path.join(__dirname, '../../../../database/foreman/migrations');
    console.log(`Running migrations from: ${migrationsPath}`);
    
    await this.db.migrate.latest({
      directory: migrationsPath
    });

    console.log('✅ Test database ready');
  }

  public async truncateAllTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Get all tables except knex_migrations
    const tables = await this.db('pg_tables')
      .select('tablename')
      .where('schemaname', 'public')
      .whereNotIn('tablename', ['knex_migrations', 'knex_migrations_lock']);

    // Truncate all tables
    for (const { tablename } of tables) {
      await this.db.raw(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
  }

  public async cleanup(): Promise<void> {
    if (this.db) {
      await this.db.destroy();
      this.db = null;
    }
  }

  public getKnex(): Knex {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }
}