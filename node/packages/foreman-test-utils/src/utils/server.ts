import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { Server } from 'http';
import { createLogger } from '@codespin/foreman-logger';
import { getDb, closeDb } from '@codespin/foreman-db';

export interface TestServerConfig {
  port?: number;
  dbName?: string;
}

export class TestServer {
  private app: express.Application;
  private server: Server | null = null;
  private port: number;
  private logger = createLogger('test-server');

  constructor(config: TestServerConfig = {}) {
    this.port = config.port || 5099;
    this.app = express();
    
    // Set test database configuration to match test environment
    if (config.dbName) {
      process.env.FOREMAN_DB_NAME = config.dbName;
    }
    
    // Ensure test server uses the same database credentials as test database
    process.env.FOREMAN_DB_HOST = process.env.FOREMAN_DB_HOST || 'localhost';
    process.env.FOREMAN_DB_PORT = process.env.FOREMAN_DB_PORT || '5432';
    process.env.FOREMAN_DB_USER = process.env.FOREMAN_DB_USER || 'postgres';
    process.env.FOREMAN_DB_PASSWORD = process.env.FOREMAN_DB_PASSWORD || 'postgres';
    
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // Security middleware (minimal for testing)
    this.app.use(helmet());
    this.app.use(cors({
      origin: '*',
      credentials: true
    }));

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(compression());

    // Request logging (minimal for testing)
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        if (process.env.TEST_VERBOSE === 'true') {
          this.logger.info('Request completed', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration
          });
        }
      });
      next();
    });
  }

  private async setupRoutes(): Promise<void> {
    // Dynamic import to avoid circular dependencies
    let runsRouter: any, tasksRouter: any, runDataRouter: any, configRouter: any;
    
    try {
      const serverPath = '@codespin/foreman-server';
      ({ runsRouter } = await import(`${serverPath}/routes/runs.js`));
      ({ tasksRouter } = await import(`${serverPath}/routes/tasks.js`));
      ({ runDataRouter } = await import(`${serverPath}/routes/run-data.js`));
      ({ configRouter } = await import(`${serverPath}/routes/config.js`));
    } catch (error) {
      // Routes not available yet, create placeholder routers
      this.logger.warn('Could not load server routes, using placeholder routers', { error: error instanceof Error ? error.message : String(error) });
      
      const notImplemented = (_req: any, res: any) => {
        res.status(501).json({ error: 'Route not implemented in test server' });
      };
      
      // Create proper Express router placeholders
      runsRouter = express.Router();
      runsRouter.use(notImplemented);
      
      tasksRouter = express.Router();
      tasksRouter.use(notImplemented);
      
      runDataRouter = express.Router();
      runDataRouter.use(notImplemented);
      
      configRouter = express.Router();
      configRouter.use(notImplemented);
    }

    // Health check (no auth required)
    this.app.get('/health', (_req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        environment: 'test' 
      });
    });

    // API routes
    this.app.use('/api/v1/runs', runsRouter);
    this.app.use('/api/v1/tasks', tasksRouter);
    this.app.use('/api/v1/runs/:runId/data', runDataRouter);
    this.app.use('/api/v1/config', configRouter);

    // 404 handler
    this.app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      this.logger.error('Unhandled error', { error: err });
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  public async start(): Promise<void> {
    if (this.server) {
      this.logger.warn('Server already running');
      return;
    }

    try {
      // Setup routes with dynamic imports
      await this.setupRoutes();
      
      // Test database connection
      const db = getDb();
      await db.one('SELECT 1 as ok');
      this.logger.info('Database connection established');
      
      // Start listening
      await new Promise<void>((resolve, reject) => {
        this.server = this.app.listen(this.port, (err?: Error) => {
          if (err) {
            reject(err);
          } else {
            this.logger.info(`Test server running on port ${this.port}`);
            resolve();
          }
        });
      });
    } catch (error) {
      this.logger.error('Failed to start test server', { error });
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      this.logger.warn('Server not running');
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((err?: Error) => {
          if (err) {
            reject(err);
          } else {
            this.logger.info('Test server stopped');
            resolve();
          }
        });
      });
      
      this.server = null;
      
      // Close database connections
      await closeDb();
    } catch (error) {
      this.logger.error('Error stopping test server', { error });
      throw error;
    }
  }

  public getPort(): number {
    return this.port;
  }

  public getApp(): express.Application {
    return this.app;
  }
}