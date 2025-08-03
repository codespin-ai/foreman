# Shaman Integration Guide

This guide shows how Shaman integrates with Foreman using the functional API.

## Key Changes

1. **Cleaner API**: `const { createWorker } = client` instead of `client.data`
2. **Throws on error**: `initializeForemanClient` throws instead of returning Result
3. **Full trust model**: No permission checks, simplified authentication

## Integration Examples

### 1. In shaman-foreman-client Package

```typescript
import { 
  initializeForemanClient,
  createRun,
  createRunData,
  type ForemanConfig
} from '@codespin/foreman-client';

const foremanConfig: ForemanConfig = {
  endpoint: process.env.FOREMAN_ENDPOINT || 'http://localhost:3000',
  apiKey: process.env.FOREMAN_API_KEY || 'fmn_prod_shaman_default'
};

// Initialize client once
let foremanClient: Awaited<ReturnType<typeof initializeForemanClient>> | null = null;

async function getClient() {
  if (!foremanClient) {
    // This will throw if initialization fails
    foremanClient = await initializeForemanClient(foremanConfig);
  }
  return foremanClient;
}

export async function startWorkflowRun(params: {
  organizationId: string;
  agentName: string;
  input: unknown;
  metadata?: Record<string, unknown>;
}): Promise<Result<{ runId: string; taskId: string }, Error>> {
  try {
    // Create run
    const run = await createRun(foremanConfig, {
      inputData: {
        organizationId: params.organizationId,
        agentName: params.agentName,
        input: params.input
      },
      metadata: {
        ...params.metadata,
        source: 'shaman-a2a'
      }
    });

    if (!run.success) {
      return run;
    }

    // Get client and enqueue task
    const client = await getClient();
    const task = await client.enqueueTask({
      runId: run.data.id,
      type: 'agent-execution',
      inputData: {
        agentName: params.agentName,
        input: params.input,
        organizationId: params.organizationId
      },
      metadata: params.metadata
    });

    if (!task.success) {
      return task;
    }

    return {
      success: true,
      data: {
        runId: run.data.id,
        taskId: task.data.taskId
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error as Error
    };
  }
}
```

### 2. In shaman-worker

```typescript
import { 
  initializeForemanClient,
  createRunData,
  queryRunData
} from '@codespin/foreman-client';

async function startWorker() {
  const foremanConfig = {
    endpoint: process.env.FOREMAN_ENDPOINT!,
    apiKey: process.env.FOREMAN_API_KEY!
  };

  // This throws if initialization fails
  const client = await initializeForemanClient(foremanConfig);
  const { createWorker } = client;

  // Create worker with handlers
  const worker = await createWorker({
    'agent-execution': async (task) => {
      const { agentName, input, organizationId } = task.inputData as any;
      
      try {
        // Execute agent
        const result = await executeAgent({
          agentName,
          input,
          context: {
            organizationId,
            runId: task.runId,
            taskId: task.id
          }
        });

        // Store execution result
        await createRunData(foremanConfig, task.runId, {
          taskId: task.id,
          key: 'agent-response',
          value: result,
          tags: ['response', `agent:${agentName}`, 'success']
        });

        return result;
      } catch (error) {
        // Store error
        await createRunData(foremanConfig, task.runId, {
          taskId: task.id,
          key: 'agent-error',
          value: { 
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          },
          tags: ['error', `agent:${agentName}`]
        });

        throw error;
      }
    }
  }, {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
    maxRetries: 3,
    backoffDelay: 2000
  });

  await worker.start();
  console.log('Worker started');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await worker.stop();
    process.exit(0);
  });
}

// Start worker - will throw if initialization fails
startWorker().catch(console.error);
```

### 3. Environment Configuration

```bash
# .env
FOREMAN_ENDPOINT=http://localhost:3000
FOREMAN_API_KEY=fmn_prod_shaman_xyz789

# docker-compose.yml
services:
  shaman-server:
    environment:
      - FOREMAN_ENDPOINT=http://foreman:3000
      - FOREMAN_API_KEY=fmn_prod_shaman_xyz789
```

## API Summary

```typescript
// Initialize (throws on error)
const client = await initializeForemanClient(config);
const { enqueueTask, createWorker } = client;

// Enqueue tasks
const task = await enqueueTask({
  runId: 'xxx',
  type: 'agent-execution',
  inputData: { ... }
});

// Create workers
const worker = await createWorker({
  'agent-execution': async (task) => { ... }
});

await worker.start();
```

## Key Benefits

1. **Cleaner API**: No more `.data` access pattern
2. **Better error handling**: Throws on initialization failure
3. **Type safety**: Full TypeScript support
4. **No Redis knowledge**: Foreman client handles all queue operations
5. **Simple auth**: Just provide API key in correct format