import { Request, Response } from "express";
import { createLogger } from "@codespin/foreman-logger";
import { createContext } from "../create-context.js";
import { getRun } from "../../domain/run/get-run.js";

const logger = createLogger("foreman:handlers:runs:get");

/**
 * GET /api/v1/runs/:id - Get a run by ID
 */
export async function getRunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const ctx = createContext(req);
    const result = await getRun(ctx, req.params.id!);

    if (!result.success) {
      res.status(404).json({ error: result.error.message });
      return;
    }

    res.json(result.data);
  } catch (error) {
    logger.error("Failed to get run", { error, id: req.params.id });
    res.status(500).json({ error: "Internal server error" });
  }
}
