# Foreman Coding Standards

This document outlines the coding standards and patterns used throughout the Foreman codebase. All contributors should follow these guidelines to maintain consistency and quality.

## Core Principles

### 1. Functional Programming Only

**NO CLASSES** - Export functions from modules only.

```typescript
// ✅ Good - Pure function with explicit dependencies
export async function createRun(
  db: Database,
  input: CreateRunInput
): Promise<Result<Run, Error>> {
  // Implementation
}

// ❌ Bad - Class-based approach
export class RunService {
  constructor(private db: Database) {}
  
  async createRun(input: CreateRunInput): Promise<Run> {
    // Implementation
  }
}
```

### 2. Explicit Error Handling with Result Types

Use `Result<T, E>` for all operations that can fail. Never throw exceptions for expected errors.

```typescript
// ✅ Good - Using Result type
export async function findRun(
  db: Database,
  runId: string
): Promise<Result<Run, Error>> {
  try {
    const run = await db.oneOrNone<RunDbRow>(...);
    if (!run) {
      return failure(new Error('Run not found'));
    }
    return success(mapRunFromDb(run));
  } catch (error) {
    return failure(error as Error);
  }
}

// ❌ Bad - Throwing exceptions
export async function findRun(db: Database, runId: string): Promise<Run> {
  const run = await db.one<RunDbRow>(...); // Throws if not found
  return mapRunFromDb(run);
}
```

### 3. Database Patterns

#### DbRow Types
All database interactions use `*DbRow` types that exactly mirror the database schema with snake_case:

```typescript
// Database type (snake_case)
type RunDbRow = {
  id: string;
  org_id: string;
  status: string;
  created_at: Date;
  completed_at: Date | null;
};

// Domain type (camelCase)
type Run = {
  id: string;
  orgId: string;
  status: RunStatus;
  createdAt: Date;
  completedAt: Date | null;
};
```

#### Mapper Functions
Always use mapper functions to convert between database and domain representations:

```typescript
export function mapRunFromDb(row: RunDbRow): Run {
  return {
    id: row.id,
    orgId: row.org_id,
    status: row.status as RunStatus,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

export function mapRunToDb(run: Partial<Run>): Partial<RunDbRow> {
  return {
    id: run.id,
    org_id: run.orgId,
    status: run.status,
    created_at: run.createdAt,
    completed_at: run.completedAt
  };
}
```

#### Type-safe Queries
Always specify the type parameter for database queries and use named parameters:

```typescript
// ✅ Good - Type parameter specified with named parameters
const row = await db.one<RunDbRow>(
  `SELECT * FROM run WHERE id = $(id)`,
  { id: runId }
);

// ❌ Bad - Using positional parameters
const row = await db.one<RunDbRow>(
  `SELECT * FROM run WHERE id = $1`,
  [runId]
);

// ❌ Bad - No type parameter
const row = await db.one(
  `SELECT * FROM run WHERE id = $(id)`,
  { id: runId }
);
```

#### Named Parameters
ALWAYS use named parameters for database queries. This improves readability, prevents SQL injection, and makes queries self-documenting:

```typescript
// ✅ Good - Named parameters
const run = await db.one<RunDbRow>(
  `INSERT INTO run (id, org_id, status, input_data) 
   VALUES ($(id), $(orgId), $(status), $(inputData)) 
   RETURNING *`,
  {
    id: input.id,
    orgId: input.orgId,
    status: 'pending',
    inputData: input.data
  }
);

// ❌ Bad - Positional parameters
const run = await db.one<RunDbRow>(
  `INSERT INTO run (id, org_id, status, input_data) 
   VALUES ($1, $2, $3, $4) 
   RETURNING *`,
  [input.id, input.orgId, 'pending', input.data]
);
```

### 4. Module Structure

#### Imports
All imports MUST include the `.js` extension:

```typescript
// ✅ Good
import { createRun } from './runs.js';
import { Result } from '@codespin/foreman-core';

// ❌ Bad
import { createRun } from './runs';
```

#### Exports
Use named exports, avoid default exports:

```typescript
// ✅ Good
export function createRun() { ... }
export function updateRun() { ... }
export type Run = { ... };

// ❌ Bad
export default class RunService { ... }
```

### 5. Naming Conventions

