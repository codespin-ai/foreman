import { v4 as uuidv4 } from "uuid";
import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { DataContext } from "../data-context.js";
import { sql } from "@codespin/foreman-db";
import type { Task, TaskDbRow, CreateTaskInput } from "../../types.js";
import { mapTaskFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:task");

/**
 * Create a new task
 *
 * @param ctx - Data context containing database connection and orgId
 * @param input - Task creation parameters
 * @returns Result containing the created task or an error
 */
export async function createTask(
  ctx: DataContext,
  input: CreateTaskInput,
): Promise<Result<Task, Error>> {
  try {
    if (!ctx.orgId) {
      throw new Error("Organization ID is required to create a task");
    }

    return await ctx.db.tx(async (t) => {
      // With RLS, we don't need explicit org_id checks
      // The policies will automatically filter by organization
      const runCheck = await t.oneOrNone<{ id: string }>(
        `SELECT id FROM run WHERE id = $(run_id)`,
        { run_id: input.runId },
      );

      if (!runCheck) {
        return failure(new Error(`Run not found: ${input.runId}`));
      }

      // Verify parent task if provided
      if (input.parentTaskId) {
        const parentCheck = await t.oneOrNone<{ id: string }>(
          `SELECT id FROM task WHERE id = $(parent_task_id) AND run_id = $(run_id)`,
          {
            parent_task_id: input.parentTaskId,
            run_id: input.runId,
          },
        );

        if (!parentCheck) {
          return failure(
            new Error(`Parent task not found: ${input.parentTaskId}`),
          );
        }
      }

      const id = uuidv4();
      const now = Date.now();

      // Create task
      const params = {
        id,
        run_id: input.runId,
        parent_task_id: input.parentTaskId || null,
        org_id: ctx.orgId,
        type: input.type,
        status: "pending",
        input_data: input.inputData as Record<string, unknown>,
        metadata: input.metadata || null,
        retry_count: 0,
        max_retries: input.maxRetries || 3,
        created_at: now,
        updated_at: now,
      };

      const row = await t.one<TaskDbRow>(
        `${sql.insert("task", params)} RETURNING *`,
        params,
      );

      // Update run task count
      await t.none(
        `UPDATE run SET total_tasks = total_tasks + 1, updated_at = $(now) WHERE id = $(run_id)`,
        { run_id: input.runId, now: Date.now() },
      );

      logger.info("Created task", { id, runId: input.runId, type: input.type });

      return success(mapTaskFromDb(row));
    });
  } catch (error) {
    logger.error("Failed to create task", { error, orgId: ctx.orgId, input });
    return failure(error as Error);
  }
}
