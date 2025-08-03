import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '@codespin/foreman-logger';
import { getDb } from '@codespin/foreman-db';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { createRunData } from '../domain/run-data/create-run-data.js';
import { getRunData } from '../domain/run-data/get-run-data.js';
import { listRunData } from '../domain/run-data/list-run-data.js';

const logger = createLogger('foreman:routes:run-data');
const router = Router({ mergeParams: true }); // To access :runId from parent route

// Apply authentication to all routes
router.use(authenticate);

// Validation schemas
const createRunDataSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.unknown(),
  taskId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * POST /api/v1/runs/:runId/data - Create or update run data
 */
router.post('/', requirePermission('rundata:write'), async (req, res) => {
  try {
    const input = createRunDataSchema.parse(req.body);
    const { runId } = req.params;
    const db = getDb();
    
    const result = await createRunData(db, req.auth!.orgId, {
      runId: runId!,
      key: input.key,
      value: input.value,
      taskId: input.taskId,
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
    logger.error('Failed to create run data', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/runs/:runId/data/:key - Get specific run data
 */
router.get('/:key', requirePermission('rundata:read'), async (req, res) => {
  try {
    const { runId, key } = req.params;
    const db = getDb();
    
    const result = await getRunData(db, runId!, key!, req.auth!.orgId);
    
    if (!result.success) {
      res.status(404).json({ error: result.error.message });
      return;
    }
    
    res.json(result.data);
  } catch (error) {
    logger.error('Failed to get run data', { error, runId: req.params.runId, key: req.params.key });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/runs/:runId/data - List all data for a run
 */
router.get('/', requirePermission('rundata:read'), async (req, res) => {
  try {
    const { runId } = req.params;
    const db = getDb();
    
    const result = await listRunData(db, runId!, req.auth!.orgId);
    
    if (!result.success) {
      res.status(404).json({ error: result.error.message });
      return;
    }
    
    res.json({ items: result.data });
  } catch (error) {
    logger.error('Failed to list run data', { error, runId: req.params.runId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as runDataRouter };