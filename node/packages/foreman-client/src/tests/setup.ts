import {
  TestDatabase,
  TestServer,
  TestHttpClient,
  testLogger,
} from "@codespin/foreman-test-utils";

export const testDb = new TestDatabase({
  dbName: "foreman_client_test",
  logger: testLogger,
});
export const testServer = new TestServer({
  port: 5003,
  dbName: "foreman_client_test",
  logger: testLogger,
});
export const client = new TestHttpClient(`http://localhost:5003`);

// Test configuration for client library
export const getTestConfig = () => ({
  endpoint: "http://localhost:5003",
  orgId: "test-org",
  apiKey: "test-api-key",
  timeout: 30000,
});

// Setup before all tests
before(async function () {
  this.timeout(60000); // 60 seconds for setup

  testLogger.info("🚀 Starting Foreman client test setup...");

  // Setup database
  await testDb.setup();

  // Start the real Foreman server
  await testServer.start();

  testLogger.info("✅ Foreman client test setup complete");
});

// Cleanup after each test
afterEach(async function () {
  await testDb.truncateAllTables();
});

// Teardown after all tests
after(async function () {
  this.timeout(30000); // 30 seconds for teardown

  testLogger.info("🛑 Shutting down Foreman client tests...");

  // Stop server
  await testServer.stop();

  // Cleanup database
  await testDb.cleanup();

  testLogger.info("✅ Foreman client test teardown complete");
});
