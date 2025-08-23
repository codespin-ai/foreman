import { getDb } from "@codespin/foreman-db";
import type { DataContext } from "../domain/data-context.js";
import type { Request } from "express";

/**
 * Create a DataContext for domain operations
 * This is where we can add request-specific context in the future
 */
export function createContext(_req?: Request): DataContext {
  return {
    db: getDb(),
    // Future: could add request context
    // user: _req?.auth,
    // requestId: _req?.id,
    // features: getFeatureFlags(_req?.auth?.orgId),
  };
}
