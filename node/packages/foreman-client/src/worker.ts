/**
 * Worker creation and management using BullMQ
 */


import { Worker, Job } from 'bullmq';
import type { ForemanConfig, RedisConfig, QueueConfig, TaskHandler, WorkerOptions, WorkerControls, Logger } from './types.js';
import { updateTask } from './api.js';

/**
 * Create a worker that processes tasks
 */
export async function createWorker(params: {
  foremanConfig: ForemanConfig;
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  handlers: Record<string, TaskHandler>;
  options?: WorkerOptions;
  logger: Logger;
}): Promise<WorkerControls> {
  const connection = {
    host: params.redisConfig.host,
    port: params.redisConfig.port,
    password: params.redisConfig.password,
    db: params.redisConfig.db
  };

  const worker = new Worker(
    params.queueConfig.taskQueue,
    async (job: Job) => {
      const { taskId, type, runId, inputData, metadata } = job.data;
      
      params.logger.info('Processing task', { taskId, type, runId });
      
      try {
        // Update task status to running
        await updateTask(params.foremanConfig, taskId, {
          status: 'running',
          queueJobId: job.id
        });
        
        // Get handler for task type
        const handler = params.handlers[type];
        if (!handler) {
          throw new Error(`No handler found for task type: ${type}`);
        }
        
        // Execute handler
        const result = await handler({
          id: taskId,
          type,
          runId,
          inputData,
          metadata
        });
        
        // Update task as completed
        await updateTask(params.foremanConfig, taskId, {
          status: 'completed',
          outputData: result
        });
        
        params.logger.info('Task completed', { taskId, type });
        return result;
        
      } catch (error) {
        params.logger.error('Task failed', { taskId, type, error });
        
        // Update task as failed or retrying
        const isLastAttempt = job.attemptsMade >= (params.options?.maxRetries || 3);
        await updateTask(params.foremanConfig, taskId, {
          status: isLastAttempt ? 'failed' : 'retrying',
          errorData: error instanceof Error ? { message: error.message, stack: error.stack } : error
        });
        
        throw error;
      }
    },
    {
      connection,
      concurrency: params.options?.concurrency || 5,
      autorun: false // Don't start automatically
    }
  );

  // Set up event handlers
  worker.on('completed', (job) => {
    params.logger.debug('Job completed', { jobId: job.id, taskId: job.data.taskId });
  });

  worker.on('failed', (job, err) => {
    params.logger.error('Job failed', { jobId: job?.id, taskId: job?.data.taskId, error: err });
  });

  worker.on('error', (err) => {
    params.logger.error('Worker error', { error: err });
  });

  // Return control functions
  return {
    start: async () => {
      await worker.run();
      params.logger.info('Worker started', { 
        queue: params.queueConfig.taskQueue,
        concurrency: params.options?.concurrency || 5 
      });
    },
    
    stop: async () => {
      await worker.close();
      params.logger.info('Worker stopped');
    },
    
    pause: async () => {
      await worker.pause();
      params.logger.info('Worker paused');
    },
    
    resume: async () => {
      await worker.resume();
      params.logger.info('Worker resumed');
    }
  };
}

/**
 * Create a worker for a single task type
 */
export async function createTaskWorker(params: {
  foremanConfig: ForemanConfig;
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  taskType: string;
  handler: TaskHandler;
  options?: WorkerOptions;
  logger: Logger;
}): Promise<WorkerControls> {
  return createWorker({
    foremanConfig: params.foremanConfig,
    redisConfig: params.redisConfig,
    queueConfig: params.queueConfig,
    handlers: {
      [params.taskType]: params.handler
    },
    options: params.options,
    logger: params.logger
  });
}

/**
 * Create a worker for multiple task types
 */
export async function createMultiTaskWorker(params: {
  foremanConfig: ForemanConfig;
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  handlers: Record<string, TaskHandler>;
  options?: WorkerOptions;
  logger: Logger;
}): Promise<WorkerControls> {
  return createWorker({
    foremanConfig: params.foremanConfig,
    redisConfig: params.redisConfig,
    queueConfig: params.queueConfig,
    handlers: params.handlers,
    options: params.options,
    logger: params.logger
  });
}


