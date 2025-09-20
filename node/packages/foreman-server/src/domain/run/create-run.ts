import { v4 as uuidv4 } from "uuid";
import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import { sql } from "@codespin/foreman-db";
import type { DataContext } from "../data-context.js";
import type { Run, RunDbRow, CreateRunInput } from "../../types.js";
import { mapRunFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run");

/**
 * Create a new run
 *
 * @param ctx - Data context containing database connection and orgId
 * @param input - Run creation parameters
 * @returns Result containing the created run or an error
 */
export async function createRun(
  ctx: DataContext,
  input: CreateRunInput,
): Promise<Result<Run, Error>> {
  try {
    if (!ctx.orgId) {
      throw new Error("Organization ID is required to create a run");
    }

    const id = uuidv4();
    const now = Date.now();

    const params = {
      id,
      org_id: ctx.orgId,
      status: "pending",
      input_data: input.inputData as Record<string, unknown>,
      metadata: input.metadata || null,
      total_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0,
      created_at: now,
      updated_at: now,
    };

    const row = await ctx.db.one<RunDbRow>(
      `${sql.insert("run", params)} RETURNING *`,
      params,
    );

    logger.info("Created run", { id, orgId: ctx.orgId });

    return success(mapRunFromDb(row));
  } catch (error) {
    logger.error("Failed to create run", { error, input });
    return failure(error as Error);
  }
}
