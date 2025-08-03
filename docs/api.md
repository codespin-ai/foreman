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
// 1. Create a run
const run = await foreman.createRun({
  inputData: { orderId: 'order-123' }
});

// 2. Create a task
const task = await foreman.createTask({
  runId: run.data.id,
  type: 'process-order',
  inputData: { action: 'validate' }
});

// 3. Queue only the task ID
await queue.add('work', { taskId: task.data.id });

// 4. In your worker
const taskData = await foreman.getTask(taskId);
await foreman.updateTask(taskId, { status: 'running' });
// ... do work ...
await foreman.updateTask(taskId, { 
  status: 'completed',
  outputData: result 
});
```

### Sharing Data Between Tasks

```typescript
// Task A stores data with tags
await foreman.createRunData(runId, {
  taskId: taskA.id,
  key: 'customer-data',
  value: { customerId: '123', email: 'user@example.com' },
  tags: ['validated', 'v1.0']
});

// Task B retrieves latest value for a key
const data = await foreman.getRunData(runId, 'customer-data');

// Or get all values for a key (if multiple entries exist)
const allData = await foreman.getAllRunData(runId, 'customer-data');

// Query by tags
const taggedData = await foreman.queryRunDataByTags(runId, {
  tags: ['validated'],
  tagMode: 'any'
});

// Query with prefix matching
const results = await foreman.queryRunData(runId, {
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

## Permissions

API keys can have the following permissions:
- `runs:*` - All run operations
- `tasks:*` - All task operations  
- `rundata:*` - All run data operations
- `*` - All permissions