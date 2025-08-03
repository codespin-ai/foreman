/**
 * Foreman client types
 */

export type ForemanConfig = {
  endpoint: string;
  apiKey?: string;
  timeout?: number;
};

export type RedisConfig = {
  host: string;
  port: number;
  password?: string;
  db?: number;
};

export type QueueConfig = {
  taskQueue: string;
  resultQueue: string;
};

export type WorkerOptions = {
  concurrency?: number;
  maxRetries?: number;
  backoffDelay?: number;
};

export type TaskHandler = (task: {
  id: string;
  type: string;
  runId: string;
  inputData: unknown;
  metadata?: Record<string, unknown>;
}) => Promise<unknown>;

export type WorkerControls = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
};