# Foreman API

## Overview

Foreman provides a REST API for workflow orchestration. All endpoints require API key authentication.

## Authentication

Include your API key in the Authorization header:
```
Authorization: Bearer fmn_dev_your_api_key_here
```

## Core Concepts

### Runs
A run is a top-level execution context that contains tasks.

### Tasks
Tasks are individual units of work within a run. Tasks can have parent-child relationships.

### Run Data
Key-value storage for sharing data between tasks within a run. Supports tags for categorization and allows multiple entries with the same key.

## Common Workflows

### Creating and Executing a Task

```typescript
import { initializeForemanClient, createRun } from '@codespin/foreman-client';

// 1. Initialize client
const config = { 
  endpoint: 'http://localhost:3000',
  apiKey: 'fmn_prod_myorg_abc123' 
};
const client = await initializeForemanClient(config);
const { enqueueTask, createWorker } = client;

// 2. Create a run
const run = await createRun(config, {
  inputData: { orderId: 'order-123' }
});

// 3. Enqueue task (handles DB + Queue)
const task = await enqueueTask({
  runId: run.data.id,
  type: 'process-order',
  inputData: { action: 'validate' }
});

// 4. Create worker
const worker = await createWorker({
  'process-order': async (task) => {
    console.log('Processing:', task.inputData);
    // ... do work ...
    return { processed: true };
  }
});

await worker.start();
```

### Sharing Data Between Tasks

```typescript
// Task A stores data with tags
await createRunData(config, runId, {
  taskId: taskA.id,
  key: 'customer-data',
  value: { customerId: '123', email: 'user@example.com' },
  tags: ['validated', 'v1.0']
});

// Task B queries data
const data = await queryRunData(config, runId, {
  key: 'customer-data'
});

// Query by tags
const taggedData = await queryRunData(config, runId, {
  tags: ['validated'],
  tagMode: 'any'
});

// Query with prefix matching
const results = await queryRunData(config, runId, {
  keyStartsWith: ['customer-'],
  tags: ['v1.0']
});
```

## Error Handling

All client methods return Result types:

```typescript
const result = await foreman.createTask(input);

if (!result.success) {
  console.error('Failed:', result.error);
  return;
}

const task = result.data;
```

## Rate Limits

Default rate limit: 100 requests per 15 minutes per API key.

## Security Model

Foreman runs in a fully trusted environment behind a firewall. All authenticated users have full access to all operations. The API key format (`fmn_[env]_[orgId]_[random]`) is used to:
- Validate the caller
- Extract the organization ID
- Grant full access to all operations for that organization