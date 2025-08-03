import { Result, success, failure } from './result.js';
import type { ForemanConfig, RedisConfig, QueueConfig, TaskHandler, WorkerOptions, Logger } from './types.js';
import type { CreateTaskInput } from './api-types.js';
import { getRedisConfig, getQueueConfig } from './config.js';
import { enqueueTask } from './queue.js';
import { createWorker } from './worker.js';
import { getTaskStatus } from './api.js';

const noOpLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

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
  const logger = config.logger || noOpLogger;

  // Fetch configurations
  const redisResult = await getRedisConfig(config, logger);
  if (!redisResult.success) {
    logger.error('Failed to fetch Redis config', { error: redisResult.error });
    throw redisResult.error;
  }
  
  const queueResult = await getQueueConfig(config, logger);
  if (!queueResult.success) {
    logger.error('Failed to fetch queue config', { error: queueResult.error });
    throw queueResult.error;
  }
  
  const redisConfig = redisResult.data;
  const serverQueueConfig = queueResult.data;
  
  // Merge client-provided queue names with server defaults
  const queueConfig: QueueConfig = {
    taskQueue: config.queues?.taskQueue || serverQueueConfig.taskQueue,
    resultQueue: config.queues?.resultQueue || serverQueueConfig.resultQueue
  };
  
  logger.info('Foreman client initialized', {
    endpoint: config.endpoint,
    redis: { host: redisConfig.host, port: redisConfig.port },
    queues: queueConfig,
    customQueues: config.queues ? true : false
  });
  
  return {
    redisConfig,
    queueConfig,
    
    enqueueTask: async (task) => {
      return enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task,
        logger,
      });
    },
    
    createWorker: async (handlers, options) => {
      return createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers,
        options,
        logger
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
  const logger = config.logger || noOpLogger;
  try {
    // Initialize client
    const initialized = await initializeForemanClient(config);
    const { redisConfig, queueConfig } = initialized;
    
    // Create client interface
    const client = {
      enqueueTask: async (task: CreateTaskInput & { priority?: number; delay?: number }) => {
        return enqueueTask({
          foremanConfig: config,
          redisConfig,
          queueConfig,
          task,
          logger,
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
