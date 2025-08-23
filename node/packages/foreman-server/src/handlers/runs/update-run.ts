import { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@codespin/foreman-logger";
import { getDb } from "@codespin/foreman-db";
import { updateRun } from "../../domain/run/update-run.js";

const logger = createLogger("foreman:handlers:runs:update");

// Validation schema
export const updateRunSchema = z.object({
  status: z
    .enum(["pending", "running", "completed", "failed", "cancelled"])
    .optional(),
  outputData: z.unknown().optional(),
  errorData: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * PATCH /api/v1/runs/:id - Update a run
 */
export async function updateRunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const input = updateRunSchema.parse(req.body);
    const db = getDb();

    const result = await updateRun(db, req.params.id!, req.auth!.orgId, input);

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
    logger.error("Failed to update run", { error, id: req.params.id });
    res.status(500).json({ error: "Internal server error" });
  }
}
