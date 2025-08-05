/**
 * Foreman API functions
 */

import { Result } from './result.js';
import type { ForemanConfig } from './types.js';
import type {
  Run, CreateRunInput, UpdateRunInput,
  Task, CreateTaskInput, UpdateTaskInput, TaskStatus, TaskResult,
  RunData, CreateRunDataInput, QueryRunDataParams, UpdateRunDataTagsInput,
  PaginationParams, PaginatedResult
} from './api-types.js';
import { httpRequest, buildQueryString } from './http-client.js';

/**
 * Create a new run
 */
export async function createRun(
  config: ForemanConfig,
  input: CreateRunInput
): Promise<Result<Run, Error>> {
  return httpRequest<Run>({
    method: 'POST',
    url: `${config.endpoint}/api/v1/runs`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    body: input,
    timeout: config.timeout
  });
}

/**
 * Get run details
 */
export async function getRun(
  config: ForemanConfig,
  id: string
): Promise<Result<Run, Error>> {
  return httpRequest<Run>({
    method: 'GET',
    url: `${config.endpoint}/api/v1/runs/${id}`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    timeout: config.timeout
  });
}

/**
 * Update run status
 */
export async function updateRun(
  config: ForemanConfig,
  id: string,
  input: UpdateRunInput
): Promise<Result<Run, Error>> {
  return httpRequest<Run>({
    method: 'PATCH',
    url: `${config.endpoint}/api/v1/runs/${id}`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    body: input,
    timeout: config.timeout
  });
}

/**
 * List runs with filtering
 */
export async function listRuns(
  config: ForemanConfig,
  params?: PaginationParams & { status?: string }
): Promise<Result<PaginatedResult<Run>, Error>> {
  const queryString = params ? buildQueryString(params) : '';
  return httpRequest<PaginatedResult<Run>>({
    method: 'GET',
    url: `${config.endpoint}/api/v1/runs${queryString}`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    timeout: config.timeout
  });
}

/**
 * Create a new task
 */
export async function createTask(
  config: ForemanConfig,
  input: CreateTaskInput
): Promise<Result<Task, Error>> {
  return httpRequest<Task>({
    method: 'POST',
    url: `${config.endpoint}/api/v1/tasks`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    body: input,
    timeout: config.timeout
  });
}

/**
 * Get task details
 */
export async function getTask(
  config: ForemanConfig,
  id: string
): Promise<Result<Task, Error>> {
  return httpRequest<Task>({
    method: 'GET',
    url: `${config.endpoint}/api/v1/tasks/${id}`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    timeout: config.timeout
  });
}

/**
 * Update task status
 */
export async function updateTask(
  config: ForemanConfig,
  id: string,
  input: UpdateTaskInput
): Promise<Result<Task, Error>> {
  return httpRequest<Task>({
    method: 'PATCH',
    url: `${config.endpoint}/api/v1/tasks/${id}`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    body: input,
    timeout: config.timeout
  });
}

/**
 * List tasks with filtering
 */
export async function listTasks(
  config: ForemanConfig,
  params?: PaginationParams & { runId?: string; status?: string }
): Promise<Result<PaginatedResult<Task>, Error>> {
  const queryString = params ? buildQueryString(params) : '';
  return httpRequest<PaginatedResult<Task>>({
    method: 'GET',
    url: `${config.endpoint}/api/v1/tasks${queryString}`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    timeout: config.timeout
  });
}

/**
 * Get task status
 */
export async function getTaskStatus(params: {
  foremanConfig: ForemanConfig;
  taskId: string;
}): Promise<Result<TaskStatus, Error>> {
  const result = await getTask(params.foremanConfig, params.taskId);
  if (!result.success) {
    return result;
  }
  return { success: true, data: result.data.status };
}

/**
 * Wait for task completion
 */
export async function waitForTask(params: {
  foremanConfig: ForemanConfig;
  taskId: string;
  timeout?: number;
  pollInterval?: number;
}): Promise<Result<TaskResult, Error>> {
  const startTime = Date.now();
  const timeout = params.timeout || 300000; // 5 minutes default
  const pollInterval = params.pollInterval || 1000; // 1 second default
  
  while (true) {
    const result = await getTask(params.foremanConfig, params.taskId);
    if (!result.success) {
      return result;
    }
    
    const task = result.data;
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return {
        success: true,
        data: {
          id: task.id,
          status: task.status,
          outputData: task.outputData,
          errorData: task.errorData
        }
      };
    }
    
    if (Date.now() - startTime > timeout) {
      return {
        success: false,
        error: new Error('Task wait timeout')
      };
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

/**
 * Store run data
 */
export async function createRunData(
  config: ForemanConfig,
  runId: string,
  input: CreateRunDataInput
): Promise<Result<RunData, Error>> {
  return httpRequest<RunData>({
    method: 'POST',
    url: `${config.endpoint}/api/v1/runs/${runId}/data`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    body: input,
    timeout: config.timeout
  });
}

/**
 * Query run data
 */
export async function queryRunData(
  config: ForemanConfig,
  runId: string,
  params?: QueryRunDataParams
): Promise<Result<{ data: RunData[]; pagination: { limit: number; offset: number; total: number } }, Error>> {
  const queryString = params ? buildQueryString(params) : '';
  return httpRequest<{ data: RunData[]; pagination: { limit: number; offset: number; total: number } }>({
    method: 'GET',
    url: `${config.endpoint}/api/v1/runs/${runId}/data${queryString}`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    timeout: config.timeout
  });
}

/**
 * Update run data tags
 */
export async function updateRunDataTags(
  config: ForemanConfig,
  runId: string,
  dataId: string,
  input: UpdateRunDataTagsInput
): Promise<Result<RunData, Error>> {
  return httpRequest<RunData>({
    method: 'PATCH',
    url: `${config.endpoint}/api/v1/runs/${runId}/data/${dataId}/tags`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    body: input,
    timeout: config.timeout
  });
}

/**
 * Delete run data
 */
export async function deleteRunData(
  config: ForemanConfig,
  runId: string,
  options: { key?: string; id?: string }
): Promise<Result<{ deleted: number }, Error>> {
  const queryString = buildQueryString(options);
  return httpRequest<{ deleted: number }>({
    method: 'DELETE',
    url: `${config.endpoint}/api/v1/runs/${runId}/data${queryString}`,
    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    timeout: config.timeout
  });
}