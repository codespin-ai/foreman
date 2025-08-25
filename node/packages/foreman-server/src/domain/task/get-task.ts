import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { DataContext } from "../data-context.js";
import type { Task, TaskDbRow } from "../../types.js";
import { mapTaskFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:task");

/**
 * Get a task by ID
 *
 * @param ctx - Data context containing database connection and orgId
 * @param id - Task ID
 * @returns Result containing the task or an error
 */
export async function getTask(
  ctx: DataContext,
  id: string,
): Promise<Result<Task, Error>> {
  try {
    // RLS will handle org filtering automatically
    const row = await ctx.db.oneOrNone<TaskDbRow>(
      `SELECT * FROM task WHERE id = $(id)`,
      { id },
    );

    if (!row) {
      return failure(new Error(`Task not found: ${id}`));
    }

    return success(mapTaskFromDb(row));
  } catch (error) {
    logger.error("Failed to get task", { error, id, orgId: ctx.orgId });
    return failure(error as Error);
  }
}
