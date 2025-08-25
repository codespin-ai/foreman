import { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@codespin/foreman-logger";
import { createContext } from "../create-context.js";
import { listTasks } from "../../domain/task/list-tasks.js";

const logger = createLogger("foreman:handlers:tasks:list");

// Validation schema
export const listTasksSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  runId: z.string().uuid().optional(),
  status: z.string().optional(),
  sortBy: z
    .enum(["created_at", "started_at", "completed_at"])
    .default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GET /api/v1/tasks - List tasks
 */
export async function listTasksHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const params = listTasksSchema.parse(req.query);
    const ctx = createContext(req);

    const result = await listTasks(ctx, params);

    if (!result.success) {
      res.status(400).json({ error: result.error.message });
      return;
    }

    res.json({
      data: result.data.data,
      pagination: {
        total: result.data.total,
        limit: result.data.limit,
        offset: result.data.offset,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
      return;
    }
    logger.error("Failed to list tasks", { error });
    res.status(500).json({ error: "Internal server error" });
  }
}
