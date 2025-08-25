import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { DataContext } from "../data-context.js";
import type {
  Run,
  RunDbRow,
  PaginationParams,
  PaginatedResult,
} from "../../types.js";
import { mapRunFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run");

/**
 * List runs with pagination and filtering
 *
 * @param ctx - Data context containing database connection and orgId
 * @param params - Pagination and filter parameters
 * @returns Result containing paginated runs or an error
 */
export async function listRuns(
  ctx: DataContext,
  params: PaginationParams & { status?: string },
): Promise<Result<PaginatedResult<Run>, Error>> {
  try {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const sortBy = params.sortBy || "created_at";
    const sortOrder = params.sortOrder || "desc";

    // Build filter conditions - RLS will handle org filtering
    const conditions: string[] = [];
    const queryParams: Record<string, unknown> = {
      limit,
      offset,
    };

    if (params.status) {
      conditions.push("status = $(status)");
      queryParams.status = params.status;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await ctx.db.one<{ count: string }>(
      `SELECT COUNT(*) as count FROM run ${whereClause}`,
      queryParams,
    );
    const total = parseInt(countResult.count);

    // Get paginated results
    const rows = await ctx.db.manyOrNone<RunDbRow>(
      `SELECT * FROM run 
       ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $(limit) OFFSET $(offset)`,
      queryParams,
    );

    const runs = rows.map(mapRunFromDb);

    return success({
      data: runs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error("Failed to list runs", { error, orgId: ctx.orgId, params });
    return failure(error as Error);
  }
}
