import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { DataContext } from "../data-context.js";
import type {
  Task,
  TaskDbRow,
  PaginationParams,
  PaginatedResult,
} from "../../types.js";
import { mapTaskFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:task");

/**
 * List tasks with pagination and filtering
 *
 * @param ctx - Data context containing database connection and orgId
 * @param params - Pagination and filter parameters
 * @returns Result containing paginated tasks or an error
 */
export async function listTasks(
  ctx: DataContext,
  params: PaginationParams & { runId?: string; status?: string },
): Promise<Result<PaginatedResult<Task>, Error>> {
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

    if (params.runId) {
      conditions.push("run_id = $(run_id)");
      queryParams.run_id = params.runId;
    }

    if (params.status) {
      conditions.push("status = $(status)");
      queryParams.status = params.status;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await ctx.db.one<{ count: string }>(
      `SELECT COUNT(*) as count FROM task ${whereClause}`,
      queryParams,
    );
    const total = parseInt(countResult.count);

    // Get paginated results
    const rows = await ctx.db.manyOrNone<TaskDbRow>(
      `SELECT * FROM task 
       ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $(limit) OFFSET $(offset)`,
      queryParams,
    );

    const tasks = rows.map(mapTaskFromDb);

    return success({
      data: tasks,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error("Failed to list tasks", { error, orgId: ctx.orgId, params });
    return failure(error as Error);
  }
}
