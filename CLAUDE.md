# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: NEVER ACT WITHOUT EXPLICIT USER APPROVAL

**YOU MUST ALWAYS ASK FOR PERMISSION BEFORE:**

- Making architectural decisions or changes
- Implementing new features or functionality
- Modifying APIs, interfaces, or data structures
- Changing expected behavior or test expectations
- Adding new dependencies or patterns

**ONLY make changes AFTER the user explicitly approves.** When you identify issues or potential improvements, explain them clearly and wait for the user's decision. Do NOT assume what the user wants or make "helpful" changes without permission.

## CRITICAL: FINISH DISCUSSIONS BEFORE WRITING CODE

**IMPORTANT**: When the user asks a question or you're in the middle of a discussion, DO NOT jump to writing code. Always:

1. **Complete the discussion first** - Understand the problem fully
2. **Analyze and explain** - Work through the issue verbally
3. **Get confirmation** - Ensure the user agrees with the approach
4. **Only then write code** - After the user explicitly asks you to implement

Do not write code while discussing or analyzing a problem unless the user specifically asks you to.

## CRITICAL: NEVER USE MULTIEDIT

**NEVER use the MultiEdit tool.** It has caused issues in multiple projects. Always use individual Edit operations instead, even if it means more edits. This ensures better control and prevents unintended changes.

## IMPORTANT: First Steps When Starting a Session

When you begin working on this project, you MUST:

1. **Read this entire CLAUDE.md file** to understand the project structure and conventions
2. **Read the key documentation files** in this order:
   - `/README.md` - Project overview and quick start
   - `/CODING-STANDARDS.md` - Mandatory coding patterns and conventions
   - `/docs/architecture.md` - System design and data flow
   - `/docs/api.md` - Complete REST API specification
   - `/docs/getting-started.md` - Tutorial and examples
   - Any other relevant docs based on the task at hand

Only after reading these documents should you proceed with any implementation or analysis tasks.

**IMPORTANT**: After every conversation compact/summary, you MUST re-read this CLAUDE.md file again as your first action. The conversation context gets compressed and critical project-specific instructions may be lost. Always start by reading CLAUDE.md after a compact.

## Task Management with .todos Directory

**IMPORTANT**: For major multi-step tasks that span sessions or require comprehensive tracking:

1. **Before starting a major task**, create a detailed task file in `.todos/` directory:
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

The `.todos/` directory is gitignored, so it won't clutter the repository but provides persistent task tracking across sessions.

## Key Documentation References

- **Project Overview**: See [README.md](../README.md)
- **Architecture**: See [docs/architecture.md](docs/architecture.md) for system design and data flow
- **API Documentation**: See [docs/api.md](docs/api.md) for complete API documentation including concepts, workflows, and endpoint reference
- **Configuration**: See [docs/configuration.md](docs/configuration.md) for environment variables
- **Deployment**: See [docs/deployment.md](docs/deployment.md) for Docker and production deployment
- **Getting Started**: See [docs/getting-started.md](docs/getting-started.md) for tutorials
- **TypeScript Client**: See [foreman-client README](node/packages/foreman-client/README.md)

## Overview

This guide helps AI assistants work effectively with the Foreman codebase. For project overview, see [README.md](../README.md).

## Project Context: Greenfield Development

**IMPORTANT**: Foreman is a greenfield project with no legacy constraints. When working on this codebase:

- **No backward compatibility concerns** - There are no existing deployments or users to migrate
- **No legacy code patterns** - All code should follow current best practices without compromise
- **No migration paths needed** - Database schemas, APIs, and data structures can be designed optimally from the start
- **Write code as if starting fresh** - Every implementation should be clean and modern
- **No change tracking in comments** - Avoid comments like "changed from X to Y" or "previously this was..." since there is no "previous" state
- **No deprecation warnings** - Nothing is deprecated because nothing is legacy

This means you should:

