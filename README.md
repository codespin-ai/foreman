# Foreman

A workflow orchestration engine with REST API, built with TypeScript. Foreman provides queue-agnostic task orchestration with PostgreSQL as the source of truth.

**Security Model**: Foreman is designed to run in a fully trusted environment behind a firewall. All authenticated callers have full access to all operations.

## Features

- 🏢 **Multi-tenant Runs** - Isolated execution contexts per organization
- 📋 **Task Management** - Queue-agnostic task orchestration
- 💾 **PostgreSQL Storage** - All data stored in PostgreSQL, queues only contain IDs
- 🔄 **Run Data Storage** - Key-value storage with tags and multi-value support for inter-task communication
- 🚀 **REST API** - Simple HTTP API for all operations
- 📊 **Status Tracking** - Complete execution history and status tracking

## Architecture

Foreman follows a clean architecture where:
- **Queue systems** (BullMQ, SQS, etc.) only store task IDs
- **PostgreSQL** stores all task data, run state, and execution history
- **foreman-client** handles queue operations in your application
- **foreman-server** provides REST API for state management

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 12+
- Redis (if using BullMQ)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/codespin-ai/foreman.git
cd foreman

# Install dependencies
npm install

# Build all packages
./build.sh
```

### Database Setup

```bash
# Set environment variables

# Database configuration
export FOREMAN_DB_HOST=localhost
export FOREMAN_DB_PORT=5432
export FOREMAN_DB_NAME=foreman
export FOREMAN_DB_USER=foreman
export FOREMAN_DB_PASSWORD=your_password

# Redis configuration (for BullMQ)
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=your_redis_password  # Optional
export REDIS_DB=0                          # Optional

# Queue configuration
export TASK_QUEUE_NAME=foreman:tasks       # Default: foreman:tasks
export RESULT_QUEUE_NAME=foreman:results   # Default: foreman:results

# API configuration
export FOREMAN_API_KEY=fmn_dev_testorg_123 # Optional: Default API key

# Run migrations
npm run migrate:foreman:latest
```

### Starting the Server

```bash
./start.sh
```

The REST API will be available at `http://localhost:3000`.

## API Overview

### Authentication

All API endpoints require authentication using a Bearer token in the Authorization header:

```
Authorization: Bearer fmn_prod_org123_randomstring
```

The API key format is: `fmn_[environment]_[organizationId]_[random]`

Since Foreman runs in a fully trusted environment, the authentication is simplified:
- No permission checks - all authenticated users have full access
- No database validation - API key format is validated only
- Organization ID is extracted from the API key

For testing, you can use:
- Header: `x-api-key: test-api-key`
- This will use `test-org` as the organization ID

### Runs

- `POST /api/v1/runs` - Create a new run
- `GET /api/v1/runs/:id` - Get run details
- `PATCH /api/v1/runs/:id` - Update run status
- `GET /api/v1/runs` - List runs with filtering

### Tasks

- `POST /api/v1/tasks` - Create a new task
- `GET /api/v1/tasks/:id` - Get task details
- `PATCH /api/v1/tasks/:id` - Update task status
- `GET /api/v1/tasks` - List tasks with filtering

### Run Data

- `POST /api/v1/runs/:runId/data` - Store data with optional tags
- `GET /api/v1/runs/:runId/data` - Query data with flexible filtering (by key, tags, prefix)
- `PATCH /api/v1/runs/:runId/data/:dataId/tags` - Update tags on existing data
- `DELETE /api/v1/runs/:runId/data` - Delete data by key or ID

### Configuration

- `GET /api/v1/config` - Get client configuration (Redis, queues, version)
- `GET /api/v1/config/redis` - Get Redis configuration only
- `GET /api/v1/config/queues` - Get queue names configuration only

## Client Usage

The foreman-client package provides a complete workflow SDK that handles all queue operations internally:

```typescript
import { 
  initializeForemanClient, 
  createRun, 
  enqueueTask,
  createWorker,
  createRunData,
  queryRunData
} from '@codespin/foreman-client';

// Initialize client (fetches Redis config automatically)
const foremanConfig = {
  endpoint: 'http://localhost:3000',
  apiKey: 'fmn_prod_myorg_abc123',  // Format: fmn_[env]_[orgId]_[random]
  queues: {  // Optional: override default queue names
    taskQueue: 'my-app:tasks',
    resultQueue: 'my-app:results'
  }
};

const client = await initializeForemanClient(foremanConfig);
const { enqueueTask: enqueueFn, createWorker: createWorkerFn } = client;

// Create a run
const run = await createRun(foremanConfig, {
  inputData: { workflowType: 'order-processing' }
});

// Enqueue tasks (handles both DB and BullMQ)
const task = await enqueueFn({
  type: 'process-order',
  runId: run.data.id,
  inputData: { orderId: 'order-456' },
  priority: 10
});

// Create a worker
const worker = await createWorkerFn({
  'process-order': async (task) => {
    // Store intermediate data
    await createRunData(foremanConfig, task.runId, {
      taskId: task.id,
      key: 'order-status',
      value: { status: 'processing' },
      tags: ['order-456', 'status']
    });
    
    // Process order...
    return { processed: true };
  }
}, { concurrency: 5 });

await worker.start();
```

