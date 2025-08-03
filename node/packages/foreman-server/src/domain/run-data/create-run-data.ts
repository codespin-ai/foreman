import { v4 as uuidv4 } from 'uuid';
import { Result, success, failure } from '@codespin/foreman-core';
import { createLogger } from '@codespin/foreman-logger';
import type { Database } from '@codespin/foreman-db';
import type { RunData, RunDataDbRow, CreateRunDataInput } from '../../types.js';
import { mapRunDataFromDb } from '../../mappers.js';

const logger = createLogger('foreman:domain:run-data');

/**
 * Create or update run data
 * 
 * @param db - Database connection
 * @param orgId - Organization ID
 * @param input - Run data creation parameters
 * @returns Result containing the created/updated run data or an error
 */
export async function createRunData(
  db: Database,
  orgId: string,
  input: CreateRunDataInput
): Promise<Result<RunData, Error>> {
  try {
    return await db.tx(async (t) => {
      // Verify run and task exist and belong to org
      const check = await t.oneOrNone<{ run_id: string }>(
        `SELECT r.id as run_id
         FROM run r
         JOIN task t ON t.run_id = r.id
         WHERE r.id = $(runId) 
           AND t.id = $(taskId)
           AND r.org_id = $(orgId)
           AND t.org_id = $(orgId)`,
        { runId: input.runId, taskId: input.taskId, orgId }
      );
      
      if (!check) {
        return failure(new Error(`Run or task not found`));
      }
      
      const id = uuidv4();
      
      // Upsert run data (last write wins)
      const row = await t.one<RunDataDbRow>(
        `INSERT INTO run_data (
          id, run_id, task_id, org_id, key, value, metadata, created_at, updated_at
        )
        VALUES (
          $(id), $(runId), $(taskId), $(orgId), $(key), $(value), $(metadata), NOW(), NOW()
        )
        ON CONFLICT (run_id, key) 
        DO UPDATE SET
          task_id = $(taskId),
          value = $(value),
          metadata = $(metadata),
          updated_at = NOW()
        RETURNING *`,
        {
          id,
          runId: input.runId,
          taskId: input.taskId,
          orgId,
          key: input.key,
          value: input.value as Record<string, unknown>,
          metadata: input.metadata || null
        }
      );
      
      logger.info('Created/updated run data', { 
        id: row.id, 
        runId: input.runId, 
        key: input.key 
      });
      
      return success(mapRunDataFromDb(row));
    });
  } catch (error) {
    logger.error('Failed to create run data', { error, orgId, input });
    return failure(error as Error);
  }
}