import { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@codespin/foreman-logger";
import { createContext } from "../create-context.js";
import { listRuns } from "../../domain/run/list-runs.js";

const logger = createLogger("foreman:handlers:runs:list");

// Validation schema
export const listRunsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.string().optional(),
  sortBy: z
    .enum(["created_at", "started_at", "completed_at"])
    .default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GET /api/v1/runs - List runs
 */
export async function listRunsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const params = listRunsSchema.parse(req.query);
    const ctx = createContext(req);

    const result = await listRuns(ctx, req.auth!.orgId, params);

    if (!result.success) {
      res.status(400).json({ error: result.error.message });
      return;
    }

    res.json({
      data: result.data.data,
      pagination: {
        total: result.data.total,
        limit: result.data.limit,
        offset: result.data.offset,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
      return;
    }
    logger.error("Failed to list runs", { error });
    res.status(500).json({ error: "Internal server error" });
  }
}
