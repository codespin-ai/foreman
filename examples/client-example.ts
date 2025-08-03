/**
 * Example of using the Foreman client API
 */

import { 
  initializeForemanClient, 
  createRun, 
  enqueueTask,
  createWorker,
  waitForTask,
  createRunData,
  queryRunData
} from '@codespin/foreman-client';

async function main() {
  // 1. Initialize the client
  const foremanConfig = {
    endpoint: 'http://localhost:3000',
    apiKey: 'your-api-key',
    queues: {  // Optional: use custom queue names
      taskQueue: 'example:tasks',
      resultQueue: 'example:results'
    }
  };

  // Option 1: Initialize and get configured functions
  const client = await initializeForemanClient(foremanConfig);
  const { redisConfig, queueConfig, enqueueTask: enqueueFn, createWorker: createWorkerFn } = client;

  // 2. Create a run
  const runResult = await createRun(foremanConfig, {
    inputData: { workflowType: 'data-processing' },
    metadata: { source: 'api' }
  });

  if (!runResult.success) {
    console.error('Failed to create run:', runResult.error);
    return;
  }

  const run = runResult.data;
  console.log('Created run:', run.id);

  // 3. Enqueue some tasks
  const task1Result = await enqueueFn({
    runId: run.id,
    type: 'process-data',
    inputData: { dataId: 'dataset-1', operation: 'transform' },
    priority: 10
  });

  const task2Result = await enqueueTask({
    foremanConfig,
    redisConfig,
    queueConfig,
    task: {
      runId: run.id,
      type: 'validate-data',
      inputData: { dataId: 'dataset-1' },
      priority: 5,
      delay: 5000 // Delay 5 seconds
    }
  });

  console.log('Enqueued tasks:', task1Result.data?.taskId, task2Result.data?.taskId);

  // 4. Create a worker to process tasks
  const worker = await createWorkerFn({
    'process-data': async (task) => {
      console.log('Processing data task:', task.id);
      
      // Store intermediate results
      await createRunData(foremanConfig, task.runId, {
        taskId: task.id,
        key: 'processing-status',
        value: { status: 'in-progress', timestamp: Date.now() },
        tags: ['status', 'process-data']
      });

      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Store final results
      await createRunData(foremanConfig, task.runId, {
        taskId: task.id,
        key: 'processing-result',
        value: { processed: true, records: 1000 },
        tags: ['result', 'process-data']
      });

      return { success: true, processed: 1000 };
    },

    'validate-data': async (task) => {
      console.log('Validating data task:', task.id);
      
      // Query previous results
      const resultsQuery = await queryRunData(foremanConfig, task.runId, {
        tags: ['result'],
        keyStartsWith: ['processing-']
      });

      if (resultsQuery.success) {
        console.log('Found previous results:', resultsQuery.data.data.length);
      }

      return { valid: true, issues: [] };
    }
  }, {
    concurrency: 2,
    maxRetries: 3
  });

  // Start the worker
  await worker.start();
  console.log('Worker started');

  // 5. Wait for tasks to complete
  if (task1Result.success) {
    const result = await waitForTask({
      foremanConfig,
      taskId: task1Result.data.taskId,
      timeout: 30000,
      pollInterval: 1000
    });

    if (result.success) {
      console.log('Task completed:', result.data);
    }
  }

  // 6. Query run data
  const allDataResult = await queryRunData(foremanConfig, run.id, {
    includeAll: true
  });

  if (allDataResult.success) {
    console.log('Run data entries:', allDataResult.data.data.length);
    allDataResult.data.data.forEach(entry => {
      console.log(`- ${entry.key}:`, entry.value, `(tags: ${entry.tags.join(', ')})`);
    });
  }

  // Stop the worker
  await worker.stop();
  console.log('Worker stopped');
}

// Run the example
main().catch(console.error);