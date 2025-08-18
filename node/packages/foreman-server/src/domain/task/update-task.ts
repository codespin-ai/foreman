import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { Database } from "@codespin/foreman-db";
import type { Task, TaskDbRow, UpdateTaskInput } from "../../types.js";
import { mapTaskFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:task");

/**
 * Update a task
 *
 * @param db - Database connection
 * @param id - Task ID
 * @param orgId - Organization ID for access control
 * @param input - Update parameters
 * @returns Result containing the updated task or an error
 */
export async function updateTask(
  db: Database,
  id: string,
  orgId: string,
  input: UpdateTaskInput,
): Promise<Result<Task, Error>> {
  try {
    return await db.tx(async (t) => {
      const updates: string[] = [];
      const params: Record<string, unknown> = { id, orgId };

      if (input.status !== undefined) {
        updates.push("status = $(status)");
        params.status = input.status;

        // Set queued_at when transitioning to queued
        if (input.status === "queued") {
          updates.push("queued_at = COALESCE(queued_at, NOW())");
        }

        // Set started_at when transitioning to running
        if (input.status === "running") {
          updates.push("started_at = COALESCE(started_at, NOW())");
        }

        // Set completed_at and calculate duration when transitioning to terminal state
        if (["completed", "failed", "cancelled"].includes(input.status)) {
          updates.push("completed_at = NOW()");
          updates.push(
            "duration_ms = EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at))) * 1000",
          );
        }

        // Increment retry count when retrying
        if (input.status === "retrying") {
          updates.push("retry_count = retry_count + 1");
        }
      }

      if (input.outputData !== undefined) {
        updates.push("output_data = $(outputData)");
        params.outputData = input.outputData as Record<string, unknown>;
      }

      if (input.errorData !== undefined) {
        updates.push("error_data = $(errorData)");
        params.errorData = input.errorData as Record<string, unknown>;
      }

      if (input.metadata !== undefined) {
        updates.push("metadata = $(metadata)");
        params.metadata = input.metadata as Record<string, unknown>;
      }

      if (input.queueJobId !== undefined) {
        updates.push("queue_job_id = $(queueJobId)");
        params.queueJobId = input.queueJobId;
      }

      if (updates.length === 0) {
        return failure(new Error("No fields to update"));
      }

      // Get current task to check run_id
      const currentTask = await t.oneOrNone<{ run_id: string; status: string }>(
        `SELECT run_id, status FROM task WHERE id = $(id) AND org_id = $(orgId)`,
        { id, orgId },
      );

      if (!currentTask) {
        return failure(new Error(`Task not found: ${id}`));
      }

      const row = await t.one<TaskDbRow>(
        `UPDATE task 
         SET ${updates.join(", ")}
         WHERE id = $(id) AND org_id = $(orgId)
         RETURNING *`,
        params,
      );

      // Update run counters if status changed to terminal state
      if (
        input.status &&
        ["completed", "failed"].includes(input.status) &&
        !["completed", "failed", "cancelled"].includes(currentTask.status)
      ) {
        if (input.status === "completed") {
          await t.none(
            `UPDATE run SET completed_tasks = completed_tasks + 1 WHERE id = $(runId)`,
            { runId: currentTask.run_id },
          );
        } else if (input.status === "failed") {
          await t.none(
            `UPDATE run SET failed_tasks = failed_tasks + 1 WHERE id = $(runId)`,
            { runId: currentTask.run_id },
          );
        }
      }

      logger.info("Updated task", { id, orgId, updates: Object.keys(input) });

      return success(mapTaskFromDb(row));
    });
  } catch (error) {
    logger.error("Failed to update task", { error, id, orgId, input });
    return failure(error as Error);
  }
}
