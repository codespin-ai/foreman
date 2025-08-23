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
 * @param ctx - Data context containing database connection
 * @param orgId - Organization ID for access control
 * @param params - Pagination and filter parameters
 * @returns Result containing paginated runs or an error
 */
export async function listRuns(
  ctx: DataContext,
  orgId: string,
  params: PaginationParams & { status?: string },
): Promise<Result<PaginatedResult<Run>, Error>> {
  try {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const sortBy = params.sortBy || "created_at";
    const sortOrder = params.sortOrder || "desc";

    // Build filter conditions
    const conditions = ["org_id = $(org_id)"];
    const queryParams: Record<string, unknown> = {
      org_id: orgId,
      limit,
      offset,
    };

    if (params.status) {
      conditions.push("status = $(status)");
      queryParams.status = params.status;
    }

    // Get total count
    const countResult = await ctx.db.one<{ count: string }>(
      `SELECT COUNT(*) as count FROM run WHERE ${conditions.join(" AND ")}`,
      queryParams,
    );
    const total = parseInt(countResult.count);

    // Get paginated results
    const rows = await ctx.db.manyOrNone<RunDbRow>(
      `SELECT * FROM run 
       WHERE ${conditions.join(" AND ")}
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
    logger.error("Failed to list runs", { error, orgId, params });
    return failure(error as Error);
  }
}
