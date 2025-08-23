import { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@codespin/foreman-logger";
import { createContext } from "../create-context.js";
import { updateRunDataTags } from "../../domain/run-data/update-run-data-tags.js";

const logger = createLogger("foreman:handlers:run-data:update-tags");

// Validation schema
export const updateRunDataTagsSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
});

/**
 * PATCH /api/v1/runs/:runId/data/:dataId/tags - Update tags on a run data entry
 */
export async function updateRunDataTagsHandler(
  req: Request<{ runId: string; dataId: string }>,
  res: Response,
): Promise<void> {
  try {
    const { dataId } = req.params;
    const input = updateRunDataTagsSchema.parse(req.body);
    const ctx = createContext(req);

    const result = await updateRunDataTags(
      ctx,
      dataId!,
      req.auth!.orgId,
      input,
    );

    if (!result.success) {
      res.status(404).json({ error: result.error.message });
      return;
    }

    res.json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
      return;
    }
    logger.error("Failed to update run data tags", {
      error,
      dataId: req.params.dataId,
    });
    res.status(500).json({ error: "Internal server error" });
  }
}
