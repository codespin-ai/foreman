import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { Database } from "@codespin/foreman-db";
import { sql } from "@codespin/foreman-db";
import type { Run, RunDbRow, UpdateRunInput } from "../../types.js";
import { mapRunFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run");

/**
 * Update a run
 *
 * @param db - Database connection
 * @param id - Run ID
 * @param orgId - Organization ID for access control
 * @param input - Update parameters
 * @returns Result containing the updated run or an error
 */
export async function updateRun(
  db: Database,
  id: string,
  orgId: string,
  input: UpdateRunInput,
): Promise<Result<Run, Error>> {
  try {
    const updateParams: Record<string, unknown> = {};
    const additionalUpdates: string[] = [];

    if (input.status !== undefined) {
      updateParams.status = input.status;

      // Set started_at when transitioning to running
      if (input.status === "running") {
        additionalUpdates.push("started_at = COALESCE(started_at, NOW())");
      }

      // Set completed_at and calculate duration when transitioning to terminal state
      if (["completed", "failed", "cancelled"].includes(input.status)) {
        additionalUpdates.push("completed_at = NOW()");
        additionalUpdates.push(
          "duration_ms = EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at))) * 1000",
        );
      }
    }

    if (input.outputData !== undefined) {
      updateParams.output_data = input.outputData as Record<string, unknown>;
    }

    if (input.errorData !== undefined) {
      updateParams.error_data = input.errorData as Record<string, unknown>;
    }

    if (input.metadata !== undefined) {
      updateParams.metadata = input.metadata as Record<string, unknown>;
    }

    if (
      Object.keys(updateParams).length === 0 &&
      additionalUpdates.length === 0
    ) {
      return failure(new Error("No fields to update"));
    }

    // Build the SET clause
    let setClause = "";
    if (Object.keys(updateParams).length > 0) {
      setClause = sql
        .update("run", updateParams)
        .replace("UPDATE run SET ", "");
      if (additionalUpdates.length > 0) {
        setClause += ", " + additionalUpdates.join(", ");
      }
    } else {
      setClause = additionalUpdates.join(", ");
    }

    const allParams = { ...updateParams, id, org_id: orgId };

    const row = await db.oneOrNone<RunDbRow>(
      `UPDATE run 
       SET ${setClause}
       WHERE id = $(id) AND org_id = $(org_id)
       RETURNING *`,
      allParams,
    );

    if (!row) {
      return failure(new Error(`Run not found: ${id}`));
    }

    logger.info("Updated run", { id, orgId, updates: Object.keys(input) });

    return success(mapRunFromDb(row));
  } catch (error) {
    logger.error("Failed to update run", { error, id, orgId, input });
    return failure(error as Error);
  }
}
