-- Foreman Database Schema

-- Run table
CREATE TABLE run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
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

CREATE INDEX idx_run_org_created ON run(org_id, created_at DESC);
CREATE INDEX idx_run_status ON run(status);
CREATE INDEX idx_run_created ON run(created_at DESC);

-- Task table
CREATE TABLE task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES task(id) ON DELETE CASCADE,
  org_id VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  input_data JSONB NOT NULL,
  output_data JSONB,
  error_data JSONB,
  metadata JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  queued_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms BIGINT,
  queue_job_id VARCHAR(255)
);

CREATE INDEX idx_task_run ON task(run_id);
CREATE INDEX idx_task_parent ON task(parent_task_id);
CREATE INDEX idx_task_org_created ON task(org_id, created_at DESC);
CREATE INDEX idx_task_status ON task(status);
CREATE INDEX idx_task_type ON task(type);
CREATE INDEX idx_task_queue_job ON task(queue_job_id);

-- Run data table
CREATE TABLE run_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  org_id VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Note: No unique constraint on (run_id, key) - allows multiple entries

CREATE INDEX idx_run_data_run ON run_data(run_id);
CREATE INDEX idx_run_data_task ON run_data(task_id);
CREATE INDEX idx_run_data_org ON run_data(org_id);
CREATE INDEX idx_run_data_key ON run_data(key);
CREATE INDEX idx_run_data_created ON run_data(created_at DESC);
CREATE INDEX idx_run_data_tags ON run_data USING GIN(tags);
CREATE INDEX idx_run_data_key_prefix ON run_data(key text_pattern_ops);

-- Note: Authentication is handled via simple API key format validation
-- No database tables needed for auth in this fully trusted environment