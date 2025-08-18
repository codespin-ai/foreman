import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { Database } from "@codespin/foreman-db";
import type { RunData, RunDataDbRow } from "../../types.js";
import { mapRunDataFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run-data");

/**
 * List all data for a run
 *
 * @param db - Database connection
 * @param runId - Run ID
 * @param orgId - Organization ID for access control
 * @returns Result containing the run data list or an error
 */
export async function listRunData(
  db: Database,
  runId: string,
  orgId: string,
): Promise<Result<RunData[], Error>> {
  try {
    // Verify run exists and belongs to org
    const runCheck = await db.oneOrNone<{ id: string }>(
      `SELECT id FROM run WHERE id = $(runId) AND org_id = $(orgId)`,
      { runId, orgId },
    );

    if (!runCheck) {
      return failure(new Error(`Run not found: ${runId}`));
    }

    const rows = await db.manyOrNone<RunDataDbRow>(
      `SELECT * FROM run_data 
       WHERE run_id = $(runId)
       ORDER BY key ASC`,
      { runId },
    );

    const data = rows.map(mapRunDataFromDb);

    return success(data);
  } catch (error) {
    logger.error("Failed to list run data", { error, runId, orgId });
    return failure(error as Error);
  }
}
