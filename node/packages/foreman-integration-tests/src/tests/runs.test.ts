import { expect } from "chai";
import { testDb, client } from "../test-setup.js";

describe("Runs API", () => {
  beforeEach(async () => {
    await testDb.truncateAllTables();
  });

  describe("POST /api/v1/runs", () => {
    it("should create a new run with minimal data", async () => {
      const response = await client.post("/api/v1/runs", {
        inputData: { type: "test-workflow" },
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property("id");
      expect(response.data).to.have.property("orgId", "test-org");
      expect(response.data).to.have.property("status", "pending");
      expect(response.data).to.have.property("inputData");
      expect(response.data.inputData).to.deep.equal({ type: "test-workflow" });
      expect(response.data).to.have.property("createdAt");
      expect(response.data).to.have.property("updatedAt");
    });

    it("should create a run with metadata", async () => {
      const response = await client.post("/api/v1/runs", {
        inputData: { orderId: "12345" },
        metadata: { source: "api", priority: "high" },
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property("metadata");
      expect(response.data.metadata).to.deep.equal({
        source: "api",
        priority: "high",
      });
    });

    it("should return 400 for invalid input", async () => {
      const response = await client.post("/api/v1/runs", {
        // Missing required inputData
      });

      expect(response.status).to.equal(400);
      expect(response.data).to.have.property("error");
    });
  });

  describe("GET /api/v1/runs/:id", () => {
    it("should get a run by id", async () => {
      // Create a run first
      const createResponse = await client.post("/api/v1/runs", {
        inputData: { test: "data" },
      });
      const runId = createResponse.data.id;

      // Get the run
      const response = await client.get(`/api/v1/runs/${runId}`);

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("id", runId);
      expect(response.data).to.have.property("inputData");
      expect(response.data.inputData).to.deep.equal({ test: "data" });
    });

    it("should return 404 for non-existent run", async () => {
      const response = await client.get("/api/v1/runs/non-existent-id");

      expect(response.status).to.equal(404);
      expect(response.data).to.have.property("error");
    });
  });

  describe("PATCH /api/v1/runs/:id", () => {
    it("should update run status", async () => {
      // Create a run first
      const createResponse = await client.post("/api/v1/runs", {
        inputData: { test: "data" },
      });
      const runId = createResponse.data.id;

      // Update the run
      const response = await client.patch(`/api/v1/runs/${runId}`, {
        status: "running",
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("id", runId);
      expect(response.data).to.have.property("status", "running");
    });

    it("should update run output data", async () => {
      // Create a run first
      const createResponse = await client.post("/api/v1/runs", {
        inputData: { test: "data" },
      });
      const runId = createResponse.data.id;

      // Update with output data
      const response = await client.patch(`/api/v1/runs/${runId}`, {
        status: "completed",
        outputData: { result: "success" },
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("status", "completed");
      expect(response.data).to.have.property("outputData");
      expect(response.data.outputData).to.deep.equal({ result: "success" });
    });

    it("should return 404 for non-existent run", async () => {
      const response = await client.patch("/api/v1/runs/non-existent-id", {
        status: "completed",
      });

      expect(response.status).to.equal(404);
      expect(response.data).to.have.property("error");
    });
  });

  describe("GET /api/v1/runs", () => {
    it("should list runs with pagination", async () => {
      // Create a few runs
      await client.post("/api/v1/runs", { inputData: { test: 1 } });
      await client.post("/api/v1/runs", { inputData: { test: 2 } });
      await client.post("/api/v1/runs", { inputData: { test: 3 } });

      // List runs
      const response = await client.get("/api/v1/runs?limit=2");

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("data");
      expect(response.data).to.have.property("pagination");
      expect(response.data.data).to.have.lengthOf(2);
      expect(response.data.pagination).to.have.property("total", 3);
      expect(response.data.pagination).to.have.property("limit", 2);
      expect(response.data.pagination).to.have.property("offset", 0);
    });

    it("should filter runs by status", async () => {
      // Create runs with different statuses
      const run1Response = await client.post("/api/v1/runs", {
        inputData: { test: 1 },
      });
      await client.post("/api/v1/runs", { inputData: { test: 2 } });

      // Update one to running
      await client.patch(`/api/v1/runs/${run1Response.data.id}`, {
        status: "running",
      });

      // Filter by status
      const response = await client.get("/api/v1/runs?status=running");

      expect(response.status).to.equal(200);
      expect(response.data.data).to.have.lengthOf(1);
      expect(response.data.data[0]).to.have.property("status", "running");
    });
  });
});
