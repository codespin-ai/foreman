import { Request, Response } from "express";
import { createLogger } from "@codespin/foreman-logger";

const logger = createLogger("foreman:handlers:config:redis");

/**
 * GET /api/v1/config/redis
 * Get only Redis configuration
 */
export async function getRedisConfigHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined,
    };

    res.json(redisConfig);
  } catch (error) {
    logger.error("Failed to get Redis configuration", { error });
    res.status(500).json({ error: "Failed to retrieve Redis configuration" });
  }
}
