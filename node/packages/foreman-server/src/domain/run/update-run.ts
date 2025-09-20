import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { DataContext } from "../data-context.js";
import { sql } from "@codespin/foreman-db";
import type { Run, RunDbRow, UpdateRunInput } from "../../types.js";
import { mapRunFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run");

/**
 * Update a run
 *
 * @param ctx - Data context containing database connection and orgId
 * @param id - Run ID
 * @param input - Update parameters
 * @returns Result containing the updated run or an error
 */
export async function updateRun(
  ctx: DataContext,
  id: string,
  input: UpdateRunInput,
): Promise<Result<Run, Error>> {
  try {
    const now = Date.now();
    const updateParams: Record<string, unknown> = {
      updated_at: now,
    };
    const additionalUpdates: string[] = [];

    if (input.status !== undefined) {
      updateParams.status = input.status;

      // Set started_at when transitioning to running
      if (input.status === "running") {
        additionalUpdates.push(`started_at = COALESCE(started_at, ${now})`);
      }

      // Set completed_at and calculate duration when transitioning to terminal state
      if (["completed", "failed", "cancelled"].includes(input.status)) {
        updateParams.completed_at = now;
        additionalUpdates.push(
          `duration_ms = ${now} - COALESCE(started_at, created_at)`,
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
    const setClause =
      Object.keys(updateParams).length > 0
        ? sql.update("run", updateParams).replace("UPDATE run SET ", "") +
          (additionalUpdates.length > 0
            ? ", " + additionalUpdates.join(", ")
            : "")
        : additionalUpdates.join(", ");

    const allParams = { ...updateParams, id };

    // RLS will handle org filtering automatically
    const row = await ctx.db.oneOrNone<RunDbRow>(
      `UPDATE run 
       SET ${setClause}
       WHERE id = $(id)
       RETURNING *`,
      allParams,
    );

    if (!row) {
      return failure(new Error(`Run not found: ${id}`));
    }

    logger.info("Updated run", {
      id,
      orgId: ctx.orgId,
      updates: Object.keys(input),
    });

    return success(mapRunFromDb(row));
  } catch (error) {
    logger.error("Failed to update run", {
      error,
      id,
      orgId: ctx.orgId,
      input,
    });
    return failure(error as Error);
  }
}
