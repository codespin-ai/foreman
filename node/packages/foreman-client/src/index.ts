/**
 * Foreman client - Functional API
 * 
 * This package provides a complete workflow orchestration SDK that:
 * - Fetches Redis configuration from Foreman server
 * - Handles all BullMQ operations internally
 * - Provides a clean functional API
 */

// Re-export types
export * from './types.js';
export * from './api-types.js';

// Configuration functions
export { getRedisConfig, getQueueConfig, clearConfigCache } from './config.js';

// API functions
export {
  // Runs
  createRun,
  getRun,
  updateRun,
  listRuns,
  
  // Tasks
  createTask,
  getTask,
  updateTask,
  getTaskStatus,
  waitForTask,
  
  // Run data
  createRunData,
  queryRunData,
  updateRunDataTags,
  deleteRunData
} from './api.js';

// Queue functions
export { enqueueTask, enqueueTasks, closeQueues } from './queue.js';

// Worker functions
export { createWorker, createTaskWorker } from './worker.js';

// High-level client functions
export { initializeForemanClient, withForemanClient } from './client.js';