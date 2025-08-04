# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: First Steps When Starting a Session

When you begin working on this project, you MUST:

1. **Read this entire CLAUDE.md file** to understand the project structure and conventions
2. **Read the key documentation files** in this order:
   - `/README.md` - Project overview and quick start
   - `/CODING-STANDARDS.md` - Mandatory coding patterns and conventions
   - `/docs/architecture.md` - System design and data flow
   - `/docs/api-reference.md` - Complete REST API specification
   - `/docs/getting-started.md` - Tutorial and examples
   - Any other relevant docs based on the task at hand

Only after reading these documents should you proceed with any implementation or analysis tasks.

## Overview

Foreman is a workflow orchestration engine with REST API, built with TypeScript. It provides queue-agnostic task orchestration with PostgreSQL as the source of truth. The key principle is that queues only store task IDs, never data.

## Core Architecture Principles

### 1. ID-Only Queue Pattern
- **NEVER** store task data in queues (BullMQ, SQS, etc.)
- **ALWAYS** store all task data in PostgreSQL
- Queues contain only task IDs
- Workers fetch full data from Foreman before processing

### 2. Functional Programming Only
- **NO CLASSES** - Export functions from modules only
- Use pure functions with explicit dependency injection
- Prefer `type` over `interface` (use `interface` only for extensible contracts)
- Use Result types for error handling instead of exceptions

### 3. Database Conventions
- **PostgreSQL** with **Knex.js** for migrations
- **pg-promise** for data access (NO ORMs)
- Table names: **singular** and **snake_case** (e.g., `run`, `task`, `run_data`)
- TypeScript: **camelCase** for all variables/properties
- SQL: **snake_case** for all table/column names
- **DbRow Pattern**: All persistence functions use `XxxDbRow` types that mirror exact database schema
- **Mapper Functions**: `mapXxxFromDb()` and `mapXxxToDb()` handle conversions between snake_case DB and camelCase domain types
- **Type-safe Queries**: All queries use `db.one<XxxDbRow>()` with explicit type parameters

### 4. REST API Design
- RESTful endpoints (no GraphQL)
- JSON request/response bodies
- Standard HTTP status codes
- API key authentication in Authorization header
- Consistent error response format

### 5. ESM Modules
- All imports MUST include `.js` extension: `import { foo } from './bar.js'`
- TypeScript configured for `"module": "NodeNext"`
- Type: `"module"` in all package.json files

## Essential Commands

### Build Commands
```bash
# Build entire project (from root)
./build.sh              # Standard build
./build.sh --install    # Force npm install in all packages
./build.sh --migrate    # Build + run DB migrations

# Clean build artifacts
./clean.sh

# Start the server
./start.sh

# Lint entire project (from root)
./lint-all.sh           # Run ESLint on all packages
```

### Database Commands

**IMPORTANT**: NEVER run database migrations unless explicitly instructed by the user

```bash
# Check migration status (safe to run)
npm run migrate:foreman:status

# Create new migration (safe to run)
npm run migrate:foreman:make migration_name

# Run migrations (ONLY when explicitly asked)
npm run migrate:foreman:latest
npm run migrate:foreman:rollback

# Create seed file (safe to run)
npm run seed:foreman:make seed_name

# Run seeds (ONLY when explicitly asked)
npm run seed:foreman:run
```

### Recent Database Migrations

1. **Initial Schema** (`20250803000000_initial_schema.js`)
   - Core tables: `run`, `task`, `run_data`
   - Basic indexes and constraints
   - Initial unique constraint on `run_data(run_id, key)`

2. **Add Tags to Run Data** (`20250803120000_add_tags_to_run_data.js`)
   - Added `tags` column as `text[]` to `run_data` table
   - Added GIN index for efficient tag queries

3. **Add Updated At to Run and Task** (`20250804060438_add_updated_at_to_run.js`)
   - Added `updated_at` column to both `run` and `task` tables
   - Added PostgreSQL triggers to auto-update timestamps
   - Ensures updatedAt is always current when status changes

4. **Remove Unique Constraint on Run Data** (`20250804061803_remove_unique_constraint_on_run_data.js`)
   - Dropped unique constraint on `run_data(run_id, key)`
   - Allows multiple values per key for append-only patterns
   - Enables event sourcing and audit trail use cases

## Package Structure

Located in `/node/packages/`, build order matters:

1. **@codespin/foreman-core** - Core types and Result utilities
2. **@codespin/foreman-logger** - Centralized logging with pino
3. **@codespin/foreman-db** - Database connection management
4. **@codespin/foreman-test-utils** - Shared test utilities and infrastructure
5. **@codespin/foreman-server** - REST API server
6. **@codespin/foreman-client** - Client library for API access (published to npm)
7. **@codespin/foreman-integration-tests** - Integration tests using REST API (separate from production build)

