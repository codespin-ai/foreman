/**
 * Mapper functions for converting between database and domain types
 */

import type {
  Run, RunDbRow,
  Task, TaskDbRow,
  RunData, RunDataDbRow,
  RunStatus, TaskStatus
} from './types.js';

/**
 * Map Run from database row to domain type
 */
export function mapRunFromDb(row: RunDbRow): Run {
  return {
    id: row.id,
    orgId: row.org_id,
    status: row.status as RunStatus,
    inputData: row.input_data,
    outputData: row.output_data ?? undefined,
    errorData: row.error_data ?? undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    totalTasks: row.total_tasks,
    completedTasks: row.completed_tasks,
    failedTasks: row.failed_tasks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    durationMs: row.duration_ms ? parseInt(row.duration_ms) : undefined
  };
}

/**
 * Map Run from domain type to database row
 */
export function mapRunToDb(run: Partial<Run>): Partial<RunDbRow> {
  const dbRow: Partial<RunDbRow> = {};
  
  if (run.id !== undefined) dbRow.id = run.id;
  if (run.orgId !== undefined) dbRow.org_id = run.orgId;
  if (run.status !== undefined) dbRow.status = run.status;
  if (run.inputData !== undefined) dbRow.input_data = run.inputData as Record<string, unknown>;
  if (run.outputData !== undefined) dbRow.output_data = run.outputData as Record<string, unknown>;
  if (run.errorData !== undefined) dbRow.error_data = run.errorData as Record<string, unknown>;
  if (run.metadata !== undefined) dbRow.metadata = run.metadata as Record<string, unknown>;
  if (run.totalTasks !== undefined) dbRow.total_tasks = run.totalTasks;
  if (run.completedTasks !== undefined) dbRow.completed_tasks = run.completedTasks;
  if (run.failedTasks !== undefined) dbRow.failed_tasks = run.failedTasks;
  if (run.createdAt !== undefined) dbRow.created_at = run.createdAt;
  if (run.updatedAt !== undefined) dbRow.updated_at = run.updatedAt;
  if (run.startedAt !== undefined) dbRow.started_at = run.startedAt;
  if (run.completedAt !== undefined) dbRow.completed_at = run.completedAt;
  if (run.durationMs !== undefined) dbRow.duration_ms = run.durationMs.toString();
  
  return dbRow;
}

/**
 * Map Task from database row to domain type
 */
export function mapTaskFromDb(row: TaskDbRow): Task {
  return {
    id: row.id,
    runId: row.run_id,
    parentTaskId: row.parent_task_id ?? undefined,
    orgId: row.org_id,
    type: row.type,
    status: row.status as TaskStatus,
    inputData: row.input_data,
    outputData: row.output_data ?? undefined,
    errorData: row.error_data ?? undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    queuedAt: row.queued_at ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    durationMs: row.duration_ms ? parseInt(row.duration_ms) : undefined,
    queueJobId: row.queue_job_id ?? undefined
  };
}

/**
 * Map Task from domain type to database row
 */
export function mapTaskToDb(task: Partial<Task>): Partial<TaskDbRow> {
  const dbRow: Partial<TaskDbRow> = {};
  
  if (task.id !== undefined) dbRow.id = task.id;
  if (task.runId !== undefined) dbRow.run_id = task.runId;
  if (task.parentTaskId !== undefined) dbRow.parent_task_id = task.parentTaskId;
  if (task.orgId !== undefined) dbRow.org_id = task.orgId;
  if (task.type !== undefined) dbRow.type = task.type;
  if (task.status !== undefined) dbRow.status = task.status;
  if (task.inputData !== undefined) dbRow.input_data = task.inputData as Record<string, unknown>;
  if (task.outputData !== undefined) dbRow.output_data = task.outputData as Record<string, unknown>;
  if (task.errorData !== undefined) dbRow.error_data = task.errorData as Record<string, unknown>;
  if (task.metadata !== undefined) dbRow.metadata = task.metadata as Record<string, unknown>;
  if (task.retryCount !== undefined) dbRow.retry_count = task.retryCount;
  if (task.maxRetries !== undefined) dbRow.max_retries = task.maxRetries;
  if (task.createdAt !== undefined) dbRow.created_at = task.createdAt;
  if (task.updatedAt !== undefined) dbRow.updated_at = task.updatedAt;
  if (task.queuedAt !== undefined) dbRow.queued_at = task.queuedAt;
  if (task.startedAt !== undefined) dbRow.started_at = task.startedAt;
  if (task.completedAt !== undefined) dbRow.completed_at = task.completedAt;
  if (task.durationMs !== undefined) dbRow.duration_ms = task.durationMs.toString();
  if (task.queueJobId !== undefined) dbRow.queue_job_id = task.queueJobId;
  
  return dbRow;
}

/**
 * Map RunData from database row to domain type
 */
export function mapRunDataFromDb(row: RunDataDbRow): RunData {
  return {
    id: row.id,
    runId: row.run_id,
    taskId: row.task_id,
    orgId: row.org_id,
    key: row.key,
    value: row.value,
    tags: row.tags || [],
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Map RunData from domain type to database row
 */
export function mapRunDataToDb(data: Partial<RunData>): Partial<RunDataDbRow> {
  const dbRow: Partial<RunDataDbRow> = {};
  
  if (data.id !== undefined) dbRow.id = data.id;
  if (data.runId !== undefined) dbRow.run_id = data.runId;
  if (data.taskId !== undefined) dbRow.task_id = data.taskId;
  if (data.orgId !== undefined) dbRow.org_id = data.orgId;
  if (data.key !== undefined) dbRow.key = data.key;
  if (data.value !== undefined) dbRow.value = data.value as Record<string, unknown>;
  if (data.metadata !== undefined) dbRow.metadata = data.metadata as Record<string, unknown>;
  if (data.createdAt !== undefined) dbRow.created_at = data.createdAt;
  if (data.updatedAt !== undefined) dbRow.updated_at = data.updatedAt;
  
  return dbRow;
}

