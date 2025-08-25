/**
 * Foreman client types
 */

export type Logger = {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
};

export type ForemanConfig = {
  endpoint: string;
  /** Organization ID for multi-tenant isolation (optional for ROOT context) */
  orgId?: string;
  /** Optional API key for authentication */
  apiKey?: string;
  timeout?: number;
  queues?: {
    taskQueue?: string;
    resultQueue?: string;
  };
  logger?: Logger;
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
