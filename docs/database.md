# Foreman Database Design

## Overview

Foreman uses PostgreSQL as its primary data store, following the principle that all task data should be stored in the database, not in queues. This document describes the database schema, design decisions, and best practices.

## Design Principles

1. **Single Source of Truth**: All task and run data stored in PostgreSQL
2. **Multi-tenancy**: Every table has `org_id` for organization isolation
3. **Timestamps**: Created/updated timestamps stored as BIGINT (epoch milliseconds)
4. **Flexible Storage**: JSONB for variable data structures
5. **Referential Integrity**: Foreign keys with appropriate cascades

## Schema Overview

### Core Tables

1. **run** - Top-level execution contexts
2. **task** - Individual units of work
3. **run_data** - Key-value storage for inter-task communication

### Relationships

```
run (1) ──────────────────┐
  │                       │
  │ (many)                │ (many)
  ▼                       ▼
task (1) ────────────> run_data
  │
  │ (parent-child)
  ▼
task
```

## Table Definitions

### Run Table

Stores top-level execution contexts with overall status and metrics.

```sql
CREATE TABLE run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT "pending"
    CHECK (status IN ("pending", "running", "completed", "failed", "cancelled")),
  input_data JSONB NOT NULL,
  output_data JSONB,
  error_data JSONB,
  metadata JSONB,
  total_tasks INTEGER NOT NULL,
  completed_tasks INTEGER NOT NULL,
  failed_tasks INTEGER NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  started_at BIGINT,
  completed_at BIGINT,
  duration_ms BIGINT
);

-- Indexes
CREATE INDEX idx_run_org_created ON run(org_id, created_at DESC);
CREATE INDEX idx_run_status ON run(status) WHERE status IN ("pending", "running");
CREATE INDEX idx_run_created ON run(created_at DESC);
```

**Column Notes:**

- `id`: UUID for globally unique identification
- `org_id`: Organization identifier for multi-tenancy
- `status`: Current execution state
- `input_data`: Initial data provided when creating the run
- `output_data`: Final results after completion
- `error_data`: Error details if run failed
- `metadata`: Additional flexible data (tags, labels, etc.)
- `created_at`/`updated_at`: Epoch milliseconds from application
- `duration_ms`: Calculated as `completed_at - started_at` in milliseconds

### Task Table

Stores individual units of work with hierarchical support.

```sql
CREATE TABLE task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES task(id) ON DELETE CASCADE,
  org_id VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL
    CHECK (status IN ("pending", "queued", "running", "completed",
                      "failed", "cancelled", "retrying")),
  input_data JSONB NOT NULL,
  output_data JSONB,
  error_data JSONB,
  metadata JSONB,
  retry_count INTEGER NOT NULL,
  max_retries INTEGER NOT NULL CHECK (max_retries >= 0 AND max_retries <= 10),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  queued_at BIGINT,
  started_at BIGINT,
  completed_at BIGINT,
  duration_ms BIGINT,
  queue_job_id VARCHAR(255)
);

-- Indexes
CREATE INDEX idx_task_run ON task(run_id);
CREATE INDEX idx_task_parent ON task(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_task_org_created ON task(org_id, created_at DESC);
CREATE INDEX idx_task_status ON task(status) WHERE status IN ("pending", "queued", "running");
CREATE INDEX idx_task_type ON task(type);
CREATE INDEX idx_task_queue_job ON task(queue_job_id) WHERE queue_job_id IS NOT NULL;
```

**Column Notes:**

- `parent_task_id`: Enables task hierarchies/dependencies
- `type`: Task type identifier (e.g., "send-email", "process-payment")
- `queue_job_id`: External queue system"s job identifier
- `retry_count`: Current retry attempt number
- `max_retries`: Maximum allowed retries for this task

### Run Data Table

Key-value storage for sharing data between tasks within a run. Supports tags for categorization and allows multiple entries with the same key.

