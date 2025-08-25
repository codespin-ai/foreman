import type { Database } from "@codespin/foreman-db";

export type DataContext = {
  db: Database;
  orgId?: string; // Optional for ROOT context operations
  // Future extensibility for:
  // - Request context (user, request ID)
  // - Caching layer
  // - Event emitters
  // - Audit logging
  // - Feature flags
};
