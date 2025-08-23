import { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@codespin/foreman-logger";
import { getDb } from "@codespin/foreman-db";
import {
  queryRunData,
  type QueryRunDataParams,
} from "../../domain/run-data/query-run-data.js";

const logger = createLogger("foreman:handlers:run-data:query");

// Validation schema
export const queryRunDataSchema = z.object({
  // Key filters
  key: z.string().optional(),
  keys: z
    .string()
    .transform((val) => val.split(","))
    .optional(),
  keyStartsWith: z
    .string()
    .transform((val) => val.split(","))
    .optional(),
  keyPattern: z.string().optional(),

  // Tag filters
  tags: z
    .string()
    .transform((val) => val.split(","))
    .optional(),
  tagStartsWith: z
    .string()
    .transform((val) => val.split(","))
    .optional(),
  tagMode: z.enum(["any", "all"]).optional(),

  // Options
  includeAll: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(["created_at", "updated_at", "key"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GET /api/v1/runs/:runId/data - Query run data with flexible filtering
 */
export async function queryRunDataHandler(
  req: Request<{ runId: string }>,
  res: Response,
): Promise<void> {
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
      sortOrder: params.sortOrder,
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
        total: result.data.length, // In a real app, you'd want a separate count query
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ error: "Invalid query parameters", details: error.errors });
      return;
    }
    logger.error("Failed to query run data", {
      error,
      runId: req.params.runId,
    });
    res.status(500).json({ error: "Internal server error" });
  }
}
