import { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@codespin/foreman-logger";
import { getDb } from "@codespin/foreman-db";
import { updateTask } from "../../domain/task/update-task.js";

const logger = createLogger("foreman:handlers:tasks:update");

// Validation schema
export const updateTaskSchema = z.object({
  status: z
    .enum([
      "pending",
      "queued",
      "running",
      "completed",
      "failed",
      "cancelled",
      "retrying",
    ])
    .optional(),
  outputData: z.unknown().optional(),
  errorData: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  queueJobId: z.string().optional(),
});

/**
 * PATCH /api/v1/tasks/:id - Update a task
 */
export async function updateTaskHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const input = updateTaskSchema.parse(req.body);
    const db = getDb();

    const result = await updateTask(db, req.params.id!, req.auth!.orgId, input);

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
    logger.error("Failed to update task", { error, id: req.params.id });
    res.status(500).json({ error: "Internal server error" });
  }
}
