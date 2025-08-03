import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '@codespin/foreman-logger';
import { getDb } from '@codespin/foreman-db';
import { authenticate } from '../middleware/auth-simple.js';
import { createRun } from '../domain/run/create-run.js';
import { getRun } from '../domain/run/get-run.js';
import { updateRun } from '../domain/run/update-run.js';
import { listRuns } from '../domain/run/list-runs.js';

const logger = createLogger('foreman:routes:runs');
const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation schemas
const createRunSchema = z.object({
  inputData: z.unknown(),
  metadata: z.record(z.unknown()).optional()
});

const updateRunSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  outputData: z.unknown().optional(),
  errorData: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional()
});

const listRunsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.string().optional(),
  sortBy: z.enum(['created_at', 'started_at', 'completed_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

/**
 * POST /api/v1/runs - Create a new run
 */
router.post('/', async (req, res) => {
  try {
    const input = createRunSchema.parse(req.body);
    const db = getDb();
    
    const result = await createRun(db, {
      orgId: req.auth!.orgId,
      inputData: input.inputData,
      metadata: input.metadata
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
    logger.error('Failed to create run', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/runs/:id - Get a run by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await getRun(db, req.params.id!, req.auth!.orgId);
    
    if (!result.success) {
      res.status(404).json({ error: result.error.message });
      return;
    }
    
    res.json(result.data);
  } catch (error) {
    logger.error('Failed to get run', { error, id: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/v1/runs/:id - Update a run
 */
router.patch('/:id', async (req, res) => {
  try {
    const input = updateRunSchema.parse(req.body);
    const db = getDb();
    
    const result = await updateRun(db, req.params.id!, req.auth!.orgId, input);
    
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
    logger.error('Failed to update run', { error, id: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/runs - List runs
 */
router.get('/', async (req, res) => {
  try {
    const params = listRunsSchema.parse(req.query);
    const db = getDb();
    
    const result = await listRuns(db, req.auth!.orgId, params);
    
    if (!result.success) {
      res.status(400).json({ error: result.error.message });
      return;
    }
    
    res.json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
      return;
    }
    logger.error('Failed to list runs', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as runsRouter };