## Client API Reference

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
}
```

### Configuration Functions

```typescript
// Initialize client with automatic config fetching
// @throws Error if initialization fails
initializeForemanClient(config: ForemanConfig): Promise<{
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  enqueueTask: Function;
  createWorker: Function;
}>

// Get Redis configuration
getRedisConfig(config: ForemanConfig): Promise<Result<RedisConfig, Error>>

// Get queue configuration  
getQueueConfig(config: ForemanConfig): Promise<Result<QueueConfig, Error>>
```

### Run Management

```typescript
// Create a new run
createRun(config: ForemanConfig, input: CreateRunInput): Promise<Result<Run, Error>>

// Get run details
getRun(config: ForemanConfig, id: string): Promise<Result<Run, Error>>

// Update run status
updateRun(config: ForemanConfig, id: string, input: UpdateRunInput): Promise<Result<Run, Error>>

// List runs with filtering
listRuns(config: ForemanConfig, params?: PaginationParams): Promise<Result<PaginatedResult<Run>, Error>>
```

### Task Management

```typescript
// Create a task (DB only)
createTask(config: ForemanConfig, input: CreateTaskInput): Promise<Result<Task, Error>>

// Enqueue a task (DB + Queue)
enqueueTask(params: {
  foremanConfig: ForemanConfig;
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  task: CreateTaskInput & { priority?: number; delay?: number };
}): Promise<Result<{ taskId: string }, Error>>

// Get task status
getTaskStatus(params: {
  foremanConfig: ForemanConfig;
  taskId: string;
}): Promise<Result<TaskStatus, Error>>

// Wait for task completion
waitForTask(params: {
  foremanConfig: ForemanConfig;
  taskId: string;
  timeout?: number;
  pollInterval?: number;
}): Promise<Result<TaskResult, Error>>
```

### Worker Management

```typescript
// Create a worker with multiple handlers
createWorker(params: {
  foremanConfig: ForemanConfig;
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  handlers: Record<string, TaskHandler>;
  options?: WorkerOptions;
}): Promise<WorkerControls>

// Create a worker for a single task type
createTaskWorker(params: {
  foremanConfig: ForemanConfig;
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  taskType: string;
  handler: TaskHandler;
  options?: WorkerOptions;
}): Promise<WorkerControls>
```

### Run Data Management

```typescript
// Store run data with tags
createRunData(
  config: ForemanConfig,
  runId: string,
  input: CreateRunDataInput
): Promise<Result<RunData, Error>>

// Query run data with flexible filtering
queryRunData(
  config: ForemanConfig,
  runId: string,
  params?: QueryRunDataParams
): Promise<Result<{ data: RunData[]; pagination: {...} }, Error>>

// Update tags on existing data
updateRunDataTags(
  config: ForemanConfig,
  runId: string,
  dataId: string,
  input: UpdateRunDataTagsInput
): Promise<Result<RunData, Error>>

// Delete run data
deleteRunData(
  config: ForemanConfig,
  runId: string,
  options: { key?: string; id?: string }
): Promise<Result<{ deleted: number }, Error>>
```

## Development

### Project Structure

```
foreman/
├── node/packages/
│   ├── foreman-core/        # Core types and utilities
│   ├── foreman-logger/      # Logging utilities
│   ├── foreman-db/          # Database connection management
│   ├── foreman-server/      # REST API server
│   ├── foreman-client/      # Client library
│   └── foreman-integration-tests/
├── database/
│   └── foreman/
│       ├── migrations/      # Database migrations
│       └── seeds/          # Database seeds
├── scripts/                # Build and utility scripts
└── docs/                   # Documentation
```

### Running Tests

```bash
# Run all tests
npm run test:integration:all

# Run with watch mode
npm run test:integration:foreman:watch
```

### Building

```bash
# Build all packages
./build.sh

# Clean build artifacts
./clean.sh
```

## Contributing

Please read [CODING-STANDARDS.md](CODING-STANDARDS.md) for our coding standards and guidelines.

## License

MIT
