import { v4 as uuidv4 } from "uuid";
import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { Database } from "@codespin/foreman-db";
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
        `SELECT id FROM run WHERE id = $(runId) AND org_id = $(orgId)`,
        { runId: input.runId, orgId },
      );

      if (!runCheck) {
        return failure(new Error(`Run not found: ${input.runId}`));
      }

      // Verify parent task if provided
      if (input.parentTaskId) {
        const parentCheck = await t.oneOrNone<{ id: string }>(
          `SELECT id FROM task WHERE id = $(parentTaskId) AND run_id = $(runId) AND org_id = $(orgId)`,
          { parentTaskId: input.parentTaskId, runId: input.runId, orgId },
        );

        if (!parentCheck) {
          return failure(
            new Error(`Parent task not found: ${input.parentTaskId}`),
          );
        }
      }

      const id = uuidv4();

      // Create task
      const row = await t.one<TaskDbRow>(
        `INSERT INTO task (
          id, run_id, parent_task_id, org_id, type, status, 
          input_data, metadata, max_retries, created_at
        )
        VALUES (
          $(id), $(runId), $(parentTaskId), $(orgId), $(type), $(status),
          $(inputData), $(metadata), $(maxRetries), NOW()
        )
        RETURNING *`,
        {
          id,
          runId: input.runId,
          parentTaskId: input.parentTaskId || null,
          orgId,
          type: input.type,
          status: "pending",
          inputData: input.inputData as Record<string, unknown>,
          metadata: input.metadata || null,
          maxRetries: input.maxRetries || 3,
        },
      );

      // Update run task count
      await t.none(
        `UPDATE run SET total_tasks = total_tasks + 1 WHERE id = $(runId)`,
        { runId: input.runId },
      );

      logger.info("Created task", { id, runId: input.runId, type: input.type });

      return success(mapTaskFromDb(row));
    });
  } catch (error) {
    logger.error("Failed to create task", { error, orgId, input });
    return failure(error as Error);
  }
}
