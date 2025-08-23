import { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@codespin/foreman-logger";
import { createContext } from "../create-context.js";

const logger = createLogger("foreman:handlers:run-data:delete");

// Validation schema for query parameters
export const deleteRunDataSchema = z
  .object({
    key: z.string().optional(),
    id: z.string().uuid().optional(),
  })
  .refine((data) => data.key || data.id, {
    message: "Must provide either key or id parameter",
  });

/**
 * DELETE /api/v1/runs/:runId/data - Delete run data entries
 */
export async function deleteRunDataHandler(
  req: Request<{ runId: string }>,
  res: Response,
): Promise<void> {
  try {
    const { runId } = req.params;
    const queryParams = deleteRunDataSchema.parse(req.query);
    const ctx = createContext(req);
    const { db } = ctx;

    let deletedCount = 0;

    if (queryParams.id) {
      // Delete specific entry by ID
      const result = await db.result(
        `DELETE FROM run_data rd
         USING run r
         WHERE rd.id = $(id) 
           AND rd.run_id = r.id
           AND r.org_id = $(org_id)`,
        { id: queryParams.id, org_id: req.auth!.orgId },
      );
      deletedCount = result.rowCount;
    } else if (queryParams.key) {
      // Delete all entries for a key
      const result = await db.result(
        `DELETE FROM run_data rd
         USING run r
         WHERE rd.run_id = $(run_id)
           AND rd.key = $(key)
           AND rd.run_id = r.id
           AND r.org_id = $(org_id)`,
        { run_id: runId, key: queryParams.key, org_id: req.auth!.orgId },
      );
      deletedCount = result.rowCount;
    }

    if (deletedCount === 0) {
      res.status(404).json({ error: "No matching run data found" });
      return;
    }

    res.json({ deleted: deletedCount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
      return;
    }
    logger.error("Failed to delete run data", { error });
    res.status(500).json({ error: "Internal server error" });
  }
}
