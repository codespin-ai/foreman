import { Result, success, failure } from "@codespin/foreman-core";
import { createLogger } from "@codespin/foreman-logger";
import type { Database } from "@codespin/foreman-db";
import type { RunData, RunDataDbRow } from "../../types.js";
import { mapRunDataFromDb } from "../../mappers.js";

const logger = createLogger("foreman:domain:run-data");

export interface UpdateRunDataTagsInput {
  add?: string[];
  remove?: string[];
}

/**
 * Update tags on a run data entry
 *
 * @param db - Database connection
 * @param dataId - Run data entry ID
 * @param orgId - Organization ID for access control
 * @param input - Tags to add/remove
 * @returns Result containing the updated run data or an error
 */
export async function updateRunDataTags(
  db: Database,
  dataId: string,
  orgId: string,
  input: UpdateRunDataTagsInput,
): Promise<Result<RunData, Error>> {
  try {
    return await db.tx(async (t) => {
      // Verify data entry exists and belongs to org
      const check = await t.oneOrNone<{ tags: string[] }>(
        `SELECT rd.tags
         FROM run_data rd
         JOIN run r ON r.id = rd.run_id
         WHERE rd.id = $(dataId) 
           AND r.org_id = $(orgId)`,
        { dataId, orgId },
      );

      if (!check) {
        return failure(new Error(`Run data not found: ${dataId}`));
      }

      let newTags = [...check.tags];

      // Remove tags first (in case of duplicates)
      if (input.remove && input.remove.length > 0) {
        newTags = newTags.filter((tag) => !input.remove!.includes(tag));
      }

      // Add new tags
      if (input.add && input.add.length > 0) {
        // Only add tags that don't already exist
        const tagsToAdd = input.add.filter((tag) => !newTags.includes(tag));
        newTags.push(...tagsToAdd);
      }

      // Update the tags
      const row = await t.one<RunDataDbRow>(
        `UPDATE run_data
         SET tags = $(tags),
             updated_at = NOW()
         WHERE id = $(dataId)
         RETURNING *`,
        { dataId, tags: newTags },
      );

      logger.info("Updated run data tags", {
        dataId,
        added: input.add?.length || 0,
        removed: input.remove?.length || 0,
      });

      return success(mapRunDataFromDb(row));
    });
  } catch (error) {
    logger.error("Failed to update run data tags", { error, dataId, orgId });
    return failure(error as Error);
  }
}
