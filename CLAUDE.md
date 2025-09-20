# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Foreman codebase.

## Critical Guidelines

### NEVER ACT WITHOUT EXPLICIT USER APPROVAL

**YOU MUST ALWAYS ASK FOR PERMISSION BEFORE:**

- Making architectural decisions or changes
- Implementing new features or functionality
- Modifying APIs, interfaces, or data structures
- Changing expected behavior or test expectations
- Adding new dependencies or patterns

**ONLY make changes AFTER the user explicitly approves.** When you identify issues or potential improvements, explain them clearly and wait for the user's decision. Do NOT assume what the user wants or make "helpful" changes without permission.

### FINISH DISCUSSIONS BEFORE WRITING CODE

**IMPORTANT**: When the user asks a question or you're in the middle of a discussion, DO NOT jump to writing code. Always:

1. **Complete the discussion first** - Understand the problem fully
2. **Analyze and explain** - Work through the issue verbally
3. **Get confirmation** - Ensure the user agrees with the approach
4. **Only then write code** - After the user explicitly asks you to implement

### NEVER USE MULTIEDIT

**NEVER use the MultiEdit tool.** It has caused issues in multiple projects. Always use individual Edit operations instead, even if it means more edits. This ensures better control and prevents unintended changes.

## Session Startup & Task Management

### First Steps When Starting a Session

When you begin working on this project, you MUST:

1. **Read this entire CLAUDE.md file** to understand the project structure and conventions
2. **Check for ongoing tasks in `.todos/` directory** - Look for any in-progress task files
3. **Read the key documentation files** in this order:
   - `/README.md` - Project overview and quick start
   - `/CODING-STANDARDS.md` - Mandatory coding patterns and conventions
   - `/docs/architecture.md` - System design and data flow
   - `/docs/api.md` - Complete REST API specification
   - `/docs/getting-started.md` - Tutorial and examples
   - Any other relevant docs based on the task at hand

Only after reading these documents should you proceed with any implementation or analysis tasks.

**IMPORTANT**: After every conversation compact/summary, you MUST re-read this CLAUDE.md file again as your first action.

### Task Management with .todos Directory

**For major multi-step tasks that span sessions:**

1. **Before starting**, create a detailed task file in `.todos/` directory:
   - Filename format: `YYYY-MM-DD-task-name.md` (e.g., `2025-01-13-workflow-implementation.md`)
   - Include ALL context, decisions, completed work, and remaining work
   - Write comprehensively so the task can be resumed in any future session

