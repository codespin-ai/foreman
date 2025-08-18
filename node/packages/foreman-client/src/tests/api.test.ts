import { expect } from "chai";
import { testDb, getTestConfig } from "./setup.js";
import {
  createRun,
  getRun,
  updateRun,
  listRuns,
  createTask,
  getTask,
  updateTask,
  createRunData,
  queryRunData,
  updateRunDataTags,
  deleteRunData,
  getRedisConfig,
  getQueueConfig,
} from "../index.js";

// Simple test logger
const testLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe("Foreman Client API", () => {
  const config = getTestConfig();

  beforeEach(async () => {
    await testDb.truncateAllTables();
  });

  describe("Configuration Functions", () => {
    it("should get Redis configuration", async () => {
      const result = await getRedisConfig(config, testLogger);

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("host");
        expect(result.data).to.have.property("port");
        expect(result.data.host).to.be.a("string");
        expect(result.data.port).to.be.a("number");
      }
    });

    it("should get queue configuration", async () => {
      const result = await getQueueConfig(config, testLogger);

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("taskQueue");
        expect(result.data).to.have.property("resultQueue");
        expect(result.data.taskQueue).to.be.a("string");
        expect(result.data.resultQueue).to.be.a("string");
      }
    });
  });

  describe("Run Management", () => {
    it("should create a run", async () => {
      const result = await createRun(config, {
        inputData: { type: "test-workflow", orderId: "12345" },
      });

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("id");
        expect(result.data).to.have.property("orgId", "clientorg");
        expect(result.data).to.have.property("status", "pending");
        expect(result.data).to.have.property("inputData");
        expect(result.data.inputData).to.deep.equal({
          type: "test-workflow",
          orderId: "12345",
        });
      }
    });

    it("should get a run by id", async () => {
      // Create a run first
      const createResult = await createRun(config, {
        inputData: { test: "data" },
      });
      expect(createResult.success).to.be.true;
      if (!createResult.success) return;

      const runId = createResult.data.id;

      // Get the run
      const result = await getRun(config, runId);

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("id", runId);
        expect(result.data).to.have.property("inputData");
        expect(result.data.inputData).to.deep.equal({ test: "data" });
      }
    });

    it("should update a run", async () => {
      // Create a run first
      const createResult = await createRun(config, {
        inputData: { test: "data" },
      });
      expect(createResult.success).to.be.true;
      if (!createResult.success) return;

      const runId = createResult.data.id;

      // Update the run
      const result = await updateRun(config, runId, {
        status: "running",
        outputData: { progress: 50 },
      });

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("id", runId);
        expect(result.data).to.have.property("status", "running");
        expect(result.data).to.have.property("outputData");
        expect(result.data.outputData).to.deep.equal({ progress: 50 });
      }
    });

    it("should list runs with pagination", async () => {
      // Create multiple runs
      await createRun(config, { inputData: { test: 1 } });
      await createRun(config, { inputData: { test: 2 } });
      await createRun(config, { inputData: { test: 3 } });

      // List with pagination
      const result = await listRuns(config, { limit: 2, offset: 0 });

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("data");
        expect(result.data).to.have.property("pagination");
        expect(result.data.data).to.have.lengthOf(2);
        expect(result.data.pagination.total).to.equal(3);
        expect(result.data.pagination.limit).to.equal(2);
      }
    });

    it("should handle run creation errors", async () => {
      const result = await createRun(config, {} as any); // Invalid input

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.be.instanceOf(Error);
      }
    });
  });

  describe("Task Management", () => {
    let runId: string;

    beforeEach(async () => {
      const createResult = await createRun(config, {
        inputData: { type: "test-workflow" },
      });
      expect(createResult.success).to.be.true;
      if (createResult.success) {
        runId = createResult.data.id;
      }
    });

    it("should create a task", async () => {
      const result = await createTask(config, {
        runId,
        type: "process-data",
        inputData: { step: 1 },
      });

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("id");
        expect(result.data).to.have.property("runId", runId);
        expect(result.data).to.have.property("type", "process-data");
        expect(result.data).to.have.property("status", "pending");
        expect(result.data.inputData).to.deep.equal({ step: 1 });
      }
    });

    it("should get a task by id", async () => {
      // Create a task first
      const createResult = await createTask(config, {
        runId,
        type: "test-task",
        inputData: { test: "data" },
      });
      expect(createResult.success).to.be.true;
      if (!createResult.success) return;

      const taskId = createResult.data.id;

      // Get the task
      const result = await getTask(config, taskId);

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("id", taskId);
        expect(result.data).to.have.property("runId", runId);
        expect(result.data).to.have.property("type", "test-task");
      }
    });

    it("should update a task", async () => {
      // Create a task first
      const createResult = await createTask(config, {
        runId,
        type: "test-task",
        inputData: { test: "data" },
      });
      expect(createResult.success).to.be.true;
      if (!createResult.success) return;

      const taskId = createResult.data.id;

      // Update the task
      const result = await updateTask(config, taskId, {
        status: "completed",
        outputData: { result: "success" },
      });

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("id", taskId);
        expect(result.data).to.have.property("status", "completed");
        expect(result.data).to.have.property("outputData");
        expect(result.data.outputData).to.deep.equal({ result: "success" });
      }
    });
  });

  describe("Run Data Management", () => {
    let runId: string;
    let taskId: string;

    beforeEach(async () => {
      // Create run and task for run data tests
      const runResult = await createRun(config, {
        inputData: { type: "test-workflow" },
      });
      expect(runResult.success).to.be.true;
      if (runResult.success) {
        runId = runResult.data.id;
      }

      const taskResult = await createTask(config, {
        runId,
        type: "test-task",
        inputData: {},
      });
      expect(taskResult.success).to.be.true;
      if (taskResult.success) {
        taskId = taskResult.data.id;
      }
    });

    it("should create run data", async () => {
      const result = await createRunData(config, runId, {
        taskId,
        key: "user-profile",
        value: { name: "John Doe", email: "john@example.com" },
        tags: ["user", "profile"],
      });

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("id");
        expect(result.data).to.have.property("runId", runId);
        expect(result.data).to.have.property("taskId", taskId);
        expect(result.data).to.have.property("key", "user-profile");
        expect(result.data).to.have.property("value");
        expect(result.data.value).to.deep.equal({
          name: "John Doe",
          email: "john@example.com",
        });
        expect(result.data).to.have.property("tags");
        expect(result.data.tags).to.deep.equal(["user", "profile"]);
      }
    });

    it("should query run data", async () => {
      // Create some test data
      await createRunData(config, runId, {
        taskId,
        key: "config",
        value: { theme: "dark" },
        tags: ["config"],
      });

      await createRunData(config, runId, {
        taskId,
        key: "user-data",
        value: { name: "Jane" },
        tags: ["user"],
      });

      // Query all data
      const result = await queryRunData(config, runId, { includeAll: true });

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("data");
        expect(result.data).to.have.property("pagination");
        expect(result.data.data).to.have.lengthOf(2);
      }
    });

    it("should query run data with filters", async () => {
      // Create test data
      await createRunData(config, runId, {
        taskId,
        key: "user-data",
        value: { name: "John" },
        tags: ["user", "profile"],
      });

      await createRunData(config, runId, {
        taskId,
        key: "config",
        value: { theme: "dark" },
        tags: ["config"],
      });

      // Query by key
      const keyResult = await queryRunData(config, runId, {
        key: "user-data",
        includeAll: true,
      });
      expect(keyResult.success).to.be.true;
      if (keyResult.success) {
        expect(keyResult.data.data).to.have.lengthOf(1);
        expect(keyResult.data.data[0]?.key).to.equal("user-data");
      }

      // Query by tags
      const tagResult = await queryRunData(config, runId, {
        tags: ["config"],
        includeAll: true,
      });
      expect(tagResult.success).to.be.true;
      if (tagResult.success) {
        expect(tagResult.data.data).to.have.lengthOf(1);
        expect(tagResult.data.data[0]?.tags).to.include("config");
      }
    });

    it("should update run data tags", async () => {
      // Create run data first
      const createResult = await createRunData(config, runId, {
        taskId,
        key: "test-data",
        value: { test: "value" },
        tags: ["original"],
      });
      expect(createResult.success).to.be.true;
      if (!createResult.success) return;

      const dataId = createResult.data.id;

      // Update tags
      const result = await updateRunDataTags(config, runId, dataId, {
        add: ["updated", "new"],
        remove: ["original"],
      });

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("tags");
        expect(result.data.tags).to.deep.equal(["updated", "new"]);
      }
    });

    it("should delete run data by key", async () => {
      // Create test data
      await createRunData(config, runId, {
        taskId,
        key: "temp-data",
        value: { temp: "value" },
      });

      // Delete by key
      const result = await deleteRunData(config, runId, { key: "temp-data" });

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data).to.have.property("deleted");
        expect(result.data.deleted).to.be.greaterThan(0);
      }

      // Verify deletion
      const queryResult = await queryRunData(config, runId, {
        key: "temp-data",
        includeAll: true,
      });
      expect(queryResult.success).to.be.true;
      if (queryResult.success) {
        expect(queryResult.data.data).to.have.lengthOf(0);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid configuration", async () => {
      const invalidConfig = {
        endpoint: "http://invalid-host:9999",
        apiKey: "test-key",
      };

      const result = await createRun(invalidConfig, {
        inputData: { test: "data" },
      });

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.be.instanceOf(Error);
      }
    });

    it("should handle unauthorized requests", async () => {
      const unauthorizedConfig = {
        ...config,
        apiKey: "invalid-key",
      };

      const result = await createRun(unauthorizedConfig, {
        inputData: { test: "data" },
      });

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.be.instanceOf(Error);
        expect(result.error.message).to.include("Invalid API key format");
      }
    });

    it("should handle not found errors", async () => {
      const result = await getRun(
        config,
        "00000000-0000-0000-0000-000000000000",
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.be.instanceOf(Error);
        expect(result.error.message).to.include("not found");
      }
    });
  });
});