#### General Rules
- **Functions**: camelCase (`createRun`, `findRunById`)
- **Types/Interfaces**: PascalCase (`Run`, `CreateRunInput`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Files**: kebab-case (`run-service.ts`, `create-run.ts`)
- **Acronyms**: Keep acronyms 3 letters or shorter in UPPERCASE (`totalMS`, `apiURL`, `getXMLData`) but longer acronyms use PascalCase (`HttpClient`, `JsonParser`)

#### Database Naming
- **Tables**: singular, snake_case (`run`, `task`, `run_data`)
- **Columns**: snake_case (`run_id`, `created_at`)
- **Indexes**: `idx_table_column` (`idx_run_status`)

### 6. TypeScript Guidelines

#### Strict Mode
Always use TypeScript strict mode. The following compiler options must be enabled:

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedIndexedAccess": true
}
```

#### Type vs Interface
Prefer `type` over `interface` unless you need interface-specific features:

```typescript
// ✅ Good - Using type
type Run = {
  id: string;
  status: string;
};

// Use interface only for extensible contracts
interface Logger {
  log(message: string): void;
  error(message: string, error: Error): void;
}
```

#### Avoid `any`
Never use `any`. Use `unknown` if the type is truly unknown:

```typescript
// ✅ Good
function processValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

// ❌ Bad
function processValue(value: any): string {
  return value;
}
```

### 7. Async/Await Pattern

Always use async/await instead of promises with `.then()`:

```typescript
// ✅ Good
export async function createRunWithTasks(
  db: Database,
  runInput: CreateRunInput,
  taskInputs: CreateTaskInput[]
): Promise<Result<Run>> {
  const runResult = await createRun(db, runInput);
  if (!runResult.success) {
    return runResult;
  }
  
  for (const taskInput of taskInputs) {
    const taskResult = await createTask(db, runResult.data.id, taskInput);
    if (!taskResult.success) {
      return failure(taskResult.error);
    }
  }
  
  return runResult;
}

// ❌ Bad
export function createRunWithTasks(
  db: Database,
  runInput: CreateRunInput,
  taskInputs: CreateTaskInput[]
): Promise<Result<Run>> {
  return createRun(db, runInput).then(runResult => {
    if (!runResult.success) {
      return runResult;
    }
    // Chain of promises...
  });
}
```

### 8. Documentation

#### JSDoc Comments
Add JSDoc comments for all exported functions and types:

```typescript
/**
 * Creates a new run in the specified organization.
 * 
 * @param db - Database connection
 * @param input - Run creation parameters
 * @returns Result containing the created run or an error
 * 
 * @example
 * const result = await createRun(db, {
 *   id: 'run-123',
 *   orgId: 'acme-corp',
 *   inputData: { task: 'process-order' }
 * });
 */
export async function createRun(
  db: Database,
  input: CreateRunInput
): Promise<Result<Run, Error>> {
  // Implementation
}
```

### 9. Testing

#### Test Structure
- Place tests in `__tests__` directories
- Name test files with `.test.ts` suffix
- Use descriptive test names

```typescript
describe('createRun', () => {
  it('should create a run with valid input', async () => {
    // Arrange
    const input = { ... };
    
    // Act
    const result = await createRun(db, input);
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ ... });
  });
  
  it('should return error when organization does not exist', async () => {
    // Test implementation
  });
});
```

### 10. Performance Considerations

#### Database Queries
- ALWAYS use named parameters (e.g., `$(paramName)`) instead of positional parameters (e.g., `$1`)
- Use parameterized queries to prevent SQL injection
- Add appropriate indexes for frequently queried columns
- Use transactions for operations that modify multiple tables
- Avoid N+1 queries by using joins or batch operations

#### Memory Management
- Stream large result sets instead of loading all data into memory
- Use pagination for list operations
- Clean up resources (close database connections, etc.)

## Code Review Checklist

Before submitting a PR, ensure:

- [ ] All functions use Result types for error handling
- [ ] No classes are used
- [ ] All imports include `.js` extension
- [ ] Database queries use typed parameters
- [ ] JSDoc comments are present for public APIs
- [ ] Tests are included for new functionality
- [ ] No `any` types are used
- [ ] Code follows the naming conventions
- [ ] No console.log statements (use logger instead)