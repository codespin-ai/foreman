import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { DataContext } from "../data-context.js";
import type { Run, RunDbRow } from "../../types.js";
import { mapRunFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run");

/**
 * Get a run by ID
 *
 * @param ctx - Data context containing database connection and orgId
 * @param id - Run ID
 * @returns Result containing the run or an error
 */
export async function getRun(
  ctx: DataContext,
  id: string,
): Promise<Result<Run, Error>> {
  try {
    // RLS will handle org filtering automatically
    const row = await ctx.db.oneOrNone<RunDbRow>(
      `SELECT * FROM run WHERE id = $(id)`,
      { id },
    );

    if (!row) {
      return failure(new Error(`Run not found: ${id}`));
    }

    return success(mapRunFromDb(row));
  } catch (error) {
    logger.error("Failed to get run", { error, id, orgId: ctx.orgId });
    return failure(error as Error);
  }
}
