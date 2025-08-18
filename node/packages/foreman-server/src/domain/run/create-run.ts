import { v4 as uuidv4 } from "uuid";
import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { Database } from "@codespin/foreman-db";
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

    const row = await db.one<RunDbRow>(
      `INSERT INTO run (id, org_id, status, input_data, metadata, created_at)
       VALUES ($(id), $(orgId), $(status), $(inputData), $(metadata), NOW())
       RETURNING *`,
      {
        id,
        orgId: input.orgId,
        status: "pending",
        inputData: input.inputData as Record<string, unknown>,
        metadata: input.metadata || null,
      },
    );

    logger.info("Created run", { id, orgId: input.orgId });

    return success(mapRunFromDb(row));
  } catch (error) {
    logger.error("Failed to create run", { error, input });
    return failure(error as Error);
  }
}
