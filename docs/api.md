# Foreman API

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [TypeScript Client](#typescript-client)
- [Core Concepts](#core-concepts)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Configuration](#configuration)
  - [Runs](#runs)
  - [Tasks](#tasks)
  - [Run Data](#run-data)
- [Common Workflows](#common-workflows)
- [Response Formats](#response-formats)
- [Status Codes](#status-codes)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Additional Information](#additional-information)

## Overview

Foreman provides a REST API for workflow orchestration. All endpoints require API key authentication (except health check).

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

## Base URL

```
http://localhost:3000/api/v1
```

## TypeScript Client

For TypeScript applications, use the official client library:

```bash
npm install @codespin/foreman-client
```

```typescript
import { initializeForemanClient, createRun } from "@codespin/foreman-client";

const config = {
  endpoint: "http://localhost:3000",
  apiKey: "fmn_prod_myorg_abc123",
};

const client = await initializeForemanClient(config);
```

See the [foreman-client README](../node/packages/foreman-client/README.md) for detailed documentation.

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

## Endpoints

### Health Check

#### Health Status

```http
GET /health
```

**Note**: This endpoint does not require authentication.

Response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "services": {
    "database": "connected",
    "redis": "configured"
  }
}
```

### Configuration

#### Get Configuration

```http
GET /api/v1/config
```

Returns the full configuration including Redis and queue settings.

Response:

```json
{
  "version": "1.0.0",
  "environment": "production",
  "redis": {
    "host": "localhost",
    "port": 6379,
    "db": 0
  },
  "queues": {
    "taskQueue": "foreman:tasks",
    "resultQueue": "foreman:results"
  }
}
```

#### Get Redis Configuration

```http
GET /api/v1/config/redis
```

Returns only the Redis configuration.

#### Get Queue Configuration

```http
GET /api/v1/config/queues
```

Returns only the queue names configuration.

### Runs

#### Create Run

```http
POST /runs
```

Request Body:

```json
{
  "inputData": {
    /* any JSON data */
  },
  "metadata": {
    /* optional metadata */
  }
}
```

Response:

```json
{
  "id": "uuid",
  "orgId": "string",
  "status": "pending",
  "inputData": {
    /* your input data */
  },
  "metadata": {
    /* your metadata */
  },
  "totalTasks": 0,
  "completedTasks": 0,
  "failedTasks": 0,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### Get Run

```http
GET /runs/:id
```

Response: Run object

#### Update Run

```http
PATCH /runs/:id
```

Request Body:

```json
{
  "status": "running|completed|failed|cancelled",
  "outputData": {
    /* optional output */
  },
  "errorData": {
    /* optional error details */
  },
  "metadata": {
    /* optional metadata update */
  }
}
```

Response: Updated run object

#### List Runs

```http
GET /runs?limit=20&offset=0&status=pending&sortBy=created_at&sortOrder=desc
```

Response:

```json
{
  "data": [
    /* array of runs */
  ],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

### Tasks

#### Create Task

```http
POST /tasks
```

Request Body:

```json
{
  "runId": "uuid",
  "parentTaskId": "uuid", // optional
  "type": "string",
  "inputData": {
    /* any JSON data */
  },
  "metadata": {
    /* optional metadata */
  },
  "maxRetries": 3 // optional, 0-10
}
```

Response: Task object

#### Get Task

```http
GET /tasks/:id
```

Response:

```json
{
  "id": "uuid",
  "runId": "uuid",
  "parentTaskId": "uuid",
  "orgId": "string",
  "type": "string",
  "status": "pending|queued|running|completed|failed|cancelled|retrying",
  "inputData": {
    /* task input */
  },
  "outputData": {
    /* task output */
  },
  "errorData": {
    /* error details */
  },
  "metadata": {
    /* metadata */
  },
  "retryCount": 0,
  "maxRetries": 3,
  "createdAt": "2024-01-01T00:00:00Z",
  "queuedAt": "2024-01-01T00:00:00Z",
  "startedAt": "2024-01-01T00:00:00Z",
  "completedAt": "2024-01-01T00:00:00Z",
  "durationMs": 1234,
  "queueJobId": "external-queue-job-id"
}
```

#### Update Task

```http
PATCH /tasks/:id
```

Request Body:

```json
{
  "status": "pending|queued|running|completed|failed|cancelled|retrying",
  "outputData": {
    /* optional output */
  },
  "errorData": {
    /* optional error details */
  },
  "metadata": {
    /* optional metadata update */
  },
  "queueJobId": "string" // optional external queue ID
}
```

Response: Updated task object

#### List Tasks

```http
GET /tasks?limit=20&offset=0&runId=uuid&status=pending&sortBy=created_at&sortOrder=desc
```

Query Parameters:

- `runId` - Filter by run ID
- `status` - Filter by status
- `limit` - Max results (default: 20)
- `offset` - Pagination offset (default: 0)
- `sortBy` - Sort field (default: created_at)
- `sortOrder` - Sort order: asc or desc (default: desc)

Response:

```json
{
  "data": [
    /* array of tasks */
  ],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

### Run Data

#### Create Run Data

```http
POST /runs/:runId/data
```

Creates a new run data entry. Multiple entries with the same key are allowed.

Request Body:

```json
{
  "taskId": "uuid",
  "key": "string",
  "value": {
    /* any JSON data */
  },
  "tags": ["tag1", "tag2"], // optional array of tags
  "metadata": {
    /* optional metadata */
  }
}
```

Response: RunData object

#### Query Run Data

```http
GET /runs/:runId/data
```

Query run data with flexible filtering options.

Query Parameters:

- `key` - Exact key match
- `keys` - Comma-separated list of exact keys
- `keyStartsWith` - Comma-separated list of key prefixes
- `keyPattern` - Glob pattern for key matching (e.g., "config.\*")
- `tags` - Comma-separated list of tags to match
- `tagStartsWith` - Comma-separated list of tag prefixes
- `tagMode` - "any" (default) or "all" for tag matching
- `includeAll` - "true" to get all values (not just latest per key)
- `limit` - Max results (1-1000, default: 100)
- `offset` - Pagination offset (default: 0)
- `sortBy` - "created_at" (default), "updated_at", or "key"
- `sortOrder` - "desc" (default) or "asc"

Examples:

```http
# Get latest value for a specific key
GET /runs/:runId/data?key=customer-data

# Get all values for multiple keys
GET /runs/:runId/data?keys=temp,humidity&includeAll=true

# Query by key prefix
GET /runs/:runId/data?keyStartsWith=sensor.temp

# Query by tags (ANY mode)
GET /runs/:runId/data?tags=production,europe

# Query by tags (ALL mode)
GET /runs/:runId/data?tags=production,europe&tagMode=all

# Complex query
GET /runs/:runId/data?keyStartsWith=sensor.&tags=building-A&limit=50
```

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "runId": "uuid",
      "taskId": "uuid",
      "orgId": "string",
      "key": "string",
      "value": {
        /* stored value */
      },
      "tags": ["tag1", "tag2"],
      "metadata": {
        /* metadata */
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 250
  }
}
```

#### Update Run Data Tags

```http
PATCH /runs/:runId/data/:dataId/tags
```

Add or remove tags from an existing run data entry.

Request Body:

```json
{
  "add": ["new-tag1", "new-tag2"], // optional tags to add
  "remove": ["old-tag1", "old-tag2"] // optional tags to remove
}
```

Response: Updated RunData object

#### Delete Run Data

```http
DELETE /runs/:runId/data
```

Delete run data entries by key or ID.

Query Parameters (one required):

- `key` - Delete all entries with this key
- `id` - Delete specific entry by ID

Examples:

```http
# Delete all entries for a key
DELETE /runs/:runId/data?key=temp-data

# Delete specific entry
DELETE /runs/:runId/data?id=uuid
```

Response:

```json
{
  "deleted": 2 // number of entries deleted
}
```

## Common Workflows

### Creating and Executing a Task

```typescript
import { initializeForemanClient, createRun } from "@codespin/foreman-client";

// 1. Initialize client
const config = {
  endpoint: "http://localhost:3000",
  apiKey: "fmn_prod_myorg_abc123",
};
const client = await initializeForemanClient(config);
const { enqueueTask, createWorker } = client;

// 2. Create a run
const run = await createRun(config, {
  inputData: { orderId: "order-123" },
});

// 3. Enqueue task (handles DB + Queue)
const task = await enqueueTask({
  runId: run.data.id,
  type: "process-order",
  inputData: { action: "validate" },
});

// 4. Create worker
const worker = await createWorker({
  "process-order": async (task) => {
    console.log("Processing:", task.inputData);
    // ... do work ...
    return { processed: true };
  },
});

await worker.start();
```

### Sharing Data Between Tasks

```typescript
// Task A stores data with tags
await createRunData(config, runId, {
  taskId: taskA.id,
  key: "customer-data",
  value: { customerId: "123", email: "user@example.com" },
  tags: ["validated", "v1.0"],
});

// Task B queries data
const data = await queryRunData(config, runId, {
  key: "customer-data",
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

## Status Codes

- `200 OK` - Successful GET/PATCH/DELETE requests
- `201 Created` - Successful POST requests
- `400 Bad Request` - Invalid request data or validation errors
- `401 Unauthorized` - Missing or invalid API key
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "details": [
    /* optional validation errors */
  ]
}
```

### Client Error Handling

All client methods return Result types:

```typescript
const result = await foreman.createTask(input);

if (!result.success) {
  console.error("Failed:", result.error);
  return;
}

const task = result.data;
```

## Rate Limits

Default rate limit: 100 requests per 15 minutes per API key.

## Additional Information

### Response Fields

All timestamps include:

- `createdAt` - When the resource was created
- `updatedAt` - When the resource was last modified (for run and task)

### Run Data Multiple Values

The run data storage allows multiple values for the same key. This is useful for:

- Event logging (multiple log entries with same key)
- Time series data
- Audit trails
- Progress tracking

By default, queries return only the latest value per key. Use `includeAll=true` to get all values.

### Security Model

Foreman runs in a fully trusted environment behind a firewall. All authenticated users have full access to all operations. The API key format (`fmn_[env]_[orgId]_[random]`) is used to:

- Validate the caller
- Extract the organization ID
- Grant full access to all operations for that organization
