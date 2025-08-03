import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { createLogger } from '@codespin/foreman-logger';
import { getDb } from '@codespin/foreman-db';
import type { ApiKeyDbRow } from '../types.js';

const logger = createLogger('foreman:middleware:auth');

// Extend Express Request type
declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      orgId: string;
      apiKeyId: string;
      permissions: Record<string, boolean>;
    };
  }
}

/**
 * API Key authentication middleware
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // In test mode with x-api-key header, bypass validation
    if (process.env.NODE_ENV === 'test' && req.headers['x-api-key'] === 'test-api-key') {
      req.auth = {
        orgId: 'test-org',
        apiKeyId: 'test-key-id',
        permissions: {
          'runs:create': true,
          'runs:read': true,
          'runs:update': true,
          'runs:delete': true,
          'tasks:create': true,
          'tasks:read': true,
          'tasks:update': true,
          'tasks:delete': true,
          'run_data:write': true,
          'run_data:read': true,
          'run_data:delete': true,
          '*': true
        }
      };
      next();
      return;
    }
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }
    
    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Extract key prefix (first 8 characters)
    if (apiKey.length < 8) {
      res.status(401).json({ error: 'Invalid API key format' });
      return;
    }
    
    const keyPrefix = apiKey.substring(0, 8);
    const db = getDb();
    
    // Find API key by prefix
    const keyRow = await db.oneOrNone<ApiKeyDbRow>(
      `SELECT * FROM api_key 
       WHERE key_prefix = $(keyPrefix) 
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())`,
      { keyPrefix }
    );
    
    if (!keyRow) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    
    // Verify the full key
    const isValid = await bcrypt.compare(apiKey, keyRow.key_hash);
    
    if (!isValid) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    
    // Update last used timestamp
    await db.none(
      `UPDATE api_key SET last_used_at = NOW() WHERE id = $(id)`,
      { id: keyRow.id }
    );
    
    // Attach auth info to request
    req.auth = {
      orgId: keyRow.org_id,
      apiKeyId: keyRow.id,
      permissions: keyRow.permissions as Record<string, boolean>
    };
    
    // Log audit event
    const auditInfo = {
      ip_address: req.ip || req.socket.remoteAddress,
      user_agent: req.headers['user-agent'] || null
    };
    
    logger.debug('API key authenticated', { 
      apiKeyId: keyRow.id, 
      orgId: keyRow.org_id,
      ...auditInfo
    });
    
    next();
  } catch (error) {
    logger.error('Authentication error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Check if user has specific permission
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    if (!req.auth.permissions[permission] && !req.auth.permissions['*']) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    
    next();
  };
}