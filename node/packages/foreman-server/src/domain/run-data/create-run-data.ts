import { v4 as uuidv4 } from "uuid";
import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { DataContext } from "../data-context.js";
import { sql } from "@codespin/foreman-db";
import type { RunData, RunDataDbRow, CreateRunDataInput } from "../../types.js";
import { mapRunDataFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run-data");

/**
 * Create or update run data
 *
 * @param ctx - Data context containing database connection and orgId
 * @param input - Run data creation parameters
 * @returns Result containing the created/updated run data or an error
 */
export async function createRunData(
  ctx: DataContext,
  input: CreateRunDataInput,
): Promise<Result<RunData, Error>> {
  try {
    if (!ctx.orgId) {
      throw new Error("Organization ID is required to create run data");
    }

    return await ctx.db.tx(async (t) => {
      // Verify run exists - RLS will handle org filtering
      const runCheck = await t.oneOrNone<{ id: string }>(
        `SELECT id FROM run WHERE id = $(run_id)`,
        { run_id: input.runId },
      );

      if (!runCheck) {
        return failure(new Error(`Run not found: ${input.runId}`));
      }

      // Verify task exists and belongs to the run - RLS will handle org filtering
      const taskCheck = await t.oneOrNone<{ id: string }>(
        `SELECT id FROM task 
         WHERE id = $(task_id) 
           AND run_id = $(run_id)`,
        { task_id: input.taskId, run_id: input.runId },
      );

      if (!taskCheck) {
        return failure(new Error(`Task not found: ${input.taskId}`));
      }

      const id = uuidv4();

      // Insert run data (allows multiple entries per key)
      const params = {
        id,
        run_id: input.runId,
        task_id: input.taskId,
        org_id: ctx.orgId,
        key: input.key,
        value: input.value as Record<string, unknown>,
        tags: input.tags || [],
        metadata: input.metadata || null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const row = await t.one<RunDataDbRow>(
        `${sql.insert("run_data", params)} RETURNING *`,
        params,
      );

      logger.info("Created/updated run data", {
        id: row.id,
        runId: input.runId,
        key: input.key,
      });

      return success(mapRunDataFromDb(row));
    });
  } catch (error) {
    logger.error("Failed to create run data", { error, orgId: ctx.orgId, input });
    return failure(error as Error);
  }
}