## Development Workflow

1. **Define Types**: Add/update types in `foreman-server/src/types.ts`
2. **Create Migration**: Use `npm run migrate:foreman:make` for schema changes
3. **Implement Domain Functions**: Add domain functions in `foreman-server/src/domain/`
4. **Add Routes**: Implement REST endpoints in `foreman-server/src/routes/`
5. **Update Client**: Add methods to `foreman-client` if needed
6. **Build**: Run `./build.sh` from root
7. **Test**: Add integration tests in `foreman-integration-tests` and client tests in `foreman-client`

## Environment Variables

Required PostgreSQL connection variables:
- `FOREMAN_DB_HOST`
- `FOREMAN_DB_PORT`
- `FOREMAN_DB_NAME`
- `FOREMAN_DB_USER`
- `FOREMAN_DB_PASSWORD`
- `FOREMAN_DB_SSL` (optional, default: false)

Server configuration:
- `PORT` (default: 3000)
- `LOG_LEVEL` (default: info)
- `NODE_ENV` (development/production)
- `CORS_ORIGIN` (comma-separated list)

## Code Patterns

### Domain Function Pattern
```typescript
// ✅ Good - Pure function with Result type
export async function createRun(
  db: Database,
  input: CreateRunInput
): Promise<Result<Run, Error>> {
  try {
    const row = await db.one<RunDbRow>(
      `INSERT INTO run (id, org_id, status, input_data)
       VALUES ($(id), $(orgId), $(status), $(inputData))
       RETURNING *`,
      { id, orgId, status, inputData }
    );
    return success(mapRunFromDb(row));
  } catch (error) {
    return failure(error as Error);
  }
}

// ❌ Bad - Class-based approach
export class RunService {
  async createRun(input: CreateRunInput): Promise<Run> {
    // Don't do this
  }
}
```

### REST Route Pattern
```typescript
// ✅ Good - Zod validation, proper error handling
router.post('/', authenticate, async (req, res) => {
  try {
    const input = createRunSchema.parse(req.body);
    const result = await createRun(db, input);
    
    if (!result.success) {
      res.status(400).json({ error: result.error.message });
      return;
    }
    
    res.status(201).json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Client Usage Pattern
```typescript
// ✅ Good - Always check Result.success
const result = await foreman.createTask({
  runId: 'run-123',
  type: 'process',
  inputData: { /* data */ }
});

if (!result.success) {
  logger.error('Failed to create task', result.error);
  return;
}

const task = result.data;

// ❌ Bad - Assuming success
const task = await foreman.createTask({ /* ... */ });
// This won't work - client returns Result types
```

## Key Data Model Concepts

### Runs
- Top-level execution context
- Contains input/output data and metadata
- Tracks overall status and metrics
- Organization-scoped for multi-tenancy

### Tasks
- Individual units of work within a run
- Hierarchical (parent-child relationships)
- Status lifecycle: pending → queued → running → completed/failed
- Retry support with configurable max retries
- Links to external queue job IDs

### Run Data
- Key-value storage for inter-task communication
- Supports multiple values per key (no unique constraint)
- Tags array for categorization and filtering
- Scoped to runs for isolation
- Tracks which task created each entry

### Authentication
- Simple API key format validation: `fmn_[env]_[orgId]_[random]`
- No database storage (fully trusted environment)
- Organization ID extracted from key
- All authenticated users have full access
- Supports both `x-api-key` header and `Authorization: Bearer` format
- Can be disabled via environment variables for testing

## Common Tasks

### Adding a New Domain Entity
1. Add types to `foreman-server/src/types.ts`
2. Create migration in `/database/foreman/migrations/`
3. Add mapper functions to `foreman-server/src/mappers.ts`
4. Create domain functions in `foreman-server/src/domain/[entity]/`
5. Add routes in `foreman-server/src/routes/`
6. Update client in `foreman-client/src/index.ts`

### Adding a New API Endpoint
1. Define request/response types
2. Create Zod validation schemas
3. Implement domain function with Result type
4. Add route with authentication and validation
5. Add client method
6. Document in `/docs/api-reference.md`

### Database Changes
1. Create migration: `npm run migrate:foreman:make your_migration_name`
2. Edit migration file with up/down functions
3. Run migration: `npm run migrate:foreman:latest` (only when asked)
4. Update types and mappers accordingly

## Testing & Quality

### Two-Layer Testing Architecture

Foreman implements a comprehensive testing strategy with two distinct test suites:

#### 1. Integration Tests (`foreman-integration-tests`)
- **Purpose**: Test the REST API directly using HTTP requests
- **Database**: Uses `foreman_test` database
- **Server**: Spawns real Foreman server on port 5099
- **Coverage**: 49 tests covering all API endpoints
- **Location**: `/node/packages/foreman-integration-tests`
- **Key Features**:
  - Direct HTTP testing of all endpoints
  - Authentication middleware validation
  - Error handling and edge cases
  - Pagination and filtering tests
  - Database constraint validation

#### 2. Client Tests (`foreman-client`)
- **Purpose**: Test the TypeScript client library
- **Database**: Uses `foreman_client_test` database  
- **Server**: Spawns real Foreman server on port 5003
- **Coverage**: 18 tests covering all client functions
- **Location**: `/node/packages/foreman-client/src/tests`
- **Key Features**:
  - Result type validation
  - Error propagation testing
  - Configuration handling
  - API integration through client SDK

### Test Utilities (`foreman-test-utils`)

Shared test infrastructure package providing:
- `TestServer`: Manages Foreman server lifecycle for tests
- `TestDatabase`: Handles test database setup/teardown
- `TestHttpClient`: Axios-based HTTP client for integration tests

This package is used as a devDependency by both test suites, eliminating code duplication while keeping the client package clean for npm publishing.

### Test Commands
```bash
# Integration tests
npm run test:integration:foreman       # Run all integration tests
npm run test:integration:foreman:watch  # Run integration tests in watch mode
npm run test:grep -- "Pattern"         # Run specific integration test suite

