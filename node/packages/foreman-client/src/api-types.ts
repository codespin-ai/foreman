/**
 * Foreman API types
 */

/**
 * Run types
 */
export type Run = {
  id: string;
  orgId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  inputData: unknown;
  outputData?: unknown;
  errorData?: unknown;
  metadata?: Record<string, unknown>;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
};

export type CreateRunInput = {
  inputData: unknown;
  metadata?: Record<string, unknown>;
};

export type UpdateRunInput = {
  status?: Run["status"];
  outputData?: unknown;
  errorData?: unknown;
  metadata?: Record<string, unknown>;
};

/**
 * Task types
 */
export type Task = {
  id: string;
  runId: string;
  parentTaskId?: string;
  orgId: string;
  type: string;
  status:
    | "pending"
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "retrying";
  inputData: unknown;
  outputData?: unknown;
  errorData?: unknown;
  metadata?: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  queueJobId?: string;
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
  status?: Task["status"];
  outputData?: unknown;
  errorData?: unknown;
  metadata?: Record<string, unknown>;
  queueJobId?: string;
};

export type TaskStatus = Task["status"];

export type TaskResult = {
  id: string;
  status: TaskStatus;
  outputData?: unknown;
  errorData?: unknown;
};

/**
 * Run data types
 */
export type RunData = {
  id: string;
  runId: string;
  taskId: string;
  orgId: string;
  key: string;
  value: unknown;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateRunDataInput = {
  taskId: string;
  key: string;
  value: unknown;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export type QueryRunDataParams = {
  // Key filters
  key?: string;
  keys?: string[];
  keyStartsWith?: string[];
  keyPattern?: string;

  // Tag filters
  tags?: string[];
  tagStartsWith?: string[];
  tagMode?: "any" | "all";

  // Options
  includeAll?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "created_at" | "updated_at" | "key";
  sortOrder?: "asc" | "desc";
};

export type UpdateRunDataTagsInput = {
  add?: string[];
  remove?: string[];
};

/**
 * Pagination types
 */
export type PaginationParams = {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
};
