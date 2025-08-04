import { Router, Request } from 'express';
import { z } from 'zod';
import { createLogger } from '@codespin/foreman-logger';
import { getDb } from '@codespin/foreman-db';
import { authenticate } from '../middleware/auth-simple.js';
import { createRunData } from '../domain/run-data/create-run-data.js';
import { queryRunData, type QueryRunDataParams } from '../domain/run-data/query-run-data.js';
import { updateRunDataTags } from '../domain/run-data/update-run-data-tags.js';

const logger = createLogger('foreman:routes:run-data');
const router = Router({ mergeParams: true }); // To access :runId from parent route

// Apply authentication to all routes
router.use(authenticate);

// Validation schemas
const createRunDataSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.unknown(),
  taskId: z.string().uuid(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

const queryRunDataSchema = z.object({
  // Key filters
  key: z.string().optional(),
  keys: z.string().transform(val => val.split(',')).optional(),
  keyStartsWith: z.string().transform(val => val.split(',')).optional(),
  keyPattern: z.string().optional(),
  
  // Tag filters
  tags: z.string().transform(val => val.split(',')).optional(),
  tagStartsWith: z.string().transform(val => val.split(',')).optional(),
  tagMode: z.enum(['any', 'all']).optional(),
  
  // Options
  includeAll: z.string().transform(val => val === 'true').optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['created_at', 'updated_at', 'key']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const updateTagsSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional()
});

/**
 * POST /api/v1/runs/:runId/data - Create run data entry
 */
router.post('/', async (req: Request<{ runId: string }>, res) => {
  try {
    const input = createRunDataSchema.parse(req.body);
    const { runId } = req.params;
    const db = getDb();
    
    const result = await createRunData(db, req.auth!.orgId, {
      runId: runId!,
      key: input.key,
      value: input.value,
      taskId: input.taskId,
      tags: input.tags,
      metadata: input.metadata
    });
    
    if (!result.success) {
      // Return 404 if run or task not found
      if (result.error.message.includes('not found')) {
        res.status(404).json({ error: result.error.message });
        return;
      }
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
 * GET /api/v1/runs/:runId/data - Query run data with flexible filtering
 */
router.get('/', async (req: Request<{ runId: string }>, res) => {
  try {
    const { runId } = req.params;
    const params = queryRunDataSchema.parse(req.query);
    const db = getDb();
    
    // Convert parsed params to QueryRunDataParams
    const queryParams: QueryRunDataParams = {
      key: params.key,
      keys: params.keys,
      keyStartsWith: params.keyStartsWith,
      keyPattern: params.keyPattern,
      tags: params.tags,
      tagStartsWith: params.tagStartsWith,
      tagMode: params.tagMode,
      includeAll: params.includeAll,
      limit: params.limit,
      offset: params.offset,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder
    };
    
    const result = await queryRunData(db, runId!, req.auth!.orgId, queryParams);
    
    if (!result.success) {
      res.status(404).json({ error: result.error.message });
      return;
    }
    
    res.json({ 
      data: result.data,
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total: result.data.length // In a real app, you'd want a separate count query
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
      return;
    }
    logger.error('Failed to query run data', { error, runId: req.params.runId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/v1/runs/:runId/data/:dataId/tags - Update tags on a run data entry
 */
router.patch('/:dataId/tags', async (req: Request<{ runId: string; dataId: string }>, res) => {
  try {
    const { dataId } = req.params;
    const input = updateTagsSchema.parse(req.body);
    const db = getDb();
    
    const result = await updateRunDataTags(db, dataId!, req.auth!.orgId, input);
    
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
    logger.error('Failed to update run data tags', { error, dataId: req.params.dataId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/v1/runs/:runId/data - Delete run data entries
 */
router.delete('/', async (req: Request<{ runId: string }>, res) => {
  try {
    const { runId } = req.params;
    const { key, id } = req.query as { key?: string; id?: string };
    const db = getDb();
    
    if (!key && !id) {
      res.status(400).json({ error: 'Must provide either key or id parameter' });
      return;
    }
    
    let deletedCount = 0;
    
    if (id) {
      // Delete specific entry by ID
      const result = await db.result(
        `DELETE FROM run_data rd
         USING run r
         WHERE rd.id = $(id) 
           AND rd.run_id = r.id
           AND r.org_id = $(orgId)`,
        { id, orgId: req.auth!.orgId }
      );
      deletedCount = result.rowCount;
    } else if (key) {
      // Delete all entries for a key
      const result = await db.result(
        `DELETE FROM run_data rd
         USING run r
         WHERE rd.run_id = $(runId)
           AND rd.key = $(key)
           AND rd.run_id = r.id
           AND r.org_id = $(orgId)`,
        { runId, key, orgId: req.auth!.orgId }
      );
      deletedCount = result.rowCount;
    }
    
    if (deletedCount === 0) {
      res.status(404).json({ error: 'No matching run data found' });
      return;
    }
    
    res.json({ deleted: deletedCount });
  } catch (error) {
    logger.error('Failed to delete run data', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as runDataRouter };