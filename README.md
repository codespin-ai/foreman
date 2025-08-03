# Foreman

A workflow orchestration engine with REST API, built with TypeScript. Foreman provides queue-agnostic task orchestration with PostgreSQL as the source of truth.

## Features

- 🏢 **Multi-tenant Runs** - Isolated execution contexts per organization
- 📋 **Task Management** - Queue-agnostic task orchestration
- 💾 **PostgreSQL Storage** - All data stored in PostgreSQL, queues only contain IDs
- 🔄 **Run Data Storage** - Key-value storage for inter-task communication
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
export FOREMAN_DB_HOST=localhost
export FOREMAN_DB_PORT=5432
export FOREMAN_DB_NAME=foreman
export FOREMAN_DB_USER=foreman
export FOREMAN_DB_PASSWORD=your_password

# Run migrations
npm run migrate:foreman:latest
```

### Starting the Server

```bash
./start.sh
```

The REST API will be available at `http://localhost:3000`.

## API Overview

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

- `POST /api/v1/runs/:runId/data` - Store data
- `GET /api/v1/runs/:runId/data/:key` - Get specific data
- `GET /api/v1/runs/:runId/data` - List all data for a run

## Client Usage

```typescript
import { ForemanClient } from '@codespin/foreman-client';
import { Queue } from 'bullmq';

// Initialize client
const foreman = new ForemanClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Initialize your queue (BullMQ example)
const queue = new Queue('tasks');

// Create a task with data in Foreman
const task = await foreman.createTask({
  type: 'process-order',
  runId: 'run-123',
  data: {
    orderId: 'order-456',
    items: [...]
  }
});

// Queue only the task ID
await queue.add('process', { 
  taskId: task.id 
});

// In your worker
const job = await queue.getJob();
const taskData = await foreman.getTask(job.data.taskId);
// Process using taskData.data
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