- Focus on clean, optimal implementations without worrying about existing systems
- Design data structures and APIs for the ideal case, not for compatibility
- Write code and comments as if everything is being written for the first time
- Make architectural decisions based purely on technical merit

## Documentation Principles

**IMPORTANT**: When writing or updating documentation:

- Write as if the spec was designed from the beginning, not evolved over time
- Avoid phrases like "now allows", "changed from", "previously was", "only X is allowed"
- Present features and constraints as inherent design decisions
- Documentation should be timeless - readable as a complete spec at any point

## Code Principles

**NO BACKWARDS COMPATIBILITY**:

- Do not write backwards compatibility code
- Do not maintain legacy interfaces or environment variables
- When refactoring, completely replace old implementations
- Remove all deprecated code paths
- The codebase should represent the current best design, not historical decisions

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

### 3. Security: Never Use npx

**CRITICAL SECURITY REQUIREMENT**: NEVER use `npx` for any commands. This poses grave security risks by executing arbitrary code.

- **ALWAYS use exact dependency versions** in package.json
- **ALWAYS use local node_modules binaries** (e.g., `prettier`, `mocha`, `http-server`)
- **NEVER use `npx prettier`** - use `prettier` from local dependencies
- **NEVER use `npx mocha`** - use `mocha` from local dependencies  
- **NEVER use `npx http-server`** - add `http-server` as dependency and use directly

**Exception**: The only acceptable `npx` usage is for one-time project initialization (e.g., `npx create-react-app`) when explicitly setting up new projects, but NEVER for ongoing development commands.

### 4. Database Conventions

- **PostgreSQL** with **Knex.js** for migrations
- **pg-promise** for data access (NO ORMs)
- Table names: **singular** and **snake_case** (e.g., `run`, `task`, `run_data`)
- TypeScript: **camelCase** for all variables/properties
- SQL: **snake_case** for all table/column names
- **DbRow Pattern**: All persistence functions use `XxxDbRow` types that mirror exact database schema
- **Mapper Functions**: `mapXxxFromDb()` and `mapXxxToDb()` handle conversions between snake_case DB and camelCase domain types
- **Type-safe Queries**: All queries use `db.one<XxxDbRow>()` with explicit type parameters

### Query Optimization Guidelines

- **Prefer simple separate queries over complex joins** when it only saves 1-3 database calls
- **Use joins only to prevent N+1 query problems** (e.g., fetching data for many items in a loop)
- **Prioritize code simplicity and readability** over minor performance optimizations
- **Example**: Instead of a complex join to fetch related data, use 2-3 simple queries when clearer
- This approach makes the code easier to understand and maintain

### 5. REST API Design

- RESTful endpoints (no GraphQL)
- JSON request/response bodies
- Standard HTTP status codes
- Bearer token authentication in Authorization header
- Consistent error response format

### 5. ESM Modules

- All imports MUST include `.js` extension: `import { foo } from "./bar.js"`
- TypeScript configured for `"module": "NodeNext"`
- Type: `"module"` in all package.json files
- **NO DYNAMIC IMPORTS**: Always use static imports. Never use `await import()` or `import()` in the code

### 6. SQL Helper Functions

Use `sql.insert()` and `sql.update()` from `@codespin/foreman-db` for safer, more consistent SQL generation:

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

### 7. Case Conversion Pattern

When working with database parameters, apply `toSnakeCase` judiciously:

```typescript
// ✅ Good - Use toSnakeCase for incoming camelCase objects
// When you have a REST API request object
const snakeParams = typeUtils.toSnakeCase(input); // input has camelCase properties

// ✅ Good - Directly create snake_case when building from individual parameters
const params = {
  run_id: runId,
  org_id: orgId,
  created_at: new Date(),
};
await db.one(`${sql.insert("task", params)} RETURNING *`, params);

// ❌ Unnecessary - Don't use toSnakeCase when manually constructing
const params = typeUtils.toSnakeCase({
  runId: runId,
  orgId: orgId,
});
// Instead, write directly: { run_id: runId, org_id: orgId }
```

