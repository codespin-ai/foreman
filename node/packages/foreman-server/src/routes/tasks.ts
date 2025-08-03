import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '@codespin/foreman-logger';
import { getDb } from '@codespin/foreman-db';
import { authenticate } from '../middleware/auth-simple.js';
import { createTask } from '../domain/task/create-task.js';
import { getTask } from '../domain/task/get-task.js';
import { updateTask } from '../domain/task/update-task.js';

const logger = createLogger('foreman:routes:tasks');
const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation schemas
const createTaskSchema = z.object({
  runId: z.string().uuid(),
  parentTaskId: z.string().uuid().optional(),
  type: z.string().min(1),
  inputData: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
  maxRetries: z.number().min(0).max(10).optional()
});

const updateTaskSchema = z.object({
  status: z.enum(['pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'retrying']).optional(),
  outputData: z.unknown().optional(),
  errorData: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  queueJobId: z.string().optional()
});

/**
 * POST /api/v1/tasks - Create a new task
 */
router.post('/', async (req, res) => {
  try {
    const input = createTaskSchema.parse(req.body);
    const db = getDb();
    
    const result = await createTask(db, req.auth!.orgId, {
      runId: input.runId,
      parentTaskId: input.parentTaskId,
      type: input.type,
      inputData: input.inputData,
      metadata: input.metadata,
      maxRetries: input.maxRetries
    });
    
    if (!result.success) {
      res.status(400).json({ error: result.error.message });
      return;
    }
    
    res.status(201).json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
      return;
    }
    logger.error('Failed to create task', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/tasks/:id - Get a task by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await getTask(db, req.params.id!, req.auth!.orgId);
    
    if (!result.success) {
      res.status(404).json({ error: result.error.message });
      return;
    }
    
    res.json(result.data);
  } catch (error) {
    logger.error('Failed to get task', { error, id: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/v1/tasks/:id - Update a task
 */
router.patch('/:id', async (req, res) => {
  try {
    const input = updateTaskSchema.parse(req.body);
    const db = getDb();
    
    const result = await updateTask(db, req.params.id!, req.auth!.orgId, input);
    
    if (!result.success) {
      res.status(404).json({ error: result.error.message });
      return;
    }
    
    res.json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
      return;
    }
    logger.error('Failed to update task', { error, id: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as tasksRouter };