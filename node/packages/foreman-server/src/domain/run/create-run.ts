import { v4 as uuidv4 } from "uuid";
import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { Database } from "@codespin/foreman-db";
import { sql } from "@codespin/foreman-db";
import type { Run, RunDbRow, CreateRunInput } from "../../types.js";
import { mapRunFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run");

/**
 * Create a new run
 *
 * @param db - Database connection
 * @param input - Run creation parameters
 * @returns Result containing the created run or an error
 */
export async function createRun(
  db: Database,
  input: CreateRunInput,
): Promise<Result<Run, Error>> {
  try {
    const id = uuidv4();

    const params = {
      id,
      org_id: input.orgId,
      status: "pending",
      input_data: input.inputData as Record<string, unknown>,
      metadata: input.metadata || null,
      created_at: new Date(),
    };

    const row = await db.one<RunDbRow>(
      `${sql.insert("run", params)} RETURNING *`,
      params,
    );

    logger.info("Created run", { id, orgId: input.orgId });

    return success(mapRunFromDb(row));
  } catch (error) {
    logger.error("Failed to create run", { error, input });
    return failure(error as Error);
  }
}
