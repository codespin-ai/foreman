import { spawn, ChildProcess } from 'child_process';
import fetch from 'node-fetch';

export class TestServer {
  private process: ChildProcess | null = null;
  private port: number;
  private maxRetries: number = 30;
  private retryDelay: number = 1000;

  constructor(port: number = 5002) {
    this.port = port;
  }

  private async killProcessOnPort(): Promise<void> {
    try {
      // Find process using the port
      const { execSync } = await import('child_process');
      const pid = execSync(`lsof -ti:${this.port} || true`).toString().trim();
      
      if (pid) {
        console.log(`Killing process ${pid} using port ${this.port}...`);
        execSync(`kill -9 ${pid}`);
        // Wait a bit for the process to die
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch {
      // Ignore errors - port might already be free
    }
  }

  async start(): Promise<void> {
    // Kill any process using the port first
    await this.killProcessOnPort();
    
    return new Promise((resolve, reject) => {
      console.log(`Starting test server on port ${this.port}...`);
      
      // Set environment variables for test server
      const env = {
        ...process.env,
        NODE_ENV: 'test',
        FOREMAN_SERVER_PORT: this.port.toString(),
        FOREMAN_DB_NAME: process.env.FOREMAN_DB_NAME || 'foreman_test',
        LOG_LEVEL: 'error', // Reduce noise in tests
        JWT_SECRET: 'test-secret-key'
      };

      // Start the server
      this.process = spawn('npm', ['start'], {
        cwd: '../foreman-server',
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let serverStarted = false;

      // Listen for server output
      this.process.stdout?.on('data', (data) => {
        const output = data.toString();
        if (!serverStarted && output.includes('Server running')) {
          serverStarted = true;
          resolve();
        }
      });

      this.process.stderr?.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      this.process.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      // Also check if server is responding
      let attempts = 0;
      const checkServer = setInterval(async () => {
        try {
          const response = await fetch(`http://localhost:${this.port}/health`);
          if (response.ok) {
            clearInterval(checkServer);
            if (!serverStarted) {
              serverStarted = true;
              resolve();
            }
          }
        } catch {
          // Server not ready yet
        }

        attempts++;
        if (attempts >= this.maxRetries) {
          clearInterval(checkServer);
          reject(new Error('Server failed to start within timeout'));
        }
      }, this.retryDelay);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      console.log('Stopping test server...');
      this.process.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        this.process!.on('exit', () => resolve());
        
        // Force kill after 5 seconds
        setTimeout(() => {
          this.process?.kill('SIGKILL');
          resolve();
        }, 5000);
      });
      
      this.process = null;
    }
  }
}