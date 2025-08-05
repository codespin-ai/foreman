import { Router } from 'express';
import type { Request, Response } from 'express';
import { createLogger } from '@codespin/foreman-logger';
import { authenticate } from '../middleware/auth-simple.js';

const logger = createLogger('foreman:routes:config');

export const configRouter = Router();

// Apply authentication to all config routes
configRouter.use(authenticate);

/**
 * GET /api/v1/config
 * Get configuration needed by clients (e.g., Redis config for BullMQ)
 */
configRouter.get('/', (_req: Request, res: Response) => {
  try {
    // Redis configuration from environment
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined
    };

    // Queue names configuration
    const queueConfig = {
      taskQueue: process.env.TASK_QUEUE_NAME || 'foreman:tasks',
      resultQueue: process.env.RESULT_QUEUE_NAME || 'foreman:results'
    };

    // Only include non-sensitive configuration
    const config = {
      version: process.env.FOREMAN_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      redis: redisConfig,
      queues: queueConfig
    };

    logger.debug('Configuration requested', { 
      hasAuth: !!_req.headers.authorization,
      ip: _req.ip 
    });

    res.json(config);
  } catch (error) {
    logger.error('Failed to get configuration', { error });
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
});

/**
 * GET /api/v1/config/redis
 * Get only Redis configuration
 */
configRouter.get('/redis', (_req: Request, res: Response) => {
  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined
    };

    res.json(redisConfig);
  } catch (error) {
    logger.error('Failed to get Redis configuration', { error });
    res.status(500).json({ error: 'Failed to retrieve Redis configuration' });
  }
});

/**
 * GET /api/v1/config/queues
 * Get only queue names configuration
 */
configRouter.get('/queues', (_req: Request, res: Response) => {
  try {
    const queueConfig = {
      taskQueue: process.env.TASK_QUEUE_NAME || 'foreman:tasks',
      resultQueue: process.env.RESULT_QUEUE_NAME || 'foreman:results'
    };

    res.json(queueConfig);
  } catch (error) {
    logger.error('Failed to get queue configuration', { error });
    res.status(500).json({ error: 'Failed to retrieve queue configuration' });
  }
});