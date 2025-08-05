import { expect } from "chai";
import { Queue } from "bullmq";
import { testDb, getTestConfig } from "./setup.js";
import {
  createRun,
  getTask,
  enqueueTask,
  initializeForemanClient,
} from "../index.js";

describe("ID-Only Queue Pattern", () => {
  const config = getTestConfig();
  let runId: string;
  let redisConfig: any;
  let queueConfig: any;

  beforeEach(async function() {
    this.timeout(10000);
    await testDb.truncateAllTables();
    
    // Initialize with test queue names
    const testConfig = {
      ...config,
      queues: {
        taskQueue: "foreman-test-pattern",
        resultQueue: "foreman-test-results"
      }
    };
    
    const client = await initializeForemanClient(testConfig);
    redisConfig = client.redisConfig;
    queueConfig = client.queueConfig;
    
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
    // Clean up any created queues
    const queue = new Queue(queueConfig.taskQueue, {
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db
      }
    });
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it("should only store task ID in queue, not full data", async function() {
    this.timeout(5000);
    
    // Create a queue instance to inspect what's stored
    const queue = new Queue(queueConfig.taskQueue, {
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db
      }
    });
    
    try {
      
      // Test data with various types
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
      
      // Enqueue a task with complex data
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
            version: "1.0.0",
            timestamp: Date.now()
          }
        },
        logger: {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {}
        }
      });
      
      if (!result.success) {
        throw new Error(`Failed to enqueue task: ${result.error.message}`);
      }
      
      const { taskId } = result.data;
      
      // Verify what's in the queue - should ONLY be task ID
      const jobs = await queue.getJobs(["waiting"]);
      expect(jobs).to.have.lengthOf(1);
      
      const job = jobs[0];
      
      // Queue should only contain taskId
      expect(job.data).to.deep.equal({ taskId });
      expect(Object.keys(job.data)).to.have.lengthOf(1);
      
      // Ensure no data leaked to queue
      expect(job.data).to.not.have.property("inputData");
      expect(job.data).to.not.have.property("metadata");
      expect(job.data).to.not.have.property("runId");
      expect(job.data).to.not.have.property("type");
      expect(job.data).to.not.have.property("complexData");
      
      // Verify full data is stored in database
      const taskResult = await getTask(config, taskId);
      expect(taskResult.success).to.be.true;
      if (!taskResult.success) return;
      
      const task = taskResult.data;
      
      // All data should be in database
      expect(task.type).to.equal("complex-data-test");
      expect(task.runId).to.equal(runId);
      expect(task.inputData).to.deep.equal(complexData);
      expect(task.metadata).to.have.property("source", "test-suite");
      expect(task.metadata).to.have.property("version", "1.0.0");
      expect(task.metadata).to.have.property("timestamp");
      
      // Status should be pending (task created but not yet processed)
      expect(task.status).to.equal("pending");
    } finally {
      await queue.close();
    }
  });

  it("should handle priority and delay with ID-only pattern", async function() {
    this.timeout(5000);
    
    const queue = new Queue(queueConfig.taskQueue, {
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db
      }
    });
    
    try {
      
      // Enqueue with priority and delay
      const result = await enqueueTask({
        foremanConfig: config,
        redisConfig,
        queueConfig,
        task: {
          runId,
          type: "priority-test",
          inputData: { test: "priority" },
          priority: 100,
          delay: 5000 // 5 second delay
        },
        logger: {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {}
        }
      });
      
      if (!result.success) {
        throw new Error(`Failed to enqueue task: ${result.error.message}`);
      }
      
      // Check the job in queue
      const jobs = await queue.getJobs(["delayed"]);
      expect(jobs).to.have.lengthOf(1);
      
      const job = jobs[0];
      
      // Verify only taskId in data
      expect(job.data).to.deep.equal({ taskId: result.data.taskId });
      
      // Verify job options were set correctly
      expect(job.opts.priority).to.equal(100);
      expect(job.opts.delay).to.be.at.least(4000); // Account for processing time
    } finally {
      await queue.close();
    }
  });
});