# Client tests
npm run test:client                    # Run all client tests
npm run test:client:watch              # Run client tests in watch mode
npm run test:client:grep -- "Pattern"  # Run specific client test suite

# All tests
npm run test:integration:all           # Run all tests (integration + client)
```

### Test Database Management

- Each test suite uses its own database to allow parallel execution
- Databases are dropped and recreated with fresh migrations before each test run
- Tables are truncated between individual tests for isolation
- Migration state is properly tracked in the test databases

### Running Tests

#### Prerequisites
```bash
# Start PostgreSQL
cd devenv
./run.sh up
```

#### Test Execution
```bash
# Run all tests
npm run test:integration:all

# Run specific suite with grep
npm run test:grep -- "Run Data API"
npm run test:client:grep -- "should create run data"
```

### Testing Guidelines for Debugging and Fixes

**IMPORTANT**: When fixing bugs or debugging issues:
1. **Always run individual tests** when fixing specific issues
2. Use `npm run test:grep -- "test name"` to run specific test suites
3. Use `npm run test:client:grep -- "test name"` for client-specific tests
4. Test incrementally - run the specific failing test after each change
5. Only run the full test suite after individual tests pass

This approach:
- Provides faster feedback loops
- Makes debugging easier
- Prevents breaking other tests while fixing one
- Saves time during development

## Important Notes

### Queue Integration Pattern
The core principle of Foreman:
```typescript
// 1. Create task with full data in Foreman
const task = await foreman.createTask({ /* all data */ });

// 2. Queue ONLY the task ID
await queue.add('process', { taskId: task.data.id });

// 3. Worker fetches full data from Foreman
const taskData = await foreman.getTask(taskId);
```

### Security Model
- Fully trusted environment behind firewall
- Simple API key format validation only
- Organization ID extracted from API key
- Rate limiting on endpoints
- No permission checks - all authenticated users have full access

### API Response Formats

#### Pagination
All list endpoints return paginated results with this structure:
```typescript
{
  data: T[],
  pagination: {
    total: number,
    limit: number,
    offset: number
  }
}
```

#### Error Responses
- 400: Invalid request data or validation errors
- 401: Authentication required or invalid API key
- 404: Resource not found
- 500: Internal server error

Error format:
```json
{
  "error": "Error message",
  "details": []  // Optional, for validation errors
}
```

### Run Data Query API

The `GET /api/v1/runs/:runId/data` endpoint supports flexible querying:

- `key`: Exact key match
- `keys`: Multiple exact keys (comma-separated)
- `keyStartsWith`: Key prefix match
- `keyPattern`: Glob pattern for keys
- `tags`: Filter by tags (comma-separated)
- `tagStartsWith`: Tag prefix match
- `tagMode`: 'any' (default) or 'all'
- `includeAll`: Return all values (not just latest per key)
- `sortBy`: 'created_at' (default), 'updated_at', or 'key'
- `sortOrder`: 'desc' (default) or 'asc'
- Standard pagination: `limit`, `offset`

## Error Handling

- Use Result types everywhere
- Never throw exceptions for expected errors
- Log errors with full context
- Return consistent error responses
- Include request IDs in logs for tracing