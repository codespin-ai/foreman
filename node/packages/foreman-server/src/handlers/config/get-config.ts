import { Request, Response } from "express";
import { createLogger } from "@codespin/foreman-logger";

const logger = createLogger("foreman:handlers:config:get");

/**
 * GET /api/v1/config
 * Get configuration needed by clients (e.g., Redis config for BullMQ)
 */
export async function getConfigHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    // Redis configuration from environment
    const redisConfig = {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined,
    };

    // Queue names configuration
    const queueConfig = {
      taskQueue: process.env.TASK_QUEUE_NAME || "foreman:tasks",
      resultQueue: process.env.RESULT_QUEUE_NAME || "foreman:results",
    };

    // Only include non-sensitive configuration
    const config = {
      version: process.env.FOREMAN_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      redis: redisConfig,
      queues: queueConfig,
    };

    logger.debug("Configuration requested", {
      hasAuth: !!_req.headers.authorization,
      ip: _req.ip,
    });

    res.json(config);
  } catch (error) {
    logger.error("Failed to get configuration", { error });
    res.status(500).json({ error: "Failed to retrieve configuration" });
  }
}
