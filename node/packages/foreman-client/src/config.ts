/**
 * Configuration fetching functions
 */

import { Result, success, failure } from "./result.js";
import type {
  ForemanConfig,
  RedisConfig,
  QueueConfig,
  Logger,
} from "./types.js";
import { httpRequest } from "./http-client.js";

// Cache configuration for 5 minutes
const CONFIG_CACHE_TTL = 5 * 60 * 1000;
let configCache: {
  redis?: { data: RedisConfig; timestamp: number };
  queues?: { data: QueueConfig; timestamp: number };
} = {};

/**
 * Fetch Redis configuration from Foreman server
 */
export async function getRedisConfig(
  config: ForemanConfig,
  logger: Logger,
): Promise<Result<RedisConfig, Error>> {
  try {
    // Check cache
    const cached = configCache.redis;
    if (cached && Date.now() - cached.timestamp < CONFIG_CACHE_TTL) {
      logger.debug("Using cached Redis config");
      return success(cached.data);
    }

    // Fetch from server
    const result = await httpRequest<RedisConfig>({
      method: "GET",
      url: `${config.endpoint}/api/v1/config/redis`,
      headers: config.apiKey
        ? {
            Authorization: `Bearer ${config.apiKey}`,
          }
        : undefined,
      timeout: config.timeout,
    });

    if (!result.success) {
      return result;
    }

    // Cache the result
    configCache.redis = {
      data: result.data,
      timestamp: Date.now(),
    };

    logger.info("Fetched Redis config", {
      host: result.data.host,
      port: result.data.port,
    });
    return success(result.data);
  } catch (error) {
    logger.error("Failed to fetch Redis config", { error });
    return failure(error as Error);
  }
}

/**
 * Fetch queue names configuration from Foreman server
 */
export async function getQueueConfig(
  config: ForemanConfig,
  logger: Logger,
): Promise<Result<QueueConfig, Error>> {
  try {
    // Check cache
    const cached = configCache.queues;
    if (cached && Date.now() - cached.timestamp < CONFIG_CACHE_TTL) {
      logger.debug("Using cached queue config");
      return success(cached.data);
    }

    // Fetch from server
    const result = await httpRequest<QueueConfig>({
      method: "GET",
      url: `${config.endpoint}/api/v1/config/queues`,
      headers: config.apiKey
        ? {
            Authorization: `Bearer ${config.apiKey}`,
          }
        : undefined,
      timeout: config.timeout,
    });

    if (!result.success) {
      return result;
    }

    // Cache the result
    configCache.queues = {
      data: result.data,
      timestamp: Date.now(),
    };

    logger.info("Fetched queue config", result.data);
    return success(result.data);
  } catch (error) {
    logger.error("Failed to fetch queue config", { error });
    return failure(error as Error);
  }
}

/**
 * Clear configuration cache
 */
export function clearConfigCache(logger: Logger): void {
  configCache = {};
  logger.debug("Configuration cache cleared");
}