```sql
CREATE TABLE run_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  org_id VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  tags TEXT[] NOT NULL,
  metadata JSONB,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Note: No unique constraint on (run_id, key) - allows multiple entries

-- Indexes
CREATE INDEX idx_run_data_run ON run_data(run_id);
CREATE INDEX idx_run_data_task ON run_data(task_id);
CREATE INDEX idx_run_data_org ON run_data(org_id);
CREATE INDEX idx_run_data_key ON run_data(key);
CREATE INDEX idx_run_data_created ON run_data(created_at DESC);
CREATE INDEX idx_run_data_tags ON run_data USING GIN(tags);
CREATE INDEX idx_run_data_key_prefix ON run_data(key text_pattern_ops);

```

**Column Notes:**

- `key`: Can have multiple entries per run (no unique constraint)
- `task_id`: Which task created/updated this data
- `value`: Arbitrary JSON data
- `tags`: Array of text tags for categorization and filtering
- `created_at`/`updated_at`: Epoch milliseconds managed by application

**Index Notes:**

- `GIN index on tags`: Efficient array containment queries
- `text_pattern_ops on key`: Efficient prefix matching (LIKE "prefix%")

### Authentication Note

Foreman uses simplified authentication suitable for a fully trusted environment. Bearer tokens are validated by the middleware without database lookups.

## Design Decisions

### Why JSONB?

1. **Flexibility**: Different task types need different data structures
2. **Evolution**: Schema can evolve without migrations
3. **Querying**: PostgreSQL JSONB supports indexing and queries
4. **Performance**: Binary format is efficient

### Why UUIDs?

1. **Global Uniqueness**: No collisions across distributed systems
2. **Security**: Not guessable/enumerable like sequential IDs
3. **Merge Safety**: Can merge databases without conflicts
4. **Client Generation**: Clients can generate IDs

### Indexing Strategy

1. **Primary Access Patterns**: Indexes on common query patterns
2. **Partial Indexes**: For status fields with selective queries
3. **Composite Indexes**: For multi-column queries (org_id + created_at)
4. **Foreign Keys**: Automatically indexed by PostgreSQL

### Cascade Strategy

1. **Run → Task**: CASCADE DELETE (deleting run deletes all tasks)
2. **Task → Task**: CASCADE DELETE (deleting parent deletes children)
3. **Run → Run Data**: CASCADE DELETE (deleting run deletes all data)
4. **Task → Run Data**: CASCADE DELETE (deleting task deletes its data)

## Query Patterns

### Common Queries

```sql
-- Get active runs for an organization
SELECT * FROM run
WHERE org_id = $1
  AND status IN ("pending", "running")
ORDER BY created_at DESC;

-- Get task hierarchy
WITH RECURSIVE task_tree AS (
  SELECT * FROM task WHERE id = $1
  UNION ALL
  SELECT t.* FROM task t
  JOIN task_tree tt ON t.parent_task_id = tt.id
)
SELECT * FROM task_tree;

-- Get run with task counts
SELECT r.*,
  COUNT(DISTINCT t.id) as total_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks
FROM run r
LEFT JOIN task t ON t.run_id = r.id
WHERE r.id = $1
GROUP BY r.id;

-- Get latest run data per key
SELECT DISTINCT ON (key) *
FROM run_data
WHERE run_id = $1
ORDER BY key, created_at DESC;

-- Get all run data with specific tags
SELECT * FROM run_data
WHERE run_id = $1
  AND tags @> ARRAY['production', 'v1.0']  -- Has ALL tags
ORDER BY created_at DESC;

-- Get run data with any of the specified tags
SELECT * FROM run_data
WHERE run_id = $1
  AND tags && ARRAY['sensor-1', 'sensor-2']  -- Has ANY tag
ORDER BY created_at DESC;

-- Get run data by key prefix
SELECT * FROM run_data
WHERE run_id = $1
  AND key LIKE "sensor.temp%"
ORDER BY created_at DESC;

-- Get run data with tag prefix matching
SELECT * FROM run_data
WHERE run_id = $1
  AND EXISTS (
    SELECT 1 FROM unnest(tags) AS tag
    WHERE tag LIKE "2024-03%"
  );
```

### Performance Queries

```sql
-- Analyze table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||"."||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||"."||tablename) DESC;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query NOT LIKE "%pg_stat%"
ORDER BY mean_time DESC
LIMIT 10;
```
