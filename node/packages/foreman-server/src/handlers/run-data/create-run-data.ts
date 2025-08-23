import { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@codespin/foreman-logger";
import { createContext } from "../create-context.js";
import { createRunData } from "../../domain/run-data/create-run-data.js";

const logger = createLogger("foreman:handlers:run-data:create");

// Validation schema
export const createRunDataSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.unknown(),
  taskId: z.string().uuid(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * POST /api/v1/runs/:runId/data - Create run data entry
 */
export async function createRunDataHandler(
  req: Request<{ runId: string }>,
  res: Response,
): Promise<void> {
  try {
    const input = createRunDataSchema.parse(req.body);
    const { runId } = req.params;
    const ctx = createContext(req);

    const result = await createRunData(ctx, req.auth!.orgId, {
      runId: runId!,
      key: input.key,
      value: input.value,
      taskId: input.taskId,
      tags: input.tags,
      metadata: input.metadata,
    });

    if (!result.success) {
      // Return 404 if run or task not found
      if (result.error.message.includes("not found")) {
        res.status(404).json({ error: result.error.message });
        return;
      }
      res.status(400).json({ error: result.error.message });
      return;
    }

    res.status(201).json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
      return;
    }
    logger.error("Failed to create run data", { error });
    res.status(500).json({ error: "Internal server error" });
  }
}
