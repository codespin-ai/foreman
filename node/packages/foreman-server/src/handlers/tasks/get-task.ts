import { Request, Response } from "express";
import { createLogger } from "@codespin/foreman-logger";
import { createContext } from "../create-context.js";
import { getTask } from "../../domain/task/get-task.js";

const logger = createLogger("foreman:handlers:tasks:get");

/**
 * GET /api/v1/tasks/:id - Get a task by ID
 */
export async function getTaskHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const ctx = createContext(req);
    const result = await getTask(ctx, req.params.id!);

    if (!result.success) {
      res.status(404).json({ error: result.error.message });
      return;
    }

    res.json(result.data);
  } catch (error) {
    logger.error("Failed to get task", { error, id: req.params.id });
    res.status(500).json({ error: "Internal server error" });
  }
}
