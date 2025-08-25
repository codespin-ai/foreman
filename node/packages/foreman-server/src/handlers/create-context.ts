import { createLazyDb } from "@codespin/foreman-db";
import type { DataContext } from "../domain/data-context.js";
import type { Request } from "express";

/**
 * Create a DataContext for domain operations with RLS support
 *
 * Creates a lazy database connection that initializes on first use.
 * - If x-org-id header is provided, creates RLS-enabled connection
 * - If no x-org-id (ROOT context), creates unrestricted connection
 *
 * This follows the same pattern as Permiso where orgId comes from
 * headers in a full-trust environment, not from authentication
 */
export function createContext(req?: Request): DataContext {
  // Extract organization ID from header (same as Permiso)
  // In a full-trust environment, we use x-org-id header
  const orgId = req?.headers?.["x-org-id"] as string | undefined;

  return {
    db: createLazyDb(orgId),
    orgId,
    // Future: could add more request context
    // user: req?.auth,
    // requestId: req?.id,
    // features: getFeatureFlags(orgId),
  };
}
