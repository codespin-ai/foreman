import { expect } from "chai";
import { testDb, client } from "../test-setup.js";

describe("Tasks API", () => {
  let runId: string;

  beforeEach(async () => {
    await testDb.truncateAllTables();

    // Create a run for task tests
    const runResponse = await client.post("/api/v1/runs", {
      inputData: { type: "test-workflow" },
    });
    runId = runResponse.data.id;
  });

  describe("POST /api/v1/tasks", () => {
    it("should create a new task", async () => {
      const response = await client.post("/api/v1/tasks", {
        runId,
        type: "process-data",
        inputData: { step: 1 },
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property("id");
      expect(response.data).to.have.property("runId", runId);
      expect(response.data).to.have.property("type", "process-data");
      expect(response.data).to.have.property("status", "pending");
      expect(response.data).to.have.property("inputData");
      expect(response.data.inputData).to.deep.equal({ step: 1 });
      expect(response.data).to.have.property("createdAt");
      expect(response.data).to.have.property("updatedAt");
    });

    it("should create a task with parent relationship", async () => {
      // Create parent task
      const parentResponse = await client.post("/api/v1/tasks", {
        runId,
        type: "parent-task",
        inputData: { step: 1 },
      });

      // Create child task
      const response = await client.post("/api/v1/tasks", {
        runId,
        type: "child-task",
        parentTaskId: parentResponse.data.id,
        inputData: { step: 2 },
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property(
        "parentTaskId",
        parentResponse.data.id,
      );
    });

    it("should return 400 for invalid input", async () => {
      const response = await client.post("/api/v1/tasks", {
        // Missing required fields
        type: "invalid-task",
      });

      expect(response.status).to.equal(400);
      expect(response.data).to.have.property("error");
    });

    it("should return 404 for non-existent run", async () => {
      const response = await client.post("/api/v1/tasks", {
        runId: "00000000-0000-0000-0000-000000000000",
        type: "test-task",
        inputData: {},
      });

      expect(response.status).to.equal(404);
      expect(response.data).to.have.property("error");
    });
  });

  describe("GET /api/v1/tasks/:id", () => {
    it("should get a task by id", async () => {
      // Create a task first
      const createResponse = await client.post("/api/v1/tasks", {
        runId,
        type: "test-task",
        inputData: { test: "data" },
      });
      const taskId = createResponse.data.id;

      // Get the task
      const response = await client.get(`/api/v1/tasks/${taskId}`);

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("id", taskId);
      expect(response.data).to.have.property("runId", runId);
      expect(response.data).to.have.property("type", "test-task");
    });

    it("should return 404 for non-existent task", async () => {
      const response = await client.get("/api/v1/tasks/non-existent-id");

      expect(response.status).to.equal(404);
      expect(response.data).to.have.property("error");
    });
  });

  describe("PATCH /api/v1/tasks/:id", () => {
    it("should update task status", async () => {
      // Create a task first
      const createResponse = await client.post("/api/v1/tasks", {
        runId,
        type: "test-task",
        inputData: { test: "data" },
      });
      const taskId = createResponse.data.id;

      // Update the task
      const response = await client.patch(`/api/v1/tasks/${taskId}`, {
        status: "running",
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("id", taskId);
      expect(response.data).to.have.property("status", "running");
    });

    it("should update task with output data and completion", async () => {
      // Create a task first
      const createResponse = await client.post("/api/v1/tasks", {
        runId,
        type: "test-task",
        inputData: { test: "data" },
      });
      const taskId = createResponse.data.id;

      // Update with completion
      const response = await client.patch(`/api/v1/tasks/${taskId}`, {
        status: "completed",
        outputData: { result: "success" },
        completedAt: new Date().toISOString(),
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("status", "completed");
      expect(response.data).to.have.property("outputData");
      expect(response.data.outputData).to.deep.equal({ result: "success" });
      expect(response.data).to.have.property("completedAt");
    });

    it("should update task with error information", async () => {
      // Create a task first
      const createResponse = await client.post("/api/v1/tasks", {
        runId,
        type: "test-task",
        inputData: { test: "data" },
      });
      const taskId = createResponse.data.id;

      // Update with error
      const response = await client.patch(`/api/v1/tasks/${taskId}`, {
        status: "failed",
        errorData: { message: "Task processing failed" },
        completedAt: new Date().toISOString(),
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("status", "failed");
      expect(response.data).to.have.property("errorData");
      expect(response.data.errorData).to.deep.equal({
        message: "Task processing failed",
      });
    });

    it("should return 404 for non-existent task", async () => {
      const response = await client.patch("/api/v1/tasks/non-existent-id", {
        status: "completed",
      });

      expect(response.status).to.equal(404);
      expect(response.data).to.have.property("error");
    });
  });

  describe("GET /api/v1/tasks", () => {
    it("should list tasks with pagination", async () => {
      // Create several tasks
      await client.post("/api/v1/tasks", {
        runId,
        type: "task-1",
        inputData: {},
      });
      await client.post("/api/v1/tasks", {
        runId,
        type: "task-2",
        inputData: {},
      });
      await client.post("/api/v1/tasks", {
        runId,
        type: "task-3",
        inputData: {},
      });

      // List tasks
      const response = await client.get("/api/v1/tasks?limit=2");

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("data");
      expect(response.data).to.have.property("pagination");
      expect(response.data.data).to.have.lengthOf(2);
      expect(response.data.pagination).to.have.property("total", 3);
    });

    it("should filter tasks by run id", async () => {
      // Create another run
      const run2Response = await client.post("/api/v1/runs", {
        inputData: { type: "other-workflow" },
      });
      const run2Id = run2Response.data.id;

      // Create tasks in both runs
      await client.post("/api/v1/tasks", {
        runId,
        type: "task-1",
        inputData: {},
      });
      await client.post("/api/v1/tasks", {
        runId: run2Id,
        type: "task-2",
        inputData: {},
      });

      // Filter by run
      const response = await client.get(`/api/v1/tasks?runId=${runId}`);

      expect(response.status).to.equal(200);
      expect(response.data.data).to.have.lengthOf(1);
      expect(response.data.data[0]).to.have.property("runId", runId);
    });

    it("should filter tasks by status", async () => {
      // Create tasks
      const task1Response = await client.post("/api/v1/tasks", {
        runId,
        type: "task-1",
        inputData: {},
      });
      await client.post("/api/v1/tasks", {
        runId,
        type: "task-2",
        inputData: {},
      });

      // Update one to running
      await client.patch(`/api/v1/tasks/${task1Response.data.id}`, {
        status: "running",
      });

      // Filter by status
      const response = await client.get("/api/v1/tasks?status=running");

      expect(response.status).to.equal(200);
      expect(response.data.data).to.have.lengthOf(1);
      expect(response.data.data[0]).to.have.property("status", "running");
    });
  });
});
