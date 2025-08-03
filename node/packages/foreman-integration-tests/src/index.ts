import { TestDatabase } from './utils/test-db.js';
import { TestServer } from './utils/server.js';
import { HttpClient } from './utils/http-client.js';

// Import all test files
import './tests/health.test.js';
import './tests/runs.test.js';
import './tests/tasks.test.js';
import './tests/run-data.test.js';

export let testDb: TestDatabase;
export let server: TestServer;
export let client: HttpClient;

before(async function() {
  this.timeout(60000);
  console.log('🚀 Starting test environment...');
  
  // Setup database
  testDb = TestDatabase.getInstance();
  await testDb.setup();
  
  // Start server
  server = new TestServer(5002);
  await server.start();
  
  // Initialize HTTP client with API key
  client = new HttpClient('http://localhost:5002', {
    headers: {
      'x-api-key': 'test-api-key' // This should match a test API key in DB
    }
  });
  
  console.log('✅ Test environment ready');
});

after(async function() {
  this.timeout(30000);
  console.log('🧹 Cleaning up test environment...');
  
  try {
    // Stop server first
    if (server) {
      await server.stop();
    }
    
    // Cleanup database
    if (testDb) {
      await testDb.cleanup();
    }
    
    console.log('✅ Cleanup complete');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});

beforeEach(async () => {
  // Clear all data between tests
  await testDb.truncateAllTables();
});