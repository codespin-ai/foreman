import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { DataContext } from "../data-context.js";

const logger = createLogger("foreman:domain:run-data");

export interface DeleteRunDataParams {
  runId: string;
  key?: string;
  id?: string;
}

/**
 * Delete run data entries
 *
 * @param ctx - Data context containing database connection
 * @param params - Delete parameters (must provide either key or id)
 * @returns Result containing the number of deleted entries or an error
 */
export async function deleteRunData(
  ctx: DataContext,
  params: DeleteRunDataParams,
): Promise<Result<{ deleted: number }, Error>> {
  try {
    if (!params.key && !params.id) {
      return failure(new Error("Must provide either key or id parameter"));
    }

    // Verify run exists (RLS will check org access)
    const runCheck = await ctx.db.oneOrNone<{ id: string }>(
      `SELECT id FROM run WHERE id = $(run_id)`,
      { run_id: params.runId },
    );

    if (!runCheck) {
      return failure(new Error(`Run not found: ${params.runId}`));
    }

    let deletedCount = 0;

    if (params.id) {
      // Delete specific entry by ID
      // With RLS, org_id check is automatic
      const result = await ctx.db.result(
        `DELETE FROM run_data 
         WHERE id = $(id) 
           AND run_id = $(run_id)`,
        { id: params.id, run_id: params.runId },
      );
      deletedCount = result.rowCount;
    } else if (params.key) {
      // Delete all entries for a key
      // With RLS, org_id check is automatic
      const result = await ctx.db.result(
        `DELETE FROM run_data 
         WHERE run_id = $(run_id)
           AND key = $(key)`,
        { run_id: params.runId, key: params.key },
      );
      deletedCount = result.rowCount;
    }

    if (deletedCount === 0) {
      return failure(new Error("No matching run data found"));
    }

    return success({ deleted: deletedCount });
  } catch (error) {
    logger.error("Failed to delete run data", { error, params });
    return failure(error as Error);
  }
}
