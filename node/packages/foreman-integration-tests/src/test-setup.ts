import { TestDatabase, TestServer, TestHttpClient, testLogger } from '@codespin/foreman-test-utils';

// Test configuration
export const testDb = new TestDatabase({ dbName: 'foreman_test', logger: testLogger });
export const testServer = new TestServer({ port: 5099, dbName: 'foreman_test', logger: testLogger });
export const client = new TestHttpClient(`http://localhost:5099`);

// Setup before all tests
before(async function() {
  this.timeout(60000); // 60 seconds for setup
  
  testLogger.info('🚀 Starting Foreman integration test setup...');
  
  // Setup database
  await testDb.setup();
  
  // Start the real Foreman server
  await testServer.start();
  
  testLogger.info('✅ Foreman integration test setup complete');
});

// Cleanup after each test
afterEach(async function() {
  await testDb.truncateAllTables();
});

// Teardown after all tests
after(async function() {
  this.timeout(30000); // 30 seconds for teardown
  
  testLogger.info('🛑 Shutting down Foreman integration tests...');
  
  // Stop server
  await testServer.stop();
  
  // Cleanup database
  await testDb.cleanup();
  
  testLogger.info('✅ Foreman integration test teardown complete');
});