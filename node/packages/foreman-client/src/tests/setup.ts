import { TestDatabase, TestServer, TestHttpClient } from '@codespin/foreman-test-utils';

export const testDb = new TestDatabase({ dbName: 'foreman_client_test' });
export const testServer = new TestServer({ port: 5003, dbName: 'foreman_client_test' });
export const client = new TestHttpClient(`http://localhost:5003`);

// Test configuration for client library
export const getTestConfig = () => ({
  endpoint: 'http://localhost:5003',
  apiKey: 'fmn_test_clientorg_abc123',
  timeout: 30000
});

// Setup before all tests
before(async function() {
  this.timeout(60000); // 60 seconds for setup
  
  console.log('🚀 Starting Foreman client test setup...');
  
  // Setup database
  await testDb.setup();
  
  // Start the real Foreman server
  await testServer.start();
  
  console.log('✅ Foreman client test setup complete');
});

// Cleanup after each test
afterEach(async function() {
  await testDb.truncateAllTables();
});

// Teardown after all tests
after(async function() {
  this.timeout(30000); // 30 seconds for teardown
  
  console.log('🛑 Shutting down Foreman client tests...');
  
  // Stop server
  await testServer.stop();
  
  // Cleanup database
  await testDb.cleanup();
  
  console.log('✅ Foreman client test teardown complete');
});