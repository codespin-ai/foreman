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
- 🐳 **Docker Support** - Official Docker images available
- 📦 **TypeScript Client** - Published npm package for easy integration

## Architecture

Foreman follows a clean architecture where:

- **Queue systems** (BullMQ, SQS, etc.) only store task IDs
- **PostgreSQL** stores all task data, run state, and execution history
- **foreman-client** handles queue operations in your application
- **foreman-server** provides REST API for state management

## Quick Start

### Option 1: Docker (Recommended)

The fastest way to get started with Foreman is using Docker:

```bash
# Using Docker Compose (includes PostgreSQL)
git clone https://github.com/codespin-ai/foreman.git
cd foreman
docker-compose up

# The API will be available at http://localhost:5002
# Note: Add Redis service to docker-compose.yml if using BullMQ
```

Or use the official Docker image:

```bash
docker run -p 5002:5002 \
  -e FOREMAN_DB_HOST=your-db-host \
  -e FOREMAN_DB_NAME=foreman \
  -e FOREMAN_DB_USER=postgres \
  -e FOREMAN_DB_PASSWORD=your-password \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PORT=6379 \
  -e FOREMAN_AUTO_MIGRATE=true \
  ghcr.io/codespin-ai/foreman:latest
```

See [deployment documentation](docs/deployment.md) for production Docker configuration.

### Option 2: TypeScript Client SDK

For existing applications, install the TypeScript client:

```bash
npm install @codespin/foreman-client
```

```typescript
import { initializeForemanClient } from "@codespin/foreman-client";

const client = await initializeForemanClient({
  endpoint: "https://your-foreman-server.com",
  apiKey: "fmn_prod_myorg_abc123",
});
```

See the [foreman-client README](node/packages/foreman-client/README.md) for detailed client documentation.

### Option 3: Local Development

#### Prerequisites

- Node.js 22+
- PostgreSQL 12+
- Redis (if using BullMQ)
- npm or yarn

#### Installation

```bash
# Clone the repository
git clone https://github.com/codespin-ai/foreman.git
cd foreman

# Install dependencies
npm install

# Build all packages
./build.sh
```

#### Database Setup

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

# Optional Bearer authentication
export FOREMAN_API_KEY=your-secret-token

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

All API endpoints (except health check) require authentication using a Bearer token in the Authorization header:

```
Authorization: Bearer your-secret-token
```

Since Foreman runs in a fully trusted environment, the authentication is simplified:

- No permission checks - all authenticated users have full access
- Simple token validation against configured token

For testing:

- Set `FOREMAN_API_KEY` environment variable to configure the Bearer token
- Authentication can be disabled by not setting `FOREMAN_API_KEY_ENABLED` or `FOREMAN_API_KEY`

### Health Check

- `GET /health` - Health check endpoint (no authentication required)

See the [API documentation](docs/api.md) for complete endpoint reference and examples.

## TypeScript Client SDK

The `@codespin/foreman-client` package provides a complete workflow SDK that handles all queue operations internally:

