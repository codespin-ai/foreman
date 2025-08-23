import { v4 as uuidv4 } from "uuid";
import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { Database } from "@codespin/foreman-db";
import { sql } from "@codespin/foreman-db";
import type { Task, TaskDbRow, CreateTaskInput } from "../../types.js";
import { mapTaskFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:task");

/**
 * Create a new task
 *
 * @param db - Database connection
 * @param orgId - Organization ID
 * @param input - Task creation parameters
 * @returns Result containing the created task or an error
 */
export async function createTask(
  db: Database,
  orgId: string,
  input: CreateTaskInput,
): Promise<Result<Task, Error>> {
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

      // Verify parent task if provided
      if (input.parentTaskId) {
        const parentCheck = await t.oneOrNone<{ id: string }>(
          `SELECT id FROM task WHERE id = $(parent_task_id) AND run_id = $(run_id) AND org_id = $(org_id)`,
          {
            parent_task_id: input.parentTaskId,
            run_id: input.runId,
            org_id: orgId,
          },
        );

        if (!parentCheck) {
          return failure(
            new Error(`Parent task not found: ${input.parentTaskId}`),
          );
        }
      }

      const id = uuidv4();

      // Create task
      const params = {
        id,
        run_id: input.runId,
        parent_task_id: input.parentTaskId || null,
        org_id: orgId,
        type: input.type,
        status: "pending",
        input_data: input.inputData as Record<string, unknown>,
        metadata: input.metadata || null,
        max_retries: input.maxRetries || 3,
        created_at: new Date(),
      };

      const row = await t.one<TaskDbRow>(
        `${sql.insert("task", params)} RETURNING *`,
        params,
      );

      // Update run task count
      await t.none(
        `UPDATE run SET total_tasks = total_tasks + 1 WHERE id = $(run_id)`,
        { run_id: input.runId },
      );

      logger.info("Created task", { id, runId: input.runId, type: input.type });

      return success(mapTaskFromDb(row));
    });
  } catch (error) {
    logger.error("Failed to create task", { error, orgId, input });
    return failure(error as Error);
  }
}
