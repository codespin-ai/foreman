import { TestDatabase, TestHttpClient } from '@codespin/foreman-test-utils';
import { spawn, ChildProcess } from 'child_process';

// Test configuration
export const testDb = new TestDatabase({ dbName: 'foreman_test' });
export const client = new TestHttpClient(`http://localhost:5099`);

let serverProcess: ChildProcess | null = null;

// Setup before all tests
before(async function() {
  this.timeout(60000); // 60 seconds for setup
  
  console.log('🚀 Starting Foreman integration test setup...');
  
  // Setup database
  await testDb.setup();
  
  // Start the real Foreman server
  await startForemanServer();
  
  console.log('✅ Foreman integration test setup complete');
});

async function startForemanServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Set environment variables for test database
    const env = {
      ...process.env,
      FOREMAN_DB_NAME: 'foreman_test',
      FOREMAN_DB_HOST: 'localhost',
      FOREMAN_DB_PORT: '5432',
      FOREMAN_DB_USER: 'postgres',
      FOREMAN_DB_PASSWORD: 'postgres',
      FOREMAN_SERVER_PORT: '5099',
      NODE_ENV: 'test'
    };

    // Start the foreman-server process
    serverProcess = spawn('node', ['dist/index.js'], {
      cwd: '../../../node/packages/foreman-server',
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let startupTimeout: NodeJS.Timeout;

    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('Server output:', output);
      
      // Look for server startup message
      if (output.includes('Server running')) {
        clearTimeout(startupTimeout);
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    serverProcess.on('error', (error) => {
      clearTimeout(startupTimeout);
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        clearTimeout(startupTimeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Timeout after 30 seconds
    startupTimeout = setTimeout(() => {
      reject(new Error('Server startup timeout'));
    }, 30000);
  });
}

async function stopForemanServer(): Promise<void> {
  if (serverProcess) {
    return new Promise((resolve) => {
      serverProcess!.on('exit', () => {
        serverProcess = null;
        resolve();
      });
      
      // Try graceful shutdown first
      serverProcess!.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (serverProcess) {
          serverProcess.kill('SIGKILL');
        }
      }, 5000);
    });
  }
}

// Cleanup after each test
afterEach(async function() {
  await testDb.truncateAllTables();
});

// Teardown after all tests
after(async function() {
  this.timeout(30000); // 30 seconds for teardown
  
  console.log('🛑 Shutting down Foreman integration tests...');
  
  // Stop server
  await stopForemanServer();
  
  // Cleanup database
  await testDb.cleanup();
  
  console.log('✅ Foreman integration test teardown complete');
});