import { Request, Response } from "express";
import { createLogger } from "@codespin/foreman-logger";

const logger = createLogger("foreman:handlers:config:queues");

/**
 * GET /api/v1/config/queues
 * Get only queue names configuration
 */
export async function getQueuesConfigHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const queueConfig = {
      taskQueue: process.env.TASK_QUEUE_NAME || "foreman:tasks",
      resultQueue: process.env.RESULT_QUEUE_NAME || "foreman:results",
    };

    res.json(queueConfig);
  } catch (error) {
    logger.error("Failed to get queue configuration", { error });
    res.status(500).json({ error: "Failed to retrieve queue configuration" });
  }
}