```typescript
import {
  initializeForemanClient,
  createRun,
  enqueueTask,
  createWorker,
  createRunData,
  queryRunData,
} from "@codespin/foreman-client";

// Initialize client (fetches Redis config automatically)
const foremanConfig = {
  endpoint: "http://localhost:3000",
  apiKey: "fmn_prod_myorg_abc123", // Format: fmn_[env]_[orgId]_[random]
  queues: {
    // Optional: override default queue names
    taskQueue: "my-app:tasks",
    resultQueue: "my-app:results",
  },
};

const client = await initializeForemanClient(foremanConfig);
const { enqueueTask: enqueueFn, createWorker: createWorkerFn } = client;

// Create a run
const run = await createRun(foremanConfig, {
  inputData: { workflowType: "order-processing" },
});

// Enqueue tasks (handles both DB and BullMQ)
const task = await enqueueFn({
  type: "process-order",
  runId: run.data.id,
  inputData: { orderId: "order-456" },
  priority: 10,
});

// Create a worker with multiple task handlers
const worker = await createWorkerFn(
  {
    "validate-order": async (task) => {
      console.log("Validating order:", task.inputData);

      // Perform validation
      const isValid = validateOrder(task.inputData.orderId);

      // Store result using run data
      await createRunData(foremanConfig, task.runId, {
        taskId: task.id,
        key: "order-validation",
        value: { valid: isValid, timestamp: Date.now() },
        tags: ["validation", "order"],
      });

      return { valid: isValid };
    },

    "process-payment": async (task) => {
      console.log("Processing payment:", task.inputData);

      // Query previous validation result
      const validationData = await queryRunData(foremanConfig, task.runId, {
        key: "order-validation",
      });

      if (
        !validationData.success ||
        !validationData.data.data[0]?.value.valid
      ) {
        throw new Error("Order validation failed");
      }

      // Process payment
      const result = await processPayment(task.inputData);
      return result;
    },
  },
  {
    concurrency: 5,
    maxRetries: 3,
  },
);

await worker.start();

// Query run data
const results = await queryRunData(foremanConfig, run.data.id, {
  tags: ["validation"],
  sortBy: "created_at",
  sortOrder: "desc",
});

// Complete the run
await updateRun(foremanConfig, run.data.id, {
  status: "completed",
  outputData: {
    processedAt: new Date().toISOString(),
    totalAmount: 99.99,
  },
});
```

## Best Practices

1. **Store Task IDs Only**: Keep queue payloads minimal by storing only task IDs
2. **Use Run Data**: Share data between tasks using the run data key-value store
3. **Handle Retries**: Configure `maxRetries` when creating tasks
4. **Update Status**: Always update task status during processing
5. **Error Handling**: Store detailed error information for debugging
6. **Metadata**: Use metadata for filtering and additional context

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
};
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

## Docker Support

### Quick Start with Docker Compose

```bash
# Start Foreman with PostgreSQL and Redis
docker-compose up

# Access the API at http://localhost:5002
curl http://localhost:5002/health
```

### Building Docker Images

```bash
# Build the Docker image
./scripts/docker-build.sh

# Test the image locally
./scripts/docker-test.sh

# Push to registry
./scripts/docker-push.sh latest ghcr.io/codespin-ai
```

### Official Images

Official Docker images are available at `ghcr.io/codespin-ai/foreman`.

See [deployment documentation](docs/deployment.md) for production Docker deployment.

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

#### Prerequisites

Before running tests, ensure PostgreSQL is running:

```bash
# Start development environment
cd devenv
./run.sh up

# Verify PostgreSQL is running
./run.sh logs postgres
```

#### Test Commands

```bash
# Run all tests (integration + client)
npm test

# Run specific test suite
npm run test:grep -- "Organizations"        # Search both integration and client tests
npm run test:integration:grep -- "Workflow" # Only integration tests
npm run test:client:grep -- "Run Management" # Only client tests

# Run tests with verbose logging
VERBOSE_TESTS=true npm test
```

#### Test Infrastructure

Foreman uses a two-layer testing architecture:

1. **Integration Tests** (`foreman-integration-tests`):
   - Test the REST API directly using HTTP requests
   - Use a real Foreman server instance
   - Located in `/node/packages/foreman-integration-tests`
   - 49 tests covering all API endpoints

2. **Client Tests** (`foreman-client`):
   - Test the TypeScript client library
   - Validate Result types and error handling
   - Located in `/node/packages/foreman-client/src/tests`
   - 18 tests covering all client functions

Both test suites:

- Use separate test databases (`foreman_test`, `foreman_client_test`)
- Run fresh migrations before each test suite
- Truncate tables between tests for isolation
- Support grep patterns for running specific tests

### Building

```bash
# Build all packages
./build.sh

# Run linting
./lint-all.sh

# Format with Prettier (called automatically during build)
./format-all.sh

# Clean build artifacts
./clean.sh
```

## Contributing

Please read [CODING-STANDARDS.md](CODING-STANDARDS.md) for our coding standards and guidelines.

## License

MIT
