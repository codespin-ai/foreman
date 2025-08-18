import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { Database } from "@codespin/foreman-db";
import type { Task, TaskDbRow } from "../../types.js";
import { mapTaskFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:task");

/**
 * Get a task by ID
 *
 * @param db - Database connection
 * @param id - Task ID
 * @param orgId - Organization ID for access control
 * @returns Result containing the task or an error
 */
export async function getTask(
  db: Database,
  id: string,
  orgId: string,
): Promise<Result<Task, Error>> {
  try {
    const row = await db.oneOrNone<TaskDbRow>(
      `SELECT * FROM task WHERE id = $(id) AND org_id = $(orgId)`,
      { id, orgId },
    );

    if (!row) {
      return failure(new Error(`Task not found: ${id}`));
    }

    return success(mapTaskFromDb(row));
  } catch (error) {
    logger.error("Failed to get task", { error, id, orgId });
    return failure(error as Error);
  }
}
