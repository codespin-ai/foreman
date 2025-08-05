# @codespin/foreman-client

Complete workflow orchestration SDK for Foreman that handles all queue operations internally.

## Features

- 🔧 **Automatic Configuration** - Fetches Redis/queue config from Foreman server
- 📦 **Complete SDK** - Handles both database and queue operations
- 🏃 **Worker Management** - Built-in BullMQ worker creation and management
- 🔄 **Task Lifecycle** - Full task enqueueing, execution, and status tracking
- 📊 **Run Data** - Store and query workflow data with tags
- 🎯 **Clean API** - Simple, composable functions

## Installation

```bash
npm install @codespin/foreman-client
```

## Quick Start

```typescript
import { 
  initializeForemanClient, 
  createRun,
  createRunData,
  queryRunData
} from '@codespin/foreman-client';

// Initialize client with default queue names from server
const config = {
  endpoint: 'http://localhost:3000',
  apiKey: 'your-api-key'
};

// Or override queue names
const configWithQueues = {
  endpoint: 'http://localhost:3000',
  apiKey: 'your-api-key',
  queues: {
    taskQueue: 'my-custom-tasks',
    resultQueue: 'my-custom-results'
  }
};

const client = await initializeForemanClient(config);
const { enqueueTask, createWorker } = client;

// Create a run
const run = await createRun(config, {
  inputData: { type: 'data-processing' }
});

// Enqueue a task
const task = await enqueueTask({
  runId: run.data.id,
  type: 'process',
  inputData: { dataId: '123' }
});

// Create a worker
const worker = await createWorker({
  'process': async (task) => {
    console.log('Processing:', task.inputData);
    return { success: true };
  }
});

await worker.start();
```

## Architecture

The foreman-client acts as a complete workflow SDK:

1. **Configuration** - Fetches Redis/queue config from Foreman server
2. **Task Management** - Creates tasks in PostgreSQL via Foreman API
3. **Queue Operations** - Enqueues jobs to Redis using BullMQ
4. **Worker Execution** - Provides BullMQ workers for task processing
5. **Status Updates** - Automatically updates task status during execution

## API Reference

### Types

```typescript
type ForemanConfig = {
  endpoint: string;
  apiKey?: string;
  timeout?: number;
  queues?: {
    taskQueue?: string;
    resultQueue?: string;
  };
};

type TaskHandler = (task: {
  id: string;
  type: string;
  runId: string;
  inputData: unknown;
  metadata?: Record<string, unknown>;
}) => Promise<unknown>;

type WorkerOptions = {
  concurrency?: number;
  maxRetries?: number;
  backoffDelay?: number;
};
```

### Core Functions

See the [API Documentation](../../docs/api-reference.md) for complete REST API reference.

## Examples

### Processing Pipeline

```typescript
// Initialize once
const client = await initializeForemanClient(config);
const { enqueueTask, createWorker } = client;

// Create a processing pipeline
const run = await createRun(config, {
  inputData: { pipeline: 'etl' }
});

// Enqueue tasks with dependencies
const extractTask = await enqueueTask({
  runId: run.data.id,
  type: 'extract',
  inputData: { source: 'database' }
});

const transformTask = await enqueueTask({
  runId: run.data.id,
  type: 'transform',
  inputData: { dependsOn: extractTask.taskId },
  delay: 5000 // Wait 5 seconds
});

// Create workers for each task type
const worker = await createWorker({
  'extract': async (task) => {
    const data = await fetchData(task.inputData.source);
    await createRunData(config, task.runId, {
      taskId: task.id,
      key: 'raw-data',
      value: data,
      tags: ['extracted', 'raw']
    });
    return { recordCount: data.length };
  },
  
  'transform': async (task) => {
    // Query previous results
    const rawData = await queryRunData(config, task.runId, {
      key: 'raw-data'
    });
    
    const transformed = transformData(rawData.data[0].value);
    await createRunData(config, task.runId, {
      taskId: task.id,
      key: 'transformed-data',
      value: transformed,
      tags: ['transformed', 'processed']
    });
    return { success: true };
  }
}, { concurrency: 10 });

await worker.start();
```

### Error Handling

```typescript
const worker = await createWorker({
  'risky-operation': async (task) => {
    try {
      const result = await riskyOperation(task.inputData);
      return { success: true, result };
    } catch (error) {
      // Log error details
      await createRunData(config, task.runId, {
        taskId: task.id,
        key: `error-${Date.now()}`,
        value: { 
          error: error.message, 
          stack: error.stack,
          input: task.inputData 
        },
        tags: ['error', task.type]
      });
      throw error; // Re-throw for retry logic
    }
  }
}, {
  maxRetries: 3,
  backoffDelay: 2000
});
```

## Best Practices

1. **Initialize Once** - Call `initializeForemanClient` once and reuse the client
2. **Handle Errors** - Always check `Result.success` before using data
3. **Tag Data** - Use tags for efficient data querying
4. **Set Concurrency** - Configure worker concurrency based on your workload
5. **Clean Shutdown** - Call `worker.stop()` for graceful shutdown

## Configuration Options

### Queue Names

By default, the client fetches queue names from the Foreman server. You can override these:

```typescript
const config = {
  endpoint: 'http://localhost:3000',
  apiKey: 'your-api-key',
  queues: {
    taskQueue: 'my-app:tasks',      // Default: from server config
    resultQueue: 'my-app:results'   // Default: from server config
  }
};
```

This is useful when:
- Running multiple applications with separate queues
- Testing with isolated queue names
- Implementing queue-based routing or priority systems

## Environment Variables

The client respects these environment variables when connecting to Foreman:

- `FOREMAN_ENDPOINT` - Default Foreman server URL
- `FOREMAN_API_KEY` - Default API key for authentication
- `FOREMAN_TIMEOUT` - Default request timeout in milliseconds

### Testing

- `VERBOSE_TESTS` - Set to `true` to enable verbose logging during tests (default: silent)

## License

MIT