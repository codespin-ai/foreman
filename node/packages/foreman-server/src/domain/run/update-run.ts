import { Result, success, failure } from '@codespin/foreman-core';
import { createLogger } from '@codespin/foreman-logger';
import type { Database } from '@codespin/foreman-db';
import type { Run, RunDbRow, UpdateRunInput } from '../../types.js';
import { mapRunFromDb } from '../../mappers.js';

const logger = createLogger('foreman:domain:run');

/**
 * Update a run
 * 
 * @param db - Database connection
 * @param id - Run ID
 * @param orgId - Organization ID for access control
 * @param input - Update parameters
 * @returns Result containing the updated run or an error
 */
export async function updateRun(
  db: Database,
  id: string,
  orgId: string,
  input: UpdateRunInput
): Promise<Result<Run, Error>> {
  try {
    const updates: string[] = [];
    const params: Record<string, unknown> = { id, orgId };
    
    if (input.status !== undefined) {
      updates.push('status = $(status)');
      params.status = input.status;
      
      // Set started_at when transitioning to running
      if (input.status === 'running') {
        updates.push('started_at = COALESCE(started_at, NOW())');
      }
      
      // Set completed_at and calculate duration when transitioning to terminal state
      if (['completed', 'failed', 'cancelled'].includes(input.status)) {
        updates.push('completed_at = NOW()');
        updates.push('duration_ms = EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at))) * 1000');
      }
    }
    
    if (input.outputData !== undefined) {
      updates.push('output_data = $(outputData)');
      params.outputData = input.outputData as Record<string, unknown>;
    }
    
    if (input.errorData !== undefined) {
      updates.push('error_data = $(errorData)');
      params.errorData = input.errorData as Record<string, unknown>;
    }
    
    if (input.metadata !== undefined) {
      updates.push('metadata = $(metadata)');
      params.metadata = input.metadata as Record<string, unknown>;
    }
    
    if (updates.length === 0) {
      return failure(new Error('No fields to update'));
    }
    
    const row = await db.oneOrNone<RunDbRow>(
      `UPDATE run 
       SET ${updates.join(', ')}
       WHERE id = $(id) AND org_id = $(orgId)
       RETURNING *`,
      params
    );
    
    if (!row) {
      return failure(new Error(`Run not found: ${id}`));
    }
    
    logger.info('Updated run', { id, orgId, updates: Object.keys(input) });
    
    return success(mapRunFromDb(row));
  } catch (error) {
    logger.error('Failed to update run', { error, id, orgId, input });
    return failure(error as Error);
  }
}