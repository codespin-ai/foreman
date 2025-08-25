import { expect } from "chai";
import { client } from "../test-setup.js";

describe("Config API", () => {
  describe("GET /api/v1/config", () => {
    it("should return full configuration", async () => {
      const response = await client.get("/api/v1/config");

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("redis");
      expect(response.data).to.have.property("queues");
      expect(response.data).to.have.property("version");

      // Check Redis config structure
      expect(response.data.redis).to.have.property("host");
      expect(response.data.redis).to.have.property("port");

      // Check queues config structure
      expect(response.data.queues).to.have.property("taskQueue");
      expect(response.data.queues).to.have.property("resultQueue");

      // Check version
      expect(response.data.version).to.be.a("string");
    });
  });

  describe("GET /api/v1/config/redis", () => {
    it("should return Redis configuration only", async () => {
      const response = await client.get("/api/v1/config/redis");

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("host");
      expect(response.data).to.have.property("port");
      expect(response.data).to.not.have.property("queues");
      expect(response.data).to.not.have.property("version");

      // Validate types
      expect(response.data.host).to.be.a("string");
      expect(response.data.port).to.be.a("number");

      // Check for optional fields
      if (response.data.password !== undefined) {
        expect(response.data.password).to.be.a("string");
      }
      if (response.data.db !== undefined) {
        expect(response.data.db).to.be.a("number");
      }
    });
  });

  describe("GET /api/v1/config/queues", () => {
    it("should return queue configuration only", async () => {
      const response = await client.get("/api/v1/config/queues");

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("taskQueue");
      expect(response.data).to.have.property("resultQueue");
      expect(response.data).to.not.have.property("redis");
      expect(response.data).to.not.have.property("version");

      // Validate queue names are strings
      expect(response.data.taskQueue).to.be.a("string");
      expect(response.data.resultQueue).to.be.a("string");

      // Check for default values
      expect(response.data.taskQueue).to.include("tasks");
      expect(response.data.resultQueue).to.include("results");
    });
  });

  describe("Authentication", () => {
    it("should require authentication for config endpoints", async () => {
      // Make request without Bearer token
      const response = await client.get("/api/v1/config", {
        Authorization: "", // Override with empty auth header
      });

      expect(response.status).to.equal(401);
      expect(response.data).to.have.property("error");
    });

    it("should work with valid Bearer token", async () => {
      const response = await client.get("/api/v1/config", {
        Authorization: "Bearer test-token",
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("redis");
    });

    it("should reject invalid Bearer tokens", async () => {
      const response = await client.get("/api/v1/config", {
        Authorization: "Bearer wrong-token",
      });

      expect(response.status).to.equal(401);
      expect(response.data).to.have.property("error", "Invalid Bearer token");
    });
  });

  describe("Health Check", () => {
    it("should return health status without authentication", async () => {
      // Make request without Bearer token
      const response = await client.get("/health", {
        Authorization: "", // Override with empty auth header
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("status", "healthy");
      expect(response.data).to.have.property("timestamp");
      expect(response.data).to.have.property("environment", "test");
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for non-existent endpoints", async () => {
      const response = await client.get("/api/v1/non-existent");

      expect(response.status).to.equal(404);
      expect(response.data).to.have.property("error", "Not found");
    });

    it("should handle invalid JSON in request body", async () => {
      const response = await client.request("/api/v1/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      expect(response.status).to.equal(400);
      expect(response.data).to.have.property("error");
    });
  });
});
