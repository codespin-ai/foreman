import { Result, success, failure } from '@codespin/foreman-core';

/**
 * Foreman client configuration
 */
export interface ForemanClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

/**
 * Run types
 */
export interface Run {
  id: string;
  orgId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
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
}

export interface CreateRunInput {
  inputData: unknown;
  metadata?: Record<string, unknown>;
}

export interface UpdateRunInput {
  status?: Run['status'];
  outputData?: unknown;
  errorData?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Task types
 */
export interface Task {
  id: string;
  runId: string;
  parentTaskId?: string;
  orgId: string;
  type: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';
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
}

export interface CreateTaskInput {
  runId: string;
  parentTaskId?: string;
  type: string;
  inputData: unknown;
  metadata?: Record<string, unknown>;
  maxRetries?: number;
}

export interface UpdateTaskInput {
  status?: Task['status'];
  outputData?: unknown;
  errorData?: unknown;
  metadata?: Record<string, unknown>;
  queueJobId?: string;
}

/**
 * Run data types
 */
export interface RunData {
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
}

export interface CreateRunDataInput {
  taskId: string;
  key: string;
  value: unknown;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface QueryRunDataParams {
  // Key filters
  key?: string;
  keys?: string[];
  keyStartsWith?: string[];
  keyPattern?: string;
  
  // Tag filters
  tags?: string[];
  tagStartsWith?: string[];
  tagMode?: 'any' | 'all';
  
  // Options
  includeAll?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'key';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateRunDataTagsInput {
  add?: string[];
  remove?: string[];
}

/**
 * Pagination types
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Foreman API client
 */
export class ForemanClient {
  private readonly config: Required<ForemanClientConfig>;

  constructor(config: ForemanClientConfig) {
    this.config = {
      timeout: 30000, // 30 seconds default
      ...config
    };
  }

  /**
   * Make an authenticated HTTP request
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<Result<T, Error>> {
    try {
      const url = `${this.config.baseUrl}${path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as { error?: string };
        return failure(new Error(errorData.error || `HTTP ${response.status}`));
      }

      return success(data as T);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return failure(new Error('Request timeout'));
        }
        return failure(error);
      }
      return failure(new Error('Unknown error'));
    }
  }

  /**
   * Build query string from parameters
   */
  private buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      
      if (Array.isArray(value)) {
        // Join arrays with commas
        searchParams.append(key, value.join(','));
      } else if (typeof value === 'object') {
        searchParams.append(key, JSON.stringify(value));
      } else {
        searchParams.append(key, String(value));
      }
    }
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Run operations
   */
  async createRun(input: CreateRunInput): Promise<Result<Run, Error>> {
    return this.request<Run>('POST', '/api/v1/runs', input);
  }

  async getRun(id: string): Promise<Result<Run, Error>> {
    return this.request<Run>('GET', `/api/v1/runs/${id}`);
  }

  async updateRun(id: string, input: UpdateRunInput): Promise<Result<Run, Error>> {
    return this.request<Run>('PATCH', `/api/v1/runs/${id}`, input);
  }

  async listRuns(params?: PaginationParams & { status?: string }): Promise<Result<PaginatedResult<Run>, Error>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          query.append(key, String(value));
        }
      });
    }
    const queryString = query.toString();
    const path = `/api/v1/runs${queryString ? `?${queryString}` : ''}`;
    return this.request<PaginatedResult<Run>>('GET', path);
  }

  /**
   * Task operations
   */
  async createTask(input: CreateTaskInput): Promise<Result<Task, Error>> {
    return this.request<Task>('POST', '/api/v1/tasks', input);
  }

  async getTask(id: string): Promise<Result<Task, Error>> {
    return this.request<Task>('GET', `/api/v1/tasks/${id}`);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Result<Task, Error>> {
    return this.request<Task>('PATCH', `/api/v1/tasks/${id}`, input);
  }

  /**
   * Run data operations
   */
  async createRunData(runId: string, input: CreateRunDataInput): Promise<Result<RunData, Error>> {
    return this.request<RunData>('POST', `/api/v1/runs/${runId}/data`, input);
  }

  async getRunData(runId: string, key: string): Promise<Result<RunData, Error>> {
    // Get the latest value for a specific key
    const result = await this.queryRunData(runId, { key, limit: 1 });
    if (!result.success) return result;
    
    if (result.data.data.length === 0) {
      return failure(new Error(`Run data not found: ${runId}/${key}`));
    }
    
    return success(result.data.data[0]!);
  }

  async queryRunData(runId: string, params?: QueryRunDataParams): Promise<Result<{ data: RunData[]; pagination: { limit: number; offset: number; total: number } }, Error>> {
    const queryString = this.buildQueryString(params || {});
    return this.request<{ data: RunData[]; pagination: { limit: number; offset: number; total: number } }>('GET', `/api/v1/runs/${runId}/data${queryString}`);
  }

  async updateRunDataTags(runId: string, dataId: string, input: UpdateRunDataTagsInput): Promise<Result<RunData, Error>> {
    return this.request<RunData>('PATCH', `/api/v1/runs/${runId}/data/${dataId}/tags`, input);
  }

  async deleteRunData(runId: string, options: { key?: string; id?: string }): Promise<Result<{ deleted: number }, Error>> {
    const queryString = this.buildQueryString(options);
    return this.request<{ deleted: number }>('DELETE', `/api/v1/runs/${runId}/data${queryString}`);
  }

  // Convenience methods
  async getAllRunData(runId: string, key: string): Promise<Result<RunData[], Error>> {
    const result = await this.queryRunData(runId, { key, includeAll: true });
    if (!result.success) return result;
    return success(result.data.data);
  }

  async queryRunDataByTags(runId: string, options: { tags?: string[]; tagStartsWith?: string[]; tagMode?: 'any' | 'all' }): Promise<Result<RunData[], Error>> {
    const result = await this.queryRunData(runId, options);
    if (!result.success) return result;
    return success(result.data.data);
  }
}