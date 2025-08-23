import { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@codespin/foreman-logger";
import { createContext } from "../create-context.js";
import { createTask } from "../../domain/task/create-task.js";

const logger = createLogger("foreman:handlers:tasks:create");

// Validation schema
export const createTaskSchema = z.object({
  runId: z.string().uuid(),
  parentTaskId: z.string().uuid().optional(),
  type: z.string().min(1),
  inputData: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
  maxRetries: z.number().min(0).max(10).optional(),
});

/**
 * POST /api/v1/tasks - Create a new task
 */
export async function createTaskHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const input = createTaskSchema.parse(req.body);
    const ctx = createContext(req);

    const result = await createTask(ctx, req.auth!.orgId, {
      runId: input.runId,
      parentTaskId: input.parentTaskId,
      type: input.type,
      inputData: input.inputData,
      metadata: input.metadata,
      maxRetries: input.maxRetries,
    });

    if (!result.success) {
      // Return 404 if run or parent task not found
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
    logger.error("Failed to create task", { error });
    res.status(500).json({ error: "Internal server error" });
  }
}