**Key guideline**: Use `toSnakeCase` when converting existing camelCase objects (like REST API inputs), but directly create snake_case objects when constructing from individual parameters. This is a pattern to apply based on context, not a rigid rule.

## Essential Commands

### Build Commands

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
./scripts/docker-test.sh        # Test Docker image (see Docker section for options)
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

### Recent Database Migrations

See `/database/foreman/migrations/` for migration history. Key changes:

- Initial schema with core tables
- Added tags to run_data with GIN index
- Added updated_at columns with triggers
- Removed unique constraint on run_data for multi-value support

## Package Structure

See [README.md](../README.md#project-structure) for package details. Key point: When adding new packages, you MUST update the `PACKAGES` array in `./scripts/build.sh`.

## Development Workflow

1. **Define Types**: Add/update types in `foreman-server/src/types.ts`
2. **Create Migration**: Use `npm run migrate:foreman:make` for schema changes
3. **Implement Domain Functions**: Add domain functions in `foreman-server/src/domain/`
4. **Add Routes**: Implement REST endpoints in `foreman-server/src/routes/`
5. **Update Client**: Add methods to `foreman-client` if needed
6. **Build**: Run `./scripts/build.sh` from root
7. **Test**: Add integration tests in `foreman-integration-tests` and client tests in `foreman-client`

## Git Workflow

**CRITICAL GIT SAFETY RULES**:

1. **NEVER use `git push --force` or `git push -f`** - Force pushing destroys history and can lose work permanently
2. **ALL git push commands require EXPLICIT user authorization** - Never push to remote without the user explicitly asking
3. **Use revert commits instead of force push** - To undo changes, create revert commits that preserve history
4. **If you need to overwrite remote**, explain the consequences and get explicit confirmation first

**IMPORTANT**: NEVER commit and push changes without explicit user permission.

**NEW BRANCH REQUIREMENT**: ALL changes must be made on a new feature branch, never directly on main. When the user asks you to commit and push:

1. **Always create a new branch** with a descriptive name (e.g., `organize-scripts`, `fix-auth-bug`, `add-feature-name`)
2. **Make commits on the feature branch**
3. **Push the feature branch to remote**
4. **Never commit or push directly to main**

When the user asks you to commit and push:

1. Run `./scripts/format-all.sh` to format all files with Prettier
2. Run `./scripts/lint-all.sh` to ensure code passes linting
3. Follow the git commit guidelines in the main Claude system prompt
4. Get explicit user confirmation before any `git push`

**VERSION UPDATES**: Whenever committing changes, you MUST increment the patch version in package.json files when committing changes. This ensures proper version tracking for all changes.

## Configuration

See [Configuration Documentation](docs/configuration.md) for all environment variables and settings.

## Code Patterns

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

// ❌ Bad - Class-based approach
export class RunService {
  async createRun(input: CreateRunInput): Promise<Run> {
    // Don"t do this
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

// ❌ Bad - Assuming success
const task = await foreman.createTask({
  /* ... */
});
// This won"t work - client returns Result types
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
6. Document in `/docs/api.md`

### Database Changes

1. Create migration: `npm run migrate:foreman:make your_migration_name`
2. Edit migration file with up/down functions
3. Run migration: `npm run migrate:foreman:latest` (only when asked)
4. Update types and mappers accordingly

## Testing

### Test Output Strategy for Full Test Suites

**IMPORTANT**: When running the full test suite (which takes 3+ minutes), use `tee` to both display output to the user AND save to a file:

```bash
# Create .tests directory if it doesn't exist (gitignored)
mkdir -p .tests

# Run full test suite with tee - shows output to user AND saves to file
npm test | tee .tests/run-$(date +%s).txt

# Then you can analyze the saved output multiple times without re-running tests:
grep "failing" .tests/run-*.txt
tail -50 .tests/run-*.txt
grep -A10 "specific test name" .tests/run-*.txt
```

**NEVER use plain redirection (`>` or `2>&1`) as it hides output from the user.** Always use `tee` so the user can see test progress in real-time while you also get a saved copy for analysis.

This strategy prevents the need to re-run lengthy test suites when you need different information from the output. The `.tests/` directory is gitignored to keep test outputs from cluttering the repository.

## Analysis and Documentation

### Analysis Working Directory

**IMPORTANT**: When performing long-running analysis, research, or documentation tasks, use the `.analysis/` directory as your working space:

```bash
# Create .analysis directory if it doesn't exist (gitignored)
mkdir -p .analysis

# Use for analysis outputs, reports, and working files
cd .analysis

# Examples of analysis work:
# - Code complexity reports
# - API documentation generation
# - Dependency analysis
# - Performance profiling results
# - Architecture diagrams and documentation
# - Database schema analysis
# - Security audit reports
```

**Benefits of using `.analysis/` directory:**

- Keeps analysis artifacts separate from source code
- Allows iterative work without cluttering the repository
- Can save large analysis outputs without affecting git
- Provides a consistent location for all analysis work
- Enables saving intermediate results for complex multi-step analysis

**Common analysis patterns:**

```bash
# Save analysis results with timestamps
echo "Analysis results" > .analysis/api-analysis-$(date +%Y%m%d).md

# Create subdirectories for different analysis types
mkdir -p .analysis/performance
mkdir -p .analysis/security
mkdir -p .analysis/dependencies

# Use for generating documentation
npx typedoc --out .analysis/api-docs src/

# Save database schema analysis
pg_dump --schema-only foremandb > .analysis/schema-$(date +%Y%m%d).sql
```

The `.analysis/` directory is gitignored to prevent temporary analysis files from being committed to the repository.

### Running Tests

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

**IMPORTANT**: When running tests with mocha:

- Always use `npm run test:grep -- "pattern"` from the root directory for specific tests
- NEVER use `2>&1` redirection with mocha commands - it will cause errors
- Use plain `npm test` or `npx mocha` without stderr redirection
- If you need to capture output, use `| tee` or similar tools instead

### Testing Guidelines for Debugging and Fixes

**IMPORTANT**: When fixing bugs or debugging issues:

1. **Always run individual tests** when fixing specific issues
2. Use `npm run test:grep -- "test name"` to search both integration and client tests
3. Use `npm run test:integration:grep` or `test:client:grep` for specific test types
4. Test incrementally - run the specific failing test after each change
5. Run `npm test` for the full test suite (integration + client) after individual tests pass

This approach:

- Provides faster feedback loops
- Makes debugging easier
- Prevents breaking other tests while fixing one
- Saves time during development

### Optimizing Build Speed During Debugging

**TIP**: Use `./scripts/build.sh --no-format` during debugging sessions to skip prettier formatting. This:

- Reduces build time significantly
- Minimizes output that gets sent to the AI model (reducing token count)
- Makes the debugging cycle faster

Only use the standard `./scripts/build.sh` (with formatting) for final builds before committing.

## Debugging Tips

1. **Task execution issues**: Check task status transitions and queue job IDs
2. **Run data issues**: Verify scoping to correct run_id and check tags
3. **Authentication issues**: Verify Bearer token format and AUTH_REQUIRED setting
4. **Database connection**: Check DATABASE_URL and connection pooling
5. **Queue integration**: Ensure only task IDs are queued, not full data

## Important Notes

### Queue Integration Pattern

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

### Security Model

- Fully trusted environment behind firewall
- Simple Bearer token validation only
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

## Error Handling

- Use Result types everywhere
- Never throw exceptions for expected errors
- Log errors with full context
- Return consistent error responses
- Include request IDs in logs for tracing
