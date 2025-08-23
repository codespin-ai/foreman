import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { DataContext } from "../data-context.js";
import type { RunData, RunDataDbRow } from "../../types.js";
import { mapRunDataFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run-data");

/**
 * Get run data by run ID and key
 *
 * @param ctx - Data context containing database connection
 * @param runId - Run ID
 * @param key - Data key
 * @param orgId - Organization ID for access control
 * @returns Result containing the run data or an error
 */
export async function getRunData(
  ctx: DataContext,
  runId: string,
  key: string,
  orgId: string,
): Promise<Result<RunData, Error>> {
  try {
    const row = await ctx.db.oneOrNone<RunDataDbRow>(
      `SELECT rd.* 
       FROM run_data rd
       JOIN run r ON r.id = rd.run_id
       WHERE rd.run_id = $(run_id) 
         AND rd.key = $(key)
         AND r.org_id = $(org_id)
       ORDER BY rd.created_at DESC
       LIMIT 1`,
      { run_id: runId, key, org_id: orgId },
    );

    if (!row) {
      return failure(new Error(`Run data not found: ${runId}/${key}`));
    }

    return success(mapRunDataFromDb(row));
  } catch (error) {
    logger.error("Failed to get run data", { error, runId, key, orgId });
    return failure(error as Error);
  }
}
