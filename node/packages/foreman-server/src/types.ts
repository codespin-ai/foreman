/**
 * Domain types for Foreman
 */

// Run status enum
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// Task status enum
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';

// Run domain type
export type Run = {
  id: string;
  orgId: string;
  status: RunStatus;
  inputData: unknown;
  outputData?: unknown;
  errorData?: unknown;
  metadata?: Record<string, unknown>;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
};

// Task domain type
export type Task = {
  id: string;
  runId: string;
  parentTaskId?: string;
  orgId: string;
  type: string;
  status: TaskStatus;
  inputData: unknown;
  outputData?: unknown;
  errorData?: unknown;
  metadata?: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  queuedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  queueJobId?: string;
};

// Run data domain type
export type RunData = {
  id: string;
  runId: string;
  taskId: string;
  orgId: string;
  key: string;
  value: unknown;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

// API Key domain type
export type ApiKey = {
  id: string;
  orgId: string;
  name: string;
  keyPrefix: string;
  permissions: Record<string, boolean>;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  isActive: boolean;
};

// Database row types (snake_case)
export type RunDbRow = {
  id: string;
  org_id: string;
  status: string;
  input_data: unknown;
  output_data: unknown | null;
  error_data: unknown | null;
  metadata: unknown | null;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: string | null; // bigint comes as string
};

export type TaskDbRow = {
  id: string;
  run_id: string;
  parent_task_id: string | null;
  org_id: string;
  type: string;
  status: string;
  input_data: unknown;
  output_data: unknown | null;
  error_data: unknown | null;
  metadata: unknown | null;
  retry_count: number;
  max_retries: number;
  created_at: Date;
  queued_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: string | null; // bigint comes as string
  queue_job_id: string | null;
};

export type RunDataDbRow = {
  id: string;
  run_id: string;
  task_id: string;
  org_id: string;
  key: string;
  value: unknown;
  metadata: unknown | null;
  created_at: Date;
  updated_at: Date;
};

export type ApiKeyDbRow = {
  id: string;
  org_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: unknown;
  last_used_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  is_active: boolean;
};

// API request/response types
export type CreateRunInput = {
  orgId: string;
  inputData: unknown;
  metadata?: Record<string, unknown>;
};

export type UpdateRunInput = {
  status?: RunStatus;
  outputData?: unknown;
  errorData?: unknown;
  metadata?: Record<string, unknown>;
};

export type CreateTaskInput = {
  runId: string;
  parentTaskId?: string;
  type: string;
  inputData: unknown;
  metadata?: Record<string, unknown>;
  maxRetries?: number;
};

export type UpdateTaskInput = {
  status?: TaskStatus;
  outputData?: unknown;
  errorData?: unknown;
  metadata?: Record<string, unknown>;
  queueJobId?: string;
};

export type CreateRunDataInput = {
  runId: string;
  taskId: string;
  key: string;
  value: unknown;
  metadata?: Record<string, unknown>;
};

// Pagination types
export type PaginationParams = {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};