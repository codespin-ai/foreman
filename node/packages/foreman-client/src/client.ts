/**
 * High-level Foreman client functions
 */

import { Result, success, failure } from '@codespin/foreman-core';
import { createLogger } from '@codespin/foreman-logger';
import type { ForemanConfig, RedisConfig, QueueConfig, TaskHandler, WorkerOptions } from './types.js';
import type { CreateTaskInput } from './api-types.js';
import { getRedisConfig, getQueueConfig } from './config.js';
import { enqueueTask } from './queue.js';
import { createWorker } from './worker.js';
import { getTaskStatus } from './api.js';

const logger = createLogger('foreman-client');

/**
 * Initialize Foreman client with automatic config fetching
 * @throws Error if initialization fails
 */
export async function initializeForemanClient(
  config: ForemanConfig
): Promise<{
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  enqueueTask: (task: CreateTaskInput & { priority?: number; delay?: number }) => Promise<Result<{ taskId: string }, Error>>;
  createWorker: (handlers: Record<string, TaskHandler>, options?: WorkerOptions) => Promise<{
    start: () => Promise<void>;
    stop: () => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
  }>;
}> {
  // Fetch configurations
  const redisResult = await getRedisConfig(config);
  if (!redisResult.success) {
    logger.error('Failed to fetch Redis config', { error: redisResult.error });
    throw redisResult.error;
  }
  
  const queueResult = await getQueueConfig(config);
  if (!queueResult.success) {
    logger.error('Failed to fetch queue config', { error: queueResult.error });
    throw queueResult.error;
  }
  
  const redisConfig = redisResult.data;
  const queueConfig = queueResult.data;
  
  logger.info('Foreman client initialized', {
    endpoint: config.endpoint,
    redis: { host: redisConfig.host, port: redisConfig.port },
    queues: queueConfig
  });
  
  return {
    redisConfig,
    queueConfig,
    
    enqueueTask: async (task) => {
      return enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task
      });
    },
    
    createWorker: async (handlers, options) => {
      return createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers,
        options
      });
    }
  };
}

/**
 * Execute an operation with Foreman client
 */
export async function withForemanClient<T>(
  config: ForemanConfig,
  operation: (client: {
    enqueueTask: (task: CreateTaskInput & { priority?: number; delay?: number }) => Promise<Result<{ taskId: string }, Error>>;
    getTaskStatus: (taskId: string) => Promise<Result<string, Error>>;
  }) => Promise<T>
): Promise<Result<T, Error>> {
  try {
    // Initialize client
    const { redisConfig, queueConfig } = await initializeForemanClient(config);
    
    // Create client interface
    const client = {
      enqueueTask: async (task: CreateTaskInput & { priority?: number; delay?: number }) => {
        return enqueueTask({
          foremanConfig: config,
          redisConfig,
          queueConfig,
          task
        });
      },
      
      getTaskStatus: async (taskId: string) => {
        return getTaskStatus({
          foremanConfig: config,
          taskId
        });
      }
    };
    
    // Execute operation
    const result = await operation(client);
    return success(result);
    
  } catch (error) {
    logger.error('Operation failed', { error });
    return failure(error as Error);
  }
}