import type { Database } from "@codespin/foreman-db";

export type DataContext = {
  db: Database;
  // Future extensibility for:
  // - Request context (user, org, request ID)
  // - Caching layer
  // - Event emitters
  // - Audit logging
  // - Feature flags
};
