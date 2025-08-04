# Foreman API

## Overview

Foreman provides a REST API for workflow orchestration. All endpoints require API key authentication.

## Authentication

All API endpoints (except `/api/v1/health`) require authentication. You can use either:

1. **Bearer token** in Authorization header:
   ```
   Authorization: Bearer fmn_prod_org123_randomstring
   ```

2. **API key** in x-api-key header:
   ```
   x-api-key: fmn_prod_org123_randomstring
   ```

The API key format is: `fmn_[environment]_[organizationId]_[random]`

**Note**: Authentication can be disabled for testing by not setting `FOREMAN_API_KEY_ENABLED` or `FOREMAN_API_KEY` environment variables.

## Core Concepts

### Runs
A run is a top-level execution context that contains tasks.

### Tasks
Tasks are individual units of work within a run. Tasks can have parent-child relationships.

### Run Data
Key-value storage for sharing data between tasks within a run:
- Supports multiple values per key (no unique constraint)
- Tags array for categorization and filtering
- Tracks which task created each entry
- Supports flexible querying with filters and pagination
- Timestamps track creation and updates

## Common Workflows

### Creating and Executing a Task

```typescript
import { initializeForemanClient, createRun } from '@codespin/foreman-client';

// 1. Initialize client
const config = { 
  endpoint: 'http://localhost:3000',
  apiKey: 'fmn_prod_myorg_abc123',
  queues: {  // Optional: override queue names
    taskQueue: 'my-app:tasks',
    resultQueue: 'my-app:results'
  }
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
  tagMode: 'any',      // 'any' (default) or 'all'
  includeAll: true     // Return all values, not just latest per key
});

// Query with prefix matching
const results = await queryRunData(config, runId, {
  keyStartsWith: ['customer-'],
  tags: ['v1.0'],
  sortBy: 'created_at',  // 'created_at' (default), 'updated_at', or 'key'
  sortOrder: 'desc',     // 'desc' (default) or 'asc'
  limit: 10,
  offset: 0
});

// Update tags on existing data
const updated = await updateRunDataTags(config, runId, dataId, {
  add: ['reviewed', 'approved'],
  remove: ['pending']
});

// Delete data by key
const deleted = await deleteRunData(config, runId, {
  key: 'temp-data'  // or use { id: dataId } to delete specific entry
});
```

## Response Formats

### Pagination
All list endpoints return paginated results:
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

### Error Responses
- **400**: Invalid request data or validation errors
- **401**: Authentication required or invalid API key
- **404**: Resource not found
- **500**: Internal server error

Error format:
```json
{
  "error": "Error message",
  "details": []  // Optional, for validation errors
}
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