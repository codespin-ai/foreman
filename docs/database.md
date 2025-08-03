# Foreman Database Design

## Overview

Foreman uses PostgreSQL as its primary data store, following the principle that all task data should be stored in the database, not in queues. This document describes the database schema, design decisions, and best practices.

## Design Principles

1. **Single Source of Truth**: All task and run data stored in PostgreSQL
2. **Multi-tenancy**: Every table has `org_id` for organization isolation
3. **Audit Trail**: Timestamps and audit log for all changes
4. **Flexible Storage**: JSONB for variable data structures
5. **Referential Integrity**: Foreign keys with appropriate cascades

## Schema Overview

### Core Tables

1. **run** - Top-level execution contexts
2. **task** - Individual units of work
3. **run_data** - Key-value storage for inter-task communication
4. **api_key** - Authentication and authorization
5. **audit_log** - Change tracking

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
  status VARCHAR(50) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  input_data JSONB NOT NULL,
  output_data JSONB,
  error_data JSONB,
  metadata JSONB,
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms BIGINT
);

-- Indexes
CREATE INDEX idx_run_org_created ON run(org_id, created_at DESC);
CREATE INDEX idx_run_status ON run(status) WHERE status IN ('pending', 'running');
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
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'running', 'completed', 
                      'failed', 'cancelled', 'retrying')),
  input_data JSONB NOT NULL,
  output_data JSONB,
  error_data JSONB,
  metadata JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3 CHECK (max_retries >= 0 AND max_retries <= 10),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  queued_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms BIGINT,
  queue_job_id VARCHAR(255)
);

-- Indexes
CREATE INDEX idx_task_run ON task(run_id);
CREATE INDEX idx_task_parent ON task(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_task_org_created ON task(org_id, created_at DESC);
CREATE INDEX idx_task_status ON task(status) WHERE status IN ('pending', 'queued', 'running');
CREATE INDEX idx_task_type ON task(type);
CREATE INDEX idx_task_queue_job ON task(queue_job_id) WHERE queue_job_id IS NOT NULL;
```

**Column Notes:**
- `parent_task_id`: Enables task hierarchies/dependencies
- `type`: Task type identifier (e.g., 'send-email', 'process-payment')
- `queue_job_id`: External queue system's job identifier
- `retry_count`: Current retry attempt number
- `max_retries`: Maximum allowed retries for this task

### Run Data Table

Key-value storage for sharing data between tasks within a run.

```sql
CREATE TABLE run_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  org_id VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Constraints
ALTER TABLE run_data ADD CONSTRAINT uniq_run_data_run_key 
  UNIQUE (run_id, key);

-- Indexes
CREATE INDEX idx_run_data_run ON run_data(run_id);
CREATE INDEX idx_run_data_task ON run_data(task_id);
CREATE INDEX idx_run_data_org ON run_data(org_id);
CREATE INDEX idx_run_data_key ON run_data(key);
CREATE INDEX idx_run_data_created ON run_data(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_run_data_updated_at 
  BEFORE UPDATE ON run_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Column Notes:**
- `key`: Unique within a run (last write wins)
- `task_id`: Which task created/updated this data
- `value`: Arbitrary JSON data
- `updated_at`: Automatically updated on changes

### API Key Table

Stores hashed API keys for authentication.

```sql
CREATE TABLE api_key (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(50) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX idx_api_key_org ON api_key(org_id);
CREATE INDEX idx_api_key_prefix ON api_key(key_prefix);
CREATE INDEX idx_api_key_active ON api_key(is_active) WHERE is_active = true;
CREATE INDEX idx_api_key_expires ON api_key(expires_at) 
  WHERE expires_at IS NOT NULL AND is_active = true;
```

**Column Notes:**
- `key_hash`: Bcrypt hash of the actual API key
- `key_prefix`: First 8 characters for key identification
- `permissions`: JSON object with permission flags
- `expires_at`: Optional expiration timestamp

### Audit Log Table

Tracks all changes for compliance and debugging.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL 
    CHECK (entity_type IN ('run', 'task', 'run_data', 'api_key')),
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL 
    CHECK (action IN ('create', 'update', 'delete')),
  changes JSONB,
  api_key_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_org_created ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_api_key ON audit_log(api_key_id) WHERE api_key_id IS NOT NULL;
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- Partitioning by month (optional for large deployments)
-- CREATE TABLE audit_log_2024_01 PARTITION OF audit_log
--   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

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
  AND status IN ('pending', 'running')
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

-- Get latest run data
SELECT DISTINCT ON (key) * 
FROM run_data 
WHERE run_id = $1
ORDER BY key, updated_at DESC;
```

### Performance Queries

```sql
-- Analyze table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

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
WHERE query NOT LIKE '%pg_stat%'
ORDER BY mean_time DESC
LIMIT 10;
```

