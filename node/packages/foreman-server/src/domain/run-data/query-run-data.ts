import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { DataContext } from "../data-context.js";
import type { RunData, RunDataDbRow } from "../../types.js";
import { mapRunDataFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run-data");

export interface QueryRunDataParams {
  // Key filters
  key?: string; // Exact key match
  keys?: string[]; // Multiple exact keys
  keyStartsWith?: string[]; // Key prefix matches
  keyPattern?: string; // Glob pattern (existing)

  // Tag filters
  tags?: string[]; // Exact tag matches
  tagStartsWith?: string[]; // Tag prefix matches
  tagMode?: "any" | "all"; // Default: 'any'

  // Options
  includeAll?: boolean; // Return all values (not just latest per key)
  limit?: number; // Default: 100
  offset?: number; // Default: 0
  sortBy?: "created_at" | "updated_at" | "key"; // Default: 'created_at'
  sortOrder?: "asc" | "desc"; // Default: 'desc'
}

/**
 * Query run data with flexible filtering
 *
 * @param ctx - Data context containing database connection
 * @param runId - Run ID
 * @param params - Query parameters
 * @returns Result containing the run data list or an error
 */
export async function queryRunData(
  ctx: DataContext,
  runId: string,
  params: QueryRunDataParams = {},
): Promise<Result<RunData[], Error>> {
  try {
    // Verify run exists (RLS will check org access)
    const runCheck = await ctx.db.oneOrNone<{ id: string }>(
      `SELECT id FROM run WHERE id = $(run_id)`,
      { run_id: runId },
    );

    if (!runCheck) {
      return failure(new Error(`Run not found: ${runId}`));
    }

    // Build query conditions
    const conditions: string[] = ["rd.run_id = $(run_id)"];
    const queryParams: Record<string, any> = { run_id: runId };

    // Key conditions (OR between different key filters)
    const keyConditions: string[] = [];

    // Exact key match
    if (params.key) {
      keyConditions.push("rd.key = $(key)");
      queryParams.key = params.key;
    }

    // Multiple exact keys
    if (params.keys && params.keys.length > 0) {
      keyConditions.push("rd.key = ANY($(keys))");
      queryParams.keys = params.keys;
    }

    // Key prefix matches
    if (params.keyStartsWith && params.keyStartsWith.length > 0) {
      const prefixConditions = params.keyStartsWith.map((_, i) => {
        const paramName = `keyPrefix${i}`;
        queryParams[paramName] = `${params.keyStartsWith![i]}%`;
        return `rd.key LIKE $(${paramName})`;
      });
      keyConditions.push(`(${prefixConditions.join(" OR ")})`);
    }

    // Key pattern (glob)
    if (params.keyPattern) {
      // Convert glob to SQL LIKE pattern
      const sqlPattern = params.keyPattern
        .replace(/\*/g, "%")
        .replace(/\?/g, "_");
      keyConditions.push("rd.key LIKE $(key_pattern)");
      queryParams.key_pattern = sqlPattern;
    }

    // Combine key conditions with OR
    if (keyConditions.length > 0) {
      conditions.push(`(${keyConditions.join(" OR ")})`);
    }

    // Tag conditions
    if (params.tags && params.tags.length > 0) {
      if (params.tagMode === "all") {
        // Must have ALL specified tags
        conditions.push("rd.tags @> $(tags)");
        queryParams.tags = params.tags;
      } else {
        // Must have ANY of the specified tags (default)
        conditions.push("rd.tags && $(tags)");
        queryParams.tags = params.tags;
      }
    }

    // Tag prefix matches
    if (params.tagStartsWith && params.tagStartsWith.length > 0) {
      const tagPrefixCondition = params.tagStartsWith.map((prefix, i) => {
        const paramName = `tagPrefix${i}`;
        queryParams[paramName] = `${prefix}%`;
        return `EXISTS (SELECT 1 FROM unnest(rd.tags) AS tag WHERE tag LIKE $(${paramName}))`;
      });

      if (params.tagMode === "all") {
        // Must match ALL prefix patterns
        conditions.push(`(${tagPrefixCondition.join(" AND ")})`);
      } else {
        // Must match ANY prefix pattern
        conditions.push(`(${tagPrefixCondition.join(" OR ")})`);
      }
    }

    // Build the WHERE clause
    const whereClause = conditions.join(" AND ");

    // Determine sort column
    const sortColumn =
      params.sortBy === "key"
        ? "rd.key"
        : params.sortBy === "updated_at"
          ? "rd.updated_at"
          : "rd.created_at";
    const sortOrder = params.sortOrder === "asc" ? "ASC" : "DESC";

    // Build query
    let query = `
      SELECT rd.*
      FROM run_data rd
      WHERE ${whereClause}
    `;

    // If not including all values, get only the latest per key
    if (!params.includeAll) {
      query = `
        WITH latest_per_key AS (
          SELECT DISTINCT ON (key) *
          FROM run_data rd
          WHERE ${whereClause}
          ORDER BY key, created_at DESC
        )
        SELECT * FROM latest_per_key
      `;
    }

    // Add sorting and pagination
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;

    if (params.limit) {
      query += " LIMIT $(limit)";
      queryParams.limit = params.limit;
    }

    if (params.offset) {
      query += " OFFSET $(offset)";
      queryParams.offset = params.offset;
    }

    const rows = await ctx.db.manyOrNone<RunDataDbRow>(query, queryParams);
    const data = rows.map(mapRunDataFromDb);

    return success(data);
  } catch (error) {
    logger.error("Failed to query run data", { error, runId, params });
    return failure(error as Error);
  }
}
