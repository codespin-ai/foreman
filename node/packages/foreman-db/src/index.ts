import pgPromise from "pg-promise";
import type { IDatabase } from "pg-promise";
import { createLogger } from "@codespin/foreman-logger";
export * as sql from "./sql.js";

const logger = createLogger("foreman-db");

// Initialize pg-promise
const pgp = pgPromise({
  // Initialization options
  error(error: Error, e: { query?: unknown; params?: unknown }): void {
    if (e.query) {
      logger.error("Database query error", {
        error: error.message,
        query: e.query,
        params: e.params,
      });
    }
  },
});

// Database connection type
export type Database = IDatabase<Record<string, never>>;

// Connection configuration
interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

// Connection pool
let db: Database | null = null;

/**
 * Get or create database connection
 *
 * @returns Database connection instance
 */
export function getDb(): Database {
  if (!db) {
    const config: DbConfig = {
      host: process.env.FOREMAN_DB_HOST || "localhost",
      port: parseInt(process.env.FOREMAN_DB_PORT || "5432"),
      database: process.env.FOREMAN_DB_NAME || "foreman",
      user: process.env.FOREMAN_DB_USER || "foreman",
      password: process.env.FOREMAN_DB_PASSWORD || "foreman",
      ssl: process.env.FOREMAN_DB_SSL === "true",
    };

    logger.info("Connecting to database", {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
    });

    db = pgp(config);
  }

  return db;
}

/**
 * Close database connection
 */
export async function closeDb(): Promise<void> {
  if (db) {
    await db.$pool.end();
    db = null;
    logger.info("Database connection closed");
  }
}

// Re-export pg-promise types that are commonly used
export { pgPromise };
export type { IDatabase } from "pg-promise";
