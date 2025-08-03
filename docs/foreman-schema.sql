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
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(run_id, key)
);

CREATE INDEX idx_run_data_run ON run_data(run_id);
CREATE INDEX idx_run_data_task ON run_data(task_id);
CREATE INDEX idx_run_data_org ON run_data(org_id);
CREATE INDEX idx_run_data_key ON run_data(key);
CREATE INDEX idx_run_data_created ON run_data(created_at DESC);

-- API key table
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

CREATE INDEX idx_api_key_org ON api_key(org_id);
CREATE INDEX idx_api_key_prefix ON api_key(key_prefix);
CREATE INDEX idx_api_key_active ON api_key(is_active);

-- Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  changes JSONB,
  api_key_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org_created ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_api_key ON audit_log(api_key_id);