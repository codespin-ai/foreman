import { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@codespin/foreman-logger";
import { createContext } from "../create-context.js";
import { createRun } from "../../domain/run/create-run.js";

const logger = createLogger("foreman:handlers:runs:create");

// Validation schema
export const createRunSchema = z.object({
  inputData: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * POST /api/v1/runs - Create a new run
 */
export async function createRunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const input = createRunSchema.parse(req.body);
    const ctx = createContext(req);

    const result = await createRun(ctx, {
      inputData: input.inputData,
      metadata: input.metadata,
    });

    if (!result.success) {
      res.status(400).json({ error: result.error.message });
      return;
    }

    res.status(201).json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
      return;
    }
    logger.error("Failed to create run", { error });
    res.status(500).json({ error: "Internal server error" });
  }
}