2. **Task file must include**:
   - Task overview and objectives
   - Current status (what's been completed)
   - Detailed list of remaining work
   - Important decisions made
   - Code locations affected
   - Testing requirements
   - Any gotchas or special considerations

3. **When resuming work**, always check `.todos/` first for in-progress tasks
4. **Update the task file** as you make progress
5. **Mark as complete** by renaming to `YYYY-MM-DD-task-name-COMPLETED.md`

The `.todos/` directory is gitignored for persistent task tracking across sessions.

## Project Overview & Principles

This guide helps AI assistants work effectively with the Foreman codebase. For project overview, see [README.md](../README.md).

### Greenfield Development Context

**IMPORTANT**: Foreman is a greenfield project with no legacy constraints:

- **No backward compatibility concerns** - No existing deployments or users to migrate
- **No legacy code patterns** - All code should follow current best practices without compromise
- **No migration paths needed** - Database schemas, APIs, and data structures can be designed optimally
- **Write code as if starting fresh** - Every implementation should be clean and modern
- **No change tracking in comments** - Avoid "changed from X to Y" since there is no "previous" state
- **No deprecation warnings** - Nothing is deprecated because nothing is legacy

This means: Focus on clean, optimal implementations without worrying about existing systems. Design for the ideal case, not for compatibility.

### Documentation & Code Principles

**Documentation Guidelines:**

- Write as if the spec was designed from the beginning, not evolved over time
- Avoid phrases like "now allows", "changed from", "previously was"
- Present features and constraints as inherent design decisions
- Be concise and technical - avoid promotional language, superlatives
- Use active voice and include code examples
- Keep README.md as single source of truth

**Code Principles:**

- **NO BACKWARDS COMPATIBILITY** - Do not write backwards compatibility code
- **NO CLASSES** - Export functions from modules only, use explicit dependency injection
- **NO DYNAMIC IMPORTS** - Always use static imports, never `await import()` or `import()`
- Use pure functions with Result types for error handling instead of exceptions
- Prefer `type` over `interface` (use `interface` only for extensible contracts)

## Core Architecture Principles

### 1. ID-Only Queue Pattern

- **NEVER** store task data in queues (BullMQ, SQS, etc.)
- **ALWAYS** store all task data in PostgreSQL
- Queues contain only task IDs
- Workers fetch full data from Foreman before processing

### 2. Security: Never Use npx

**CRITICAL SECURITY REQUIREMENT**: NEVER use `npx` for any commands. This poses grave security risks by executing arbitrary code.

- **ALWAYS use exact dependency versions** in package.json
- **ALWAYS use local node_modules binaries** (e.g., `prettier`, `mocha`, `http-server`)
- **NEVER use `npx prettier`** - use `prettier` from local dependencies
- **NEVER use `npx mocha`** - use `mocha` from local dependencies

**Exception**: Only acceptable `npx` usage is for one-time project initialization when explicitly setting up new projects.

### 3. REST API Design

- RESTful endpoints (no GraphQL)
- JSON request/response bodies
- Standard HTTP status codes
- Bearer token authentication in Authorization header
- Consistent error response format

### 4. Database Conventions

- **PostgreSQL** with **Knex.js** for migrations, **pg-promise** for data access (NO ORMs)
- Table names: **singular** and **snake_case** (e.g., `run`, `task`, `run_data`)
- TypeScript: **camelCase** for all variables/properties
- SQL: **snake_case** for all table/column names
- **DbRow Pattern**: All persistence functions use `XxxDbRow` types that mirror exact database schema
- **Mapper Functions**: `mapXxxFromDb()` and `mapXxxToDb()` handle conversions between snake_case DB and camelCase domain types
- **Type-safe Queries**: All queries use `db.one<XxxDbRow>()` with explicit type parameters

**Query Optimization Guidelines**:

- **Prefer simple separate queries over complex joins** when it only saves 1-3 database calls
- **Use joins only to prevent N+1 query problems** (e.g., fetching data for many items in a loop)
- **Prioritize code simplicity and readability** over minor performance optimizations

### 5. ESM Modules

- All imports MUST include `.js` extension: `import { foo } from "./bar.js"`
- TypeScript configured for `"module": "NodeNext"`
- Type: `"module"` in all package.json files
- **NO DYNAMIC IMPORTS**: Always use static imports. Never use `await import()` or `import()` in the code

## Essential Commands & Workflow

### Build & Development Commands

```bash
# Build entire project (from root)
./scripts/build.sh              # Standard build with formatting
./scripts/build.sh --install    # Force npm install in all packages
./scripts/build.sh --migrate    # Build + run DB migrations
./scripts/build.sh --no-format  # Skip prettier formatting (faster builds)

# Clean build artifacts
./scripts/clean.sh

# Start the server
./scripts/start.sh

# Lint entire project (from root)
./scripts/lint-all.sh           # Run ESLint on all packages
./scripts/lint-all.sh --fix     # Run ESLint with auto-fix

# Format code with Prettier (MUST run before committing)
./scripts/format-all.sh         # Format all files
./scripts/format-all.sh --check # Check formatting without changing files

# Docker commands
./scripts/docker-build.sh       # Build Docker image
./scripts/docker-test.sh        # Test Docker image
./scripts/docker-push.sh latest ghcr.io/codespin-ai  # Push to registry
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

### Testing Commands

```bash
# Run all tests (integration + client)
npm test

# Search for specific tests across BOTH integration and client
npm run test:grep -- "pattern to match"

# Search only integration tests
npm run test:integration:grep -- "pattern to match"

# Search only client tests
npm run test:client:grep -- "pattern to match"

# Examples:
npm run test:grep -- "should create"          # Searches both integration and client
npm run test:grep -- "workflow"               # Searches both integration and client
npm run test:integration:grep -- "execution"  # Only integration tests
npm run test:client:grep -- "fetch workflow"  # Only client tests
```

**IMPORTANT**: When running tests with mocha, always use `npm run test:grep -- "pattern"` from the root directory for specific tests. NEVER use `2>&1` redirection with mocha commands. Use `| tee` for output capture.

### Git Workflow

**CRITICAL GIT SAFETY RULES**:

1. **NEVER use `git push --force` or `git push -f`** - Force pushing destroys history
2. **ALL git push commands require EXPLICIT user authorization**
3. **Use revert commits instead of force push** - To undo changes, create revert commits
4. **If you need to overwrite remote**, explain consequences and get explicit confirmation

**IMPORTANT**: NEVER commit or push changes without explicit user instruction

- Only run `git add`, `git commit`, or `git push` when the user explicitly asks
- Common explicit instructions include: "commit", "push", "commit and push", "save to git"
- Always wait for user approval before making any git operations

**NEW BRANCH REQUIREMENT**: ALL changes must be made on a new feature branch, never directly on main.

When the user asks you to commit and push:

1. Run `./scripts/format-all.sh` to format all files with Prettier
2. Run `./scripts/lint-all.sh` to ensure code passes linting
3. Follow the git commit guidelines in the main Claude system prompt
4. Get explicit user confirmation before any `git push`

**VERSION UPDATES**: Whenever committing changes, you MUST increment the patch version in package.json files.

## Code Patterns

### SQL Helper Functions

Use `sql.insert()` and `sql.update()` from `@codespin/foreman-db`:

```typescript
import { sql } from "@codespin/foreman-db";

// ✅ Good - Using sql.insert()
const params = {
  id: input.id,
  org_id: input.orgId,
  name: input.name,
};
await db.one(`${sql.insert("run", params)} RETURNING *`, params);

// ✅ Good - Using sql.update() with WHERE clause
const updateParams = { status: input.status };
const query = `
  ${sql.update("task", updateParams)}
  WHERE id = $(taskId) AND org_id = $(orgId)
  RETURNING *
`;
await db.one(query, { ...updateParams, taskId, orgId });
```

### Case Conversion Pattern

**Key guideline**: Use `toSnakeCase` when converting existing camelCase objects (like REST API inputs), but directly create snake_case objects when constructing from individual parameters.

```typescript
// ✅ Good - Use toSnakeCase for incoming camelCase objects
const snakeParams = typeUtils.toSnakeCase(input); // input has camelCase properties

// ✅ Good - Directly create snake_case when building from individual parameters
const params = {
  run_id: runId,
  org_id: orgId,
  created_at: new Date(),
};
await db.one(`${sql.insert("task", params)} RETURNING *`, params);
```

### Domain Function Pattern

```typescript
// ✅ Good - Pure function with Result type
export async function createRun(
  db: Database,
  input: CreateRunInput,
): Promise<Result<Run, Error>> {
  try {
    const row = await db.one<RunDbRow>(
      `INSERT INTO run (id, org_id, status, input_data)
       VALUES ($(id), $(orgId), $(status), $(inputData))
       RETURNING *`,
      { id, orgId, status, inputData },
    );
    return success(mapRunFromDb(row));
  } catch (error) {
    return failure(error as Error);
  }
}
```

### REST Route Pattern

```typescript
// ✅ Good - Zod validation, proper error handling
router.post("/", authenticate, async (req, res) => {
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
      res.status(400).json({ error: "Invalid request", details: error.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});
```

### Client Usage Pattern

```typescript
// ✅ Good - Always check Result.success
const result = await foreman.createTask({
  runId: "run-123",
  type: "process",
  inputData: {
    /* data */
  },
});

if (!result.success) {
  logger.error("Failed to create task", result.error);
  return;
}

const task = result.data;
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

- Simple Bearer token validation
- No database storage (fully trusted environment)
- All authenticated users have full access
- Only supports `Authorization: Bearer` format
- Can be disabled via environment variables for testing

## Testing & Development Optimization

### Test Output Strategy

**For full test suites (3+ minutes)**, use `tee` to display output AND save to file:

```bash
# Create .tests directory if it doesn't exist (gitignored)
mkdir -p .tests

# Run full test suite with tee - shows output to user AND saves to file
npm test | tee .tests/run-$(date +%s).txt

# Then analyze saved output without re-running tests:
grep "failing" .tests/run-*.txt
tail -50 .tests/run-*.txt
grep -A10 "specific test name" .tests/run-*.txt
```

**NEVER use plain redirection (`>` or `2>&1`)** - use `tee` for real-time output visibility.

### Analysis Working Directory

**For long-running analysis, research, or documentation tasks**, use `.analysis/` directory:

```bash
# Create .analysis directory if it doesn't exist (gitignored)
mkdir -p .analysis

# Examples of analysis work:
# - Code complexity reports
# - API documentation generation
# - Dependency analysis
# - Performance profiling results
# - Architecture diagrams and documentation
# - Database schema analysis
# - Security audit reports
```

Benefits: Keeps analysis artifacts separate from source code, allows iterative work without cluttering repository.

### Build & Lint Workflow

**ALWAYS follow this sequence:**

1. Run `./scripts/lint-all.sh` first
2. Run `./scripts/build.sh`
3. **If build fails and you make changes**: You MUST run `./scripts/lint-all.sh` again before building

**TIP**: Use `./scripts/build.sh --no-format` during debugging sessions to skip prettier formatting for faster builds.

## Common Development Tasks

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
6. Document in `/docs/api.md`

### Database Changes

1. Create migration: `npm run migrate:foreman:make your_migration_name`
2. Edit migration file with up/down functions
3. Run migration: `npm run migrate:foreman:latest` (only when asked)
4. Update types and mappers accordingly

## API Response Formats

### Pagination

All list endpoints return paginated results:

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

### Error Responses

- 400: Invalid request data or validation errors
- 401: Authentication required or invalid Bearer token
- 404: Resource not found
- 500: Internal server error

Error format:

```json
{
  "error": "Error message",
  "details": [] // Optional, for validation errors
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
- `tagMode`: "any" (default) or "all"
- `includeAll`: Return all values (not just latest per key)
- `sortBy`: "created_at" (default), "updated_at", or "key"
- `sortOrder`: "desc" (default) or "asc"
- Standard pagination: `limit`, `offset`

## Queue Integration Pattern

The core principle of Foreman:

```typescript
// 1. Create task with full data in Foreman
const task = await foreman.createTask({
  /* all data */
});

// 2. Queue ONLY the task ID
await queue.add("process", { taskId: task.data.id });

// 3. Worker fetches full data from Foreman
const taskData = await foreman.getTask(taskId);
```

## Documentation References

- **Project Overview**: [README.md](../README.md)
- **Architecture**: [docs/architecture.md](docs/architecture.md) for system design and data flow
- **API Documentation**: [docs/api.md](docs/api.md) for complete API documentation including concepts, workflows, and endpoint reference
- **Configuration**: [docs/configuration.md](docs/configuration.md) for environment variables
- **Deployment**: [docs/deployment.md](docs/deployment.md) for Docker and production deployment
- **Getting Started**: [docs/getting-started.md](docs/getting-started.md) for tutorials
- **TypeScript Client**: [foreman-client README](node/packages/foreman-client/README.md)

## Debugging Tips

1. **Task execution issues**: Check task status transitions and queue job IDs
2. **Run data issues**: Verify scoping to correct run_id and check tags
3. **Authentication issues**: Verify Bearer token format and AUTH_REQUIRED setting
4. **Database connection**: Check DATABASE_URL and connection pooling
5. **Queue integration**: Ensure only task IDs are queued, not full data

## Security Model

- Fully trusted environment behind firewall
- Simple Bearer token validation only
- Rate limiting on endpoints
- No permission checks - all authenticated users have full access
