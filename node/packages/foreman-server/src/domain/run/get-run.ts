import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { Database } from "@codespin/foreman-db";
import type { Run, RunDbRow } from "../../types.js";
import { mapRunFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run");

/**
 * Get a run by ID
 *
 * @param db - Database connection
 * @param id - Run ID
 * @param orgId - Organization ID for access control
 * @returns Result containing the run or an error
 */
export async function getRun(
  db: Database,
  id: string,
  orgId: string,
): Promise<Result<Run, Error>> {
  try {
    const row = await db.oneOrNone<RunDbRow>(
      `SELECT * FROM run WHERE id = $(id) AND org_id = $(org_id)`,
      { id, org_id: orgId },
    );

    if (!row) {
      return failure(new Error(`Run not found: ${id}`));
    }

    return success(mapRunFromDb(row));
  } catch (error) {
    logger.error("Failed to get run", { error, id, orgId });
    return failure(error as Error);
  }
}
