import { expect } from "chai";
import { Queue } from "bullmq";
import { testDb, getTestConfig } from "./setup.js";
import {
  createRun,
  getTask,
  enqueueTask,
  enqueueTasks,
  createWorker,
  initializeForemanClient,
  closeQueues,
} from "../index.js";

describe("Queue and Worker Functions", () => {
  const config = getTestConfig();
  let runId: string;
  let redisConfig: any;
  let queueConfig: any;
  let testQueue: Queue;
  const activeWorkers: any[] = [];

  beforeEach(async function() {
    this.timeout(10000);
    await testDb.truncateAllTables();
    
    // Initialize with test queue names (no colons for BullMQ 5+)
    const testConfig = {
      ...config,
      queues: {
        taskQueue: "foreman-test-tasks",
        resultQueue: "foreman-test-results"
      }
    };
    
    const client = await initializeForemanClient(testConfig);
    redisConfig = client.redisConfig;
    queueConfig = client.queueConfig;
    
    // Create test queue for inspection
    testQueue = new Queue(queueConfig.taskQueue, {
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db
      }
    });
    
    // Clear queue
    await testQueue.obliterate({ force: true });
    
    // Create a test run
    const runResult = await createRun(config, {
      inputData: { test: true }
    });
    
    expect(runResult.success).to.be.true;
    if (runResult.success) {
      runId = runResult.data.id;
    }
  });

  afterEach(async function() {
    this.timeout(10000);
    
    // Stop all workers
    for (const worker of activeWorkers) {
      try {
        await worker.stop();
      } catch {
        // Ignore cleanup errors
      }
    }
    activeWorkers.length = 0;
    
    // Clean up queues
    await testQueue.obliterate({ force: true });
    await testQueue.close();
    await closeQueues(console);
  });

  describe("Queue Storage", () => {
    it("should only store task ID in queue, not full data", async () => {
      // Complex test data
      const complexData = {
        stringField: "test string",
        numberField: 42,
        booleanField: true,
        nestedObject: {
          level1: {
            level2: {
              deepValue: "nested data"
            }
          }
        },
        arrayField: [1, 2, 3, "four", { five: 5 }],
        dateField: new Date().toISOString()
      };
      
      // Enqueue task
      const result = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "complex-data-test",
          inputData: complexData,
          metadata: { 
            source: "test-suite",
            version: "1.0.0"
          }
        },
        logger: console
      });
      
      expect(result.success).to.be.true;
      if (!result.success) return;
      
      // Verify queue contains only task ID
      const jobs = await testQueue.getJobs(["waiting"]);
      expect(jobs).to.have.lengthOf(1);
      expect(jobs[0].data).to.deep.equal({ taskId: result.data.taskId });
      
      // Verify full data is in database
      const taskResult = await getTask(config, result.data.taskId);
      expect(taskResult.success).to.be.true;
      if (taskResult.success) {
        expect(taskResult.data.inputData).to.deep.equal(complexData);
      }
    });

    it("should handle job options correctly", async () => {
      const result = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "options-test",
          inputData: { test: true },
          priority: 100,
          delay: 2000,
          maxRetries: 5
        },
        logger: console
      });
      
      expect(result.success).to.be.true;
      if (!result.success) return;
      
      const jobs = await testQueue.getJobs(["delayed"]);
      expect(jobs).to.have.lengthOf(1);
      
      const job = jobs[0];
      expect(job.opts.priority).to.equal(100);
      expect(job.opts.delay).to.be.at.least(1000);
      expect(job.opts.attempts).to.equal(5);
    });
  });

  describe("Worker Processing", () => {
    it("should fetch task data from database before processing", async function() {
      this.timeout(5000);
      
      let processedTask: any = null;
      
      // First, enqueue task
      const inputData = { key: "value", number: 123 };
      const result = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "fetch-test",
          inputData,
          metadata: { test: true }
        },
        logger: console
      });
      
      expect(result.success).to.be.true;
      if (!result.success) return;
      
      // Then create and start worker
      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "fetch-test": async (task) => {
            processedTask = task;
            return { processed: true };
          }
        },
        logger: console
      });
      
      activeWorkers.push(worker);
      await worker.start();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify handler received full data
      expect(processedTask).to.not.be.null;
      expect(processedTask.inputData).to.deep.equal(inputData);
      expect(processedTask.metadata).to.deep.equal({ test: true });
      
      // Verify task status updated
      const finalTask = await getTask(config, result.data.taskId);
      expect(finalTask.success).to.be.true;
      if (finalTask.success) {
        expect(finalTask.data.status).to.equal("completed");
        expect(finalTask.data.outputData).to.deep.equal({ processed: true });
      }
    });

    it("should handle multiple task types", async function() {
      this.timeout(5000);
      
      const processedTasks: string[] = [];
      
      // Create worker with multiple handlers
      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "type-a": async (task) => {
            processedTasks.push(`a:${task.id}`);
            return { type: "a" };
          },
          "type-b": async (task) => {
            processedTasks.push(`b:${task.id}`);
            return { type: "b" };
          },
          "type-c": async (task) => {
            processedTasks.push(`c:${task.id}`);
            return { type: "c" };
          }
        },
        options: {
          concurrency: 3
        },
        logger: console
      });
      
      activeWorkers.push(worker);
      await worker.start();
      
      // Enqueue multiple task types
      const tasks = await enqueueTasks({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        tasks: [
          { runId, type: "type-a", inputData: {} },
          { runId, type: "type-b", inputData: {} },
          { runId, type: "type-c", inputData: {} },
          { runId, type: "type-a", inputData: {} },
        ],
        logger: console
      });
      
      expect(tasks.success).to.be.true;
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify all tasks processed
      expect(processedTasks).to.have.lengthOf(4);
      expect(processedTasks.filter(t => t.startsWith("a:")).length).to.equal(2);
      expect(processedTasks.filter(t => t.startsWith("b:")).length).to.equal(1);
      expect(processedTasks.filter(t => t.startsWith("c:")).length).to.equal(1);
    });

    it("should update task status lifecycle correctly", async function() {
      this.timeout(5000);
      
      const capturedStatuses: string[] = [];
      
      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "status-test": async (task) => {
            // Capture status during processing
            const duringTask = await getTask(config, task.id);
            if (duringTask.success) {
              capturedStatuses.push(duringTask.data.status);
            }
            
            // Simulate work
            await new Promise(resolve => setTimeout(resolve, 100));
            
            return { completed: true };
          }
        },
        logger: console
      });
      
      activeWorkers.push(worker);
      await worker.start();
      
      // Create task
      const createResult = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "status-test",
          inputData: {}
        },
        logger: console
      });
      
      expect(createResult.success).to.be.true;
      if (!createResult.success) return;
      
      // Check initial status
      const initialTask = await getTask(config, createResult.data.taskId);
      expect(initialTask.success).to.be.true;
      if (initialTask.success) {
        capturedStatuses.push(initialTask.data.status);
      }
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check final status
      const finalTask = await getTask(config, createResult.data.taskId);
      expect(finalTask.success).to.be.true;
      if (finalTask.success) {
        capturedStatuses.push(finalTask.data.status);
      }
      
      // Verify lifecycle: pending -> running -> completed
      expect(capturedStatuses).to.include("pending");
      expect(capturedStatuses).to.include("running");
      expect(capturedStatuses).to.include("completed");
    });
  });

  describe("Error Handling", () => {
    it("should handle task failures and retries", async function() {
      this.timeout(10000);
      
      let attemptCount = 0;
      
      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "retry-test": async () => {
            attemptCount++;
            if (attemptCount < 3) {
              throw new Error(`Attempt ${attemptCount} failed`);
            }
            return { success: true, attempts: attemptCount };
          }
        },
        options: {
          maxRetries: 3
        },
        logger: console
      });
      
      activeWorkers.push(worker);
      await worker.start();
      
      const result = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "retry-test",
          inputData: {},
          maxRetries: 3
        },
        logger: console
      });
      
      expect(result.success).to.be.true;
      if (!result.success) return;
      
      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Verify task eventually succeeded
      const finalTask = await getTask(config, result.data.taskId);
      expect(finalTask.success).to.be.true;
      if (finalTask.success) {
        expect(finalTask.data.status).to.equal("completed");
        expect(finalTask.data.outputData).to.deep.equal({ 
          success: true, 
          attempts: 3 
        });
      }
      
      expect(attemptCount).to.equal(3);
    });

    it("should handle permanent failures", async function() {
      this.timeout(15000);
      
      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "fail-test": async () => {
            throw new Error("This task always fails");
          }
        },
        options: {
          maxRetries: 2
        },
        logger: console
      });
      
      activeWorkers.push(worker);
      await worker.start();
      
      const result = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "fail-test",
          inputData: {},
          maxRetries: 2
        },
        logger: console
      });
      
      expect(result.success).to.be.true;
      if (!result.success) return;
      
      // Wait for retries to exhaust
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Verify task failed
      const finalTask = await getTask(config, result.data.taskId);
      expect(finalTask.success).to.be.true;
      if (finalTask.success) {
        expect(finalTask.data.status).to.equal("failed");
        expect(finalTask.data.errorData).to.have.property("message", "This task always fails");
      }
    });

    it("should handle missing task data gracefully", async function() {
      this.timeout(5000);
      
      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "any": async () => ({ processed: true })
        },
        logger: console
      });
      
      activeWorkers.push(worker);
      await worker.start();
      
      // Manually add job with non-existent task ID
      await testQueue.add("manual-test", { taskId: "non-existent-id" });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Job should fail but not crash
      const jobs = await testQueue.getJobs(["failed"]);
      expect(jobs.length).to.be.greaterThan(0);
    });
  });

  describe("Concurrency and Performance", () => {
    it("should process tasks concurrently", async function() {
      this.timeout(10000);
      
      const startTimes: number[] = [];
      const endTimes: number[] = [];
      
      const worker = await createWorker({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        handlers: {
          "concurrent-test": async (task) => {
            startTimes.push(Date.now());
            // Simulate work
            await new Promise(resolve => setTimeout(resolve, 1000));
            endTimes.push(Date.now());
            return { taskId: task.id };
          }
        },
        options: {
          concurrency: 5 // Process 5 tasks at once
        },
        logger: console
      });
      
      activeWorkers.push(worker);
      await worker.start();
      
      // Enqueue 10 tasks
      const tasks = [];
      for (let i = 0; i < 10; i++) {
        tasks.push({
          runId,
          type: "concurrent-test",
          inputData: { index: i }
        });
      }
      
      const result = await enqueueTasks({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        tasks,
        logger: console
      });
      
      expect(result.success).to.be.true;
      
      // Wait for all tasks to complete
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Verify concurrency
      expect(startTimes).to.have.lengthOf(10);
      expect(endTimes).to.have.lengthOf(10);
      
      // Check that multiple tasks overlapped (ran concurrently)
      // Sort by start time to analyze execution overlap
      const taskExecutions = startTimes.map((start, i) => ({
        start,
        end: endTimes[i]!
      })).sort((a, b) => a.start - b.start);
      
      // Count maximum concurrent tasks
      let maxConcurrent = 0;
      for (let i = 0; i < taskExecutions.length; i++) {
        let concurrent = 1;
        const taskI = taskExecutions[i];
        if (!taskI) continue;
        
        for (let j = 0; j < taskExecutions.length; j++) {
          const taskJ = taskExecutions[j];
          if (!taskJ) continue;
          
          if (i !== j && 
              taskJ.start < taskI.end && 
              taskJ.end > taskI.start) {
            concurrent++;
          }
        }
        maxConcurrent = Math.max(maxConcurrent, concurrent);
      }
      
      // With concurrency 5 and 10 tasks taking 1s each, 
      // we should see at least 5 tasks running concurrently
      expect(maxConcurrent).to.be.at.least(5);
    });
  });

  describe("Queue Management", () => {
    it("should handle queue cleanup properly", async () => {
      // Enqueue some tasks
      for (let i = 0; i < 5; i++) {
        await enqueueTask({
          foremanConfig: config,
          redisConfig,
          queueConfig,
          task: {
            runId,
            type: "cleanup-test",
            inputData: { index: i }
          },
          logger: console
        });
      }
      
      // Verify tasks are in queue
      let jobs = await testQueue.getJobs(["waiting"]);
      expect(jobs).to.have.lengthOf(5);
      
      // Clean queue
      await testQueue.obliterate({ force: true });
      
      // Verify queue is empty
      jobs = await testQueue.getJobs(["waiting", "active", "completed", "failed"]);
      expect(jobs).to.have.lengthOf(0);
    });

    it("should support multiple queue instances", async () => {
      // Create another queue instance
      const queue2 = new Queue(queueConfig.taskQueue, {
        connection: {
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: redisConfig.db
        }
      });
      
      try {
        // Add job from first queue
        await enqueueTask({
          foremanConfig: config,
          redisConfig,
          queueConfig,
          task: {
            runId,
            type: "multi-queue-test",
            inputData: { queue: 1 }
          },
          logger: console
        });
        
        // Both queues should see the job
        const jobs1 = await testQueue.getJobs(["waiting"]);
        const jobs2 = await queue2.getJobs(["waiting"]);
        
        expect(jobs1).to.have.lengthOf(1);
        expect(jobs2).to.have.lengthOf(1);
        expect(jobs1[0].id).to.equal(jobs2[0].id);
      } finally {
        await queue2.close();
      }
    });
  });
});