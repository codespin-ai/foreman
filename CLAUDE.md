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

## Package Structure

Located in `/node/packages/`, build order matters:

1. **@codespin/foreman-core** - Core types and Result utilities
2. **@codespin/foreman-logger** - Centralized logging with pino
3. **@codespin/foreman-db** - Database connection management
4. **@codespin/foreman-server** - REST API server
5. **@codespin/foreman-client** - Client library for API access
6. **@codespin/foreman-integration-tests** - Integration test suite

## Development Workflow

1. **Define Types**: Add/update types in `foreman-server/src/types.ts`
2. **Create Migration**: Use `npm run migrate:foreman:make` for schema changes
3. **Implement Domain Functions**: Add domain functions in `foreman-server/src/domain/`
4. **Add Routes**: Implement REST endpoints in `foreman-server/src/routes/`
5. **Update Client**: Add methods to `foreman-client` if needed
6. **Build**: Run `./build.sh` from root
7. **Test**: Add integration tests in `foreman-integration-tests`

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

- Integration tests in `foreman-integration-tests`
- Use Result types for all async operations
- Validate all inputs with Zod
- Log errors with context
- Follow TypeScript strict mode

## Important Notes

### This is NOT GraphQL
Unlike Permiso, Foreman uses REST API. Key differences:
- No GraphQL schema or resolvers
- RESTful endpoints with standard HTTP verbs
- JSON request/response bodies
- Client uses fetch instead of GraphQL client

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

## Error Handling

- Use Result types everywhere
- Never throw exceptions for expected errors
- Log errors with full context
- Return consistent error responses
- Include request IDs in logs for tracing