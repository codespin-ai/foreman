# Foreman Architecture

## Overview

Foreman is a workflow orchestration engine designed with a clean separation between state management and execution. It follows the principle that queues should only contain task IDs, with all data stored in PostgreSQL. This architecture enables queue portability, better observability, and simplified disaster recovery.

## Core Design Principles

### 1. ID-Only Queue Pattern
The fundamental principle of Foreman is that **queues never store data**. This provides several benefits:
- **Queue Independence**: Switch between BullMQ, SQS, RabbitMQ, etc. without data migration
- **Reduced Memory Usage**: Queue systems only store small task IDs
- **Better Observability**: Query task data directly from PostgreSQL
- **Simplified Backup**: All data in one place (PostgreSQL)
- **Audit Trail**: Complete history with who/what/when

### 2. RESTful API
- Standard HTTP verbs (GET, POST, PATCH)
- JSON request/response bodies
- Consistent URL patterns (`/api/v1/resource`)
- Standard HTTP status codes
- No GraphQL complexity

### 3. Multi-Tenant by Design
- Every entity has an `org_id` field
- API keys scoped to organizations
- Complete data isolation between organizations
- No cross-tenant data leakage

### 4. Functional Architecture
- No classes or OOP patterns
- Pure functions with explicit dependencies
- Result types for error handling
- Immutable data flow
- Easy to test and reason about

### 5. Type Safety
- TypeScript with strict mode
- Database row types (`XxxDbRow`) mirror schema exactly
- Domain types use camelCase
- Mapper functions handle conversions
- Zod validation for all inputs

## System Components

### 1. Foreman Server (`foreman-server`)
- REST API server built with Express
- Handles all state management operations
- Provides endpoints for runs, tasks, and run data
- Authentication via API keys
- Rate limiting and security middleware

### 2. Foreman Client (`foreman-client`)
- TypeScript client library
- Handles HTTP communication with server
- Built-in retry and timeout logic
- Result type for explicit error handling

### 3. Database Layer (`foreman-db`)
- PostgreSQL connection management using pg-promise
- Type-safe query execution
- Connection pooling

## Data Model

### Runs
- Top-level execution context
- Tracks overall status and metrics
- Contains input/output data and metadata

### Tasks
- Individual units of work within a run
- Hierarchical (supports parent-child relationships)
- Status tracking with retry support
- Links to external queue job IDs

### Run Data
- Key-value storage for inter-task communication
- Last-write-wins semantics
- Scoped to runs for isolation

### API Keys
- Organization-scoped authentication
- Permission-based access control
- Usage tracking and expiration

## Typical Flow

1. **Create Run**: Application creates a run with input data
2. **Create Task**: Create task(s) for the run, storing all data in Foreman
3. **Queue Task ID**: Queue only the task ID in your queue system
4. **Worker Processing**:
   - Worker picks up task ID from queue
   - Fetches full task data from Foreman
   - Updates task status to 'running'
   - Executes task logic
   - Stores results and updates status
5. **Run Completion**: When all tasks complete, run is marked as completed

## Integration Pattern

```typescript
// 1. Initialize client
const foreman = new ForemanClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// 2. Create a run
const run = await foreman.createRun({
  inputData: { orderId: '123' }
});

// 3. Create a task
const task = await foreman.createTask({
  runId: run.data.id,
  type: 'process-order',
  inputData: { step: 'validate' }
});

// 4. Queue only the task ID
await queue.add('process', { taskId: task.data.id });

// 5. In your worker
const job = await queue.getJob();
const taskData = await foreman.getTask(job.data.taskId);
// Process using taskData.data.inputData
```

## Security

- API key authentication with bcrypt hashing
- Organization isolation at database level
- Rate limiting on API endpoints
- Request size limits
- CORS configuration

## Scalability

- Stateless REST API (can run multiple instances)
- PostgreSQL handles concurrent access
- Queue systems handle job distribution
- Connection pooling for database efficiency

## Monitoring

- Health check endpoint
- Request logging with duration tracking
- Error logging with context
- Audit log for all state changes


