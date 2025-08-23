import { v4 as uuidv4 } from "uuid";
import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { Database } from "@codespin/foreman-db";
import { sql } from "@codespin/foreman-db";
import type { RunData, RunDataDbRow, CreateRunDataInput } from "../../types.js";
import { mapRunDataFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run-data");

/**
 * Create or update run data
 *
 * @param db - Database connection
 * @param orgId - Organization ID
 * @param input - Run data creation parameters
 * @returns Result containing the created/updated run data or an error
 */
export async function createRunData(
  db: Database,
  orgId: string,
  input: CreateRunDataInput,
): Promise<Result<RunData, Error>> {
  try {
    return await db.tx(async (t) => {
      // Verify run exists and belongs to org
      const runCheck = await t.oneOrNone<{ id: string }>(
        `SELECT id FROM run WHERE id = $(run_id) AND org_id = $(org_id)`,
        { run_id: input.runId, org_id: orgId },
      );

      if (!runCheck) {
        return failure(new Error(`Run not found: ${input.runId}`));
      }

      // Verify task exists and belongs to the run
      const taskCheck = await t.oneOrNone<{ id: string }>(
        `SELECT id FROM task 
         WHERE id = $(task_id) 
           AND run_id = $(run_id) 
           AND org_id = $(org_id)`,
        { task_id: input.taskId, run_id: input.runId, org_id: orgId },
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
        org_id: orgId,
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
    logger.error("Failed to create run data", { error, orgId, input });
    return failure(error as Error);
  }
}
