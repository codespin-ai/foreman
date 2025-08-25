import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { DataContext } from "../data-context.js";
import { sql } from "@codespin/foreman-db";
import type { Task, TaskDbRow, UpdateTaskInput } from "../../types.js";
import { mapTaskFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:task");

/**
 * Update a task
 *
 * @param ctx - Data context containing database connection and orgId
 * @param id - Task ID
 * @param input - Update parameters
 * @returns Result containing the updated task or an error
 */
export async function updateTask(
  ctx: DataContext,
  id: string,
  input: UpdateTaskInput,
): Promise<Result<Task, Error>> {
  try {
    return await ctx.db.tx(async (t) => {
      const updateParams: Record<string, unknown> = {};
      const additionalUpdates: string[] = [];

      if (input.status !== undefined) {
        updateParams.status = input.status;

        // Set queued_at when transitioning to queued
        if (input.status === "queued") {
          additionalUpdates.push("queued_at = COALESCE(queued_at, NOW())");
        }

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

        // Increment retry count when retrying
        if (input.status === "retrying") {
          additionalUpdates.push("retry_count = retry_count + 1");
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

      if (input.queueJobId !== undefined) {
        updateParams.queue_job_id = input.queueJobId;
      }

      if (
        Object.keys(updateParams).length === 0 &&
        additionalUpdates.length === 0
      ) {
        return failure(new Error("No fields to update"));
      }

      // Get current task to check run_id - RLS will handle org filtering
      const currentTask = await t.oneOrNone<{ run_id: string; status: string }>(
        `SELECT run_id, status FROM task WHERE id = $(id)`,
        { id },
      );

      if (!currentTask) {
        return failure(new Error(`Task not found: ${id}`));
      }

      // Build the SET clause
      let setClause = "";
      if (Object.keys(updateParams).length > 0) {
        setClause = sql
          .update("task", updateParams)
          .replace("UPDATE task SET ", "");
        if (additionalUpdates.length > 0) {
          setClause += ", " + additionalUpdates.join(", ");
        }
      } else {
        setClause = additionalUpdates.join(", ");
      }

      const allParams = { ...updateParams, id };

      // RLS will handle org filtering automatically
      const row = await t.one<TaskDbRow>(
        `UPDATE task 
         SET ${setClause}
         WHERE id = $(id)
         RETURNING *`,
        allParams,
      );

      // Update run counters if status changed to terminal state
      if (
        input.status &&
        ["completed", "failed"].includes(input.status) &&
        !["completed", "failed", "cancelled"].includes(currentTask.status)
      ) {
        if (input.status === "completed") {
          await t.none(
            `UPDATE run SET completed_tasks = completed_tasks + 1 WHERE id = $(run_id)`,
            { run_id: currentTask.run_id },
          );
        } else if (input.status === "failed") {
          await t.none(
            `UPDATE run SET failed_tasks = failed_tasks + 1 WHERE id = $(run_id)`,
            { run_id: currentTask.run_id },
          );
        }
      }

      logger.info("Updated task", { id, orgId: ctx.orgId, updates: Object.keys(input) });

      return success(mapTaskFromDb(row));
    });
  } catch (error) {
    logger.error("Failed to update task", { error, id, orgId: ctx.orgId, input });
    return failure(error as Error);
  }
}
