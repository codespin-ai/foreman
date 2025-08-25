import { createLazyDb } from "@codespin/foreman-db";
import type { DataContext } from "../domain/data-context.js";
import type { Request } from "express";

/**
 * Create a DataContext for domain operations with RLS support
 * 
 * Creates a lazy database connection that initializes on first use.
 * - If orgId is provided (from x-org-id header), creates RLS-enabled connection
 * - If no orgId (ROOT context), creates unrestricted connection
 */
export function createContext(req?: Request): DataContext {
  // Extract orgId from request
  // Priority: x-org-id header > auth.orgId > undefined (ROOT)
  const orgId = req?.headers["x-org-id"] as string | undefined || 
                req?.auth?.orgId;

  return {
    db: createLazyDb(orgId),
    orgId,
    // Future: could add more request context
    // user: req?.auth,
    // requestId: req?.id,
    // features: getFeatureFlags(orgId),
  };
}
