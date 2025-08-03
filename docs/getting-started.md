# Getting Started with Foreman

## Installation

### Prerequisites
- Node.js 22+
- PostgreSQL 12+
- Redis (if using BullMQ for queuing)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/codespin-ai/foreman.git
cd foreman
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
./build.sh
```

4. Set up environment variables:
```bash
export FOREMAN_DB_HOST=localhost
export FOREMAN_DB_PORT=5432
export FOREMAN_DB_NAME=foreman
export FOREMAN_DB_USER=foreman
export FOREMAN_DB_PASSWORD=your_password
```

5. Run database migrations:
```bash
npm run migrate:foreman:latest
```

6. Start the server:
```bash
./start.sh
```

## Creating an API Key

Before using Foreman, you need to create an API key. Connect to your PostgreSQL database and run:

```sql
-- Generate a secure API key (you'll use this in your client)
-- In production, generate this securely, e.g.: openssl rand -hex 32
INSERT INTO api_key (
  id, 
  org_id, 
  name, 
  key_hash, 
  key_prefix, 
  permissions, 
  is_active
) VALUES (
  gen_random_uuid(),
  'my-org', -- Your organization ID
  'My API Key',
  '$2b$10$...', -- bcrypt hash of your API key
  'fmn_dev_', -- First 8 chars of your API key
  '{"*": true}', -- All permissions
  true
);
```

To generate the bcrypt hash for your API key:
```javascript
const bcrypt = require('bcrypt');
const apiKey = 'fmn_dev_your_secure_random_key_here';
const hash = await bcrypt.hash(apiKey, 10);
console.log(hash); // Use this in key_hash
```

## Basic Usage

### 1. Install the Client

```bash
npm install @codespin/foreman-client
```

### 2. Initialize the Client

```typescript
import { ForemanClient } from '@codespin/foreman-client';

const foreman = new ForemanClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'fmn_dev_your_secure_random_key_here'
});
```

### 3. Create a Run

```typescript
const runResult = await foreman.createRun({
  inputData: {
    orderId: 'order-123',
    customerId: 'customer-456'
  },
  metadata: {
    source: 'web',
    priority: 'high'
  }
});

if (!runResult.success) {
  console.error('Failed to create run:', runResult.error);
  return;
}

const run = runResult.data;
console.log('Created run:', run.id);
```

### 4. Create Tasks

```typescript
// Create a validation task
const validationTask = await foreman.createTask({
  runId: run.id,
  type: 'validate-order',
  inputData: {
    orderId: 'order-123'
  }
});

// Create a processing task (child of validation)
const processingTask = await foreman.createTask({
  runId: run.id,
  parentTaskId: validationTask.data.id,
  type: 'process-payment',
  inputData: {
    amount: 99.99,
    currency: 'USD'
  }
});
```

### 5. Queue Tasks (BullMQ Example)

```typescript
import { Queue } from 'bullmq';

const queue = new Queue('tasks', {
  connection: {
    host: 'localhost',
    port: 6379
  }
});

// Queue only the task ID
await queue.add('process', {
  taskId: validationTask.data.id
});
```

### 6. Process Tasks in Worker

```typescript
import { Worker } from 'bullmq';

const worker = new Worker('tasks', async (job) => {
  const { taskId } = job.data;
  
  // Fetch task data from Foreman
  const taskResult = await foreman.getTask(taskId);
  if (!taskResult.success) {
    throw new Error(`Failed to get task: ${taskResult.error}`);
  }
  
  const task = taskResult.data;
  
  // Update task status to running
  await foreman.updateTask(taskId, {
    status: 'running',
    queueJobId: job.id
  });
  
  try {
    // Process based on task type
    let result;
    switch (task.type) {
      case 'validate-order':
        result = await validateOrder(task.inputData);
        break;
      case 'process-payment':
        result = await processPayment(task.inputData);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
    
    // Update task with results
    await foreman.updateTask(taskId, {
      status: 'completed',
      outputData: result
    });
    
    // Store data for other tasks
    await foreman.createRunData(task.runId, {
      taskId: taskId,
      key: `${task.type}_result`,
      value: result
    });
    
  } catch (error) {
    // Update task as failed
    await foreman.updateTask(taskId, {
      status: 'failed',
      errorData: {
        message: error.message,
        stack: error.stack
      }
    });
    throw error;
  }
});
```

### 7. Complete the Run

```typescript
// After all tasks complete, update the run
await foreman.updateRun(run.id, {
  status: 'completed',
  outputData: {
    processedAt: new Date().toISOString(),
    totalAmount: 99.99
  }
});
```

## Best Practices

1. **Store Task IDs Only**: Keep queue payloads minimal by storing only task IDs
2. **Use Run Data**: Share data between tasks using the run data key-value store
3. **Handle Retries**: Configure `maxRetries` when creating tasks
4. **Update Status**: Always update task status during processing
5. **Error Handling**: Store detailed error information for debugging
6. **Metadata**: Use metadata for filtering and additional context

## Next Steps

- Read the [Architecture](architecture.md) documentation
- Check the [API Reference](api-reference.md)
- Set up monitoring and alerts
- Configure rate limits for production