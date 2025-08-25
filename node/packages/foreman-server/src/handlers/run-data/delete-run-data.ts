import { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@codespin/foreman-logger";
import { createContext } from "../create-context.js";
import { deleteRunData } from "../../domain/run-data/delete-run-data.js";

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

    const result = await deleteRunData(ctx, {
      runId: runId!,
      key: queryParams.key,
      id: queryParams.id,
    });

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
    logger.error("Failed to delete run data", { error });
    res.status(500).json({ error: "Internal server error" });
  }
}
