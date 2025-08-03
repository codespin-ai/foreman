/**
 * Task queue operations using BullMQ
 */

import { Queue } from 'bullmq';
import { Result, success, failure } from './result.js';
import type { ForemanConfig, RedisConfig, QueueConfig, Logger } from './types.js';
import type { CreateTaskInput } from './api-types.js';
import { createTask } from './api.js';

// Cache queue instances
const queueCache: Map<string, Queue> = new Map();

/**
 * Get or create a queue instance
 */
async function getQueue(
  queueName: string,
  redisConfig: RedisConfig,
  logger: Logger,
): Promise<Queue> {
  const cacheKey = `${queueName}:${redisConfig.host}:${redisConfig.port}`;
  
  let queue = queueCache.get(cacheKey);
  if (!queue) {
    const connection = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db
    };
    
    queue = new Queue(queueName, { connection });
    queueCache.set(cacheKey, queue);
    logger.debug('Created new queue instance', { queueName, host: redisConfig.host });
  }
  
  return queue;
}

/**
 * Enqueue a single task
 */
export async function enqueueTask(params: {
  foremanConfig: ForemanConfig;
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  task: CreateTaskInput & {
    priority?: number;
    delay?: number;
  };
  logger: Logger;
}): Promise<Result<{ taskId: string }, Error>> {
  try {
    // First, create the task in Foreman DB
    const createResult = await createTask(params.foremanConfig, params.task);
    if (!createResult.success) {
      return createResult;
    }
    
    const taskId = createResult.data.id;
    
    // Then enqueue to BullMQ
    const queue = await getQueue(params.queueConfig.taskQueue, params.redisConfig, params.logger);
    
    const job = await queue.add(
      params.task.type,
      {
        taskId,
        runId: params.task.runId,
        type: params.task.type,
        inputData: params.task.inputData,
        metadata: params.task.metadata
      },
      {
        priority: params.task.priority,
        delay: params.task.delay,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: params.task.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    );
    
    params.logger.info('Task enqueued', { 
      taskId, 
      jobId: job.id, 
      type: params.task.type,
      queueName: params.queueConfig.taskQueue 
    });
    
    return success({ taskId });
  } catch (error) {
    params.logger.error('Failed to enqueue task', { error, task: params.task });
    return failure(error as Error);
  }
}

/**
 * Enqueue multiple tasks
 */
export async function enqueueTasks(params: {
  foremanConfig: ForemanConfig;
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  tasks: Array<CreateTaskInput & {
    priority?: number;
    delay?: number;
  }>;
  logger: Logger;
}): Promise<Result<{ taskIds: string[] }, Error>> {
  const taskIds: string[] = [];
  const errors: Error[] = [];
  
  // Process tasks in parallel with concurrency limit
  const concurrency = 10;
  for (let i = 0; i < params.tasks.length; i += concurrency) {
    const batch = params.tasks.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(task => enqueueTask({
        foremanConfig: params.foremanConfig,
        redisConfig: params.redisConfig,
        queueConfig: params.queueConfig,
        task,
        logger: params.logger,
      }))
    );
    
    for (const result of results) {
      if (result.success) {
        taskIds.push(result.data.taskId);
      } else {
        errors.push(result.error);
      }
    }
  }
  
  if (errors.length > 0) {
    params.logger.error('Some tasks failed to enqueue', { 
      successCount: taskIds.length, 
      errorCount: errors.length 
    });
    return failure(new Error(`Failed to enqueue ${errors.length} tasks`));
  }
  
  params.logger.info('All tasks enqueued', { count: taskIds.length });
  return success({ taskIds });
}

/**
 * Close all queue connections
 */
export async function closeQueues(logger: Logger): Promise<void> {
  const queues = Array.from(queueCache.values());
  await Promise.all(queues.map(queue => queue.close()));
  queueCache.clear();
  logger.debug('All queue connections closed');
}

/**
 * Clear queue cache
 */
export function clearQueueCache(logger: Logger): void {
  queueCache.clear();
  logger.debug('Queue cache cleared');
}

