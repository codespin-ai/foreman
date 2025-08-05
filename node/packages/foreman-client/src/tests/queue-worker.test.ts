import { expect } from "chai";
import { Queue } from "bullmq";
import { testDb, getTestConfig } from "./setup.js";
import {
  createRun,
  getTask,
  enqueueTask,
  createWorker,
  initializeForemanClient,
  closeQueues,
} from "../index.js";

// Simple test logger
const testLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe("Queue and Worker Functions", () => {
  const config = getTestConfig();
  let runId: string;
  let redisConfig: any;
  let queueConfig: any;
  let taskQueue: Queue;
  const activeWorkers: any[] = [];

  beforeEach(async () => {
    await testDb.truncateAllTables();

    // Initialize client with test queue names (no colons for BullMQ 5+)
    const testConfig = {
      ...config,
      queues: {
        taskQueue: "foreman-test-tasks",
        resultQueue: "foreman-test-results",
      },
    };

    const client = await initializeForemanClient(testConfig);
    redisConfig = client.redisConfig;
    queueConfig = client.queueConfig;

    // Create a queue instance for inspection
    taskQueue = new Queue(queueConfig.taskQueue, {
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
      },
    });

    // Clean queue
    await taskQueue.obliterate({ force: true });

    // Create a test run
    const runResult = await createRun(config, {
      inputData: { test: true },
    });
    expect(runResult.success).to.be.true;
    if (runResult.success) {
      runId = runResult.data.id;
    }
  });

  afterEach(async () => {
    // Stop all active workers
    for (const worker of activeWorkers) {
      try {
        await worker.stop();
      } catch {
        // Ignore errors during cleanup
      }
    }
    activeWorkers.length = 0;

    // Close queues
    await closeQueues(testLogger);
    if (taskQueue) {
      await taskQueue.close();
    }
  });

  describe("enqueueTask", () => {
    it("should queue only the task ID", async () => {
      // Enqueue a task with full data
      const result = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "test-task",
          inputData: { foo: "bar", nested: { value: 123 } },
          metadata: { source: "test" },
        },
        logger: testLogger,
      });

      expect(result.success).to.be.true;
      if (!result.success) return;

      const { taskId } = result.data;

      // Check what's in the queue
      const jobs = await taskQueue.getJobs(["waiting"]);
      expect(jobs).to.have.lengthOf(1);

      const job = jobs[0];
      expect(job.data).to.deep.equal({ taskId });
      expect(job.data).to.not.have.property("inputData");
      expect(job.data).to.not.have.property("metadata");
      expect(job.data).to.not.have.property("runId");
      expect(job.data).to.not.have.property("type");
    });

    it("should store full task data in database", async () => {
      const inputData = { operation: "process", items: [1, 2, 3] };
      const metadata = { priority: "high" };

      const result = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "data-processor",
          inputData,
          metadata,
        },
        logger: testLogger,
      });

      expect(result.success).to.be.true;
      if (!result.success) return;

      // Verify task data is in database
      const taskResult = await getTask(config, result.data.taskId);
      expect(taskResult.success).to.be.true;
      if (!taskResult.success) return;

      const task = taskResult.data;
      expect(task.inputData).to.deep.equal(inputData);
      expect(task.metadata).to.deep.equal(metadata);
      expect(task.type).to.equal("data-processor");
      expect(task.runId).to.equal(runId);
    });

    it("should handle priority and delay options", async () => {
      const result = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "priority-task",
          inputData: {},
          priority: 10,
          delay: 5000,
        },
        logger: testLogger,
      });

      expect(result.success).to.be.true;
      if (!result.success) return;

      // Check job options in queue
      const jobs = await taskQueue.getJobs(["delayed"]);
      expect(jobs).to.have.lengthOf(1);

      const job = jobs[0];
      expect(job.opts.priority).to.equal(10);
      expect(job.opts.delay).to.be.at.least(4000); // Account for processing time
    });
  });

  after(async () => {
    // Final cleanup to ensure no hanging connections
    for (const worker of activeWorkers) {
      try {
        await worker.stop();
      } catch {
        // Ignore
      }
    }
    if (taskQueue) {
      await taskQueue.close();
    }
  });

  describe.skip("createWorker", () => {
    it("should fetch task data from database before processing", async () => {
      let handlerReceivedData: any = null;

      // Create worker with handler that captures data
      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "capture-test": async (task) => {
            handlerReceivedData = task;
            return { processed: true };
          },
        },
        logger: testLogger,
      });

      activeWorkers.push(worker);

      // Start worker
      await worker.start();

      // Enqueue a task
      const inputData = { message: "test data", count: 42 };
      const metadata = { origin: "test-suite" };

      const enqueueResult = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "capture-test",
          inputData,
          metadata,
        },
        logger: testLogger,
      });

      expect(enqueueResult.success).to.be.true;
      if (!enqueueResult.success) return;

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify handler received full data
      expect(handlerReceivedData).to.not.be.null;
      expect(handlerReceivedData.id).to.equal(enqueueResult.data.taskId);
      expect(handlerReceivedData.type).to.equal("capture-test");
      expect(handlerReceivedData.runId).to.equal(runId);
      expect(handlerReceivedData.inputData).to.deep.equal(inputData);
      expect(handlerReceivedData.metadata).to.deep.equal(metadata);
    });

    it("should update task status during processing", async () => {
      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "status-test": async (task) => {
            // Check status is running
            const statusCheck = await getTask(config, task.id);
            expect(statusCheck.success).to.be.true;
            if (statusCheck.success) {
              expect(statusCheck.data.status).to.equal("running");
            }

            return { completed: true };
          },
        },
        logger: testLogger,
      });

      activeWorkers.push(worker);
      await worker.start();

      const enqueueResult = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "status-test",
          inputData: {},
        },
        logger: testLogger,
      });

      expect(enqueueResult.success).to.be.true;
      if (!enqueueResult.success) return;

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check final status
      const finalTask = await getTask(config, enqueueResult.data.taskId);
      expect(finalTask.success).to.be.true;
      if (finalTask.success) {
        expect(finalTask.data.status).to.equal("completed");
        expect(finalTask.data.outputData).to.deep.equal({ completed: true });
      }
    });

    it("should handle task failures", async () => {
      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "fail-test": async () => {
            throw new Error("Test error");
          },
        },
        options: {
          maxRetries: 1,
        },
        logger: testLogger,
      });

      activeWorkers.push(worker);
      await worker.start();

      const enqueueResult = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "fail-test",
          inputData: {},
          maxRetries: 1,
        },
        logger: testLogger,
      });

      expect(enqueueResult.success).to.be.true;
      if (!enqueueResult.success) return;

      // Wait for processing and retries
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check final status
      const finalTask = await getTask(config, enqueueResult.data.taskId);
      expect(finalTask.success).to.be.true;
      if (finalTask.success) {
        expect(finalTask.data.status).to.equal("failed");
        expect(finalTask.data.errorData).to.have.property(
          "message",
          "Test error"
        );
      }
    });

    it("should handle missing task data gracefully", async () => {
      let errorCaught = false;

      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "any-type": async () => {
            return { processed: true };
          },
        },
        logger: {
          ...testLogger,
          error: (msg: string) => {
            if (msg.includes("Task failed")) {
              errorCaught = true;
            }
          },
        },
      });

      activeWorkers.push(worker);
      await worker.start();

      // Manually add a job with non-existent task ID
      await taskQueue.add("test", { taskId: "non-existent-id" });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(errorCaught).to.be.true;
    });

    it("should handle multiple task types", async () => {
      const processedTasks: string[] = [];

      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "type-a": async (task) => {
            processedTasks.push(`a-${task.id}`);
            return { type: "a" };
          },
          "type-b": async (task) => {
            processedTasks.push(`b-${task.id}`);
            return { type: "b" };
          },
        },
        logger: testLogger,
      });

      activeWorkers.push(worker);
      await worker.start();

      // Enqueue different task types
      const resultA = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "type-a",
          inputData: { variant: "a" },
        },
        logger: testLogger,
      });

      const resultB = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "type-b",
          inputData: { variant: "b" },
        },
        logger: testLogger,
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(processedTasks).to.have.lengthOf(2);
      if (resultA.success && resultB.success) {
        expect(processedTasks).to.include(`a-${resultA.data.taskId}`);
        expect(processedTasks).to.include(`b-${resultB.data.taskId}`);
      }
    });
  });
});
