import { Router } from "express";
import { authenticate } from "../middleware/auth-simple.js";
import { createRunDataHandler } from "../handlers/run-data/create-run-data.js";
import { queryRunDataHandler } from "../handlers/run-data/query-run-data.js";
import { updateRunDataTagsHandler } from "../handlers/run-data/update-run-data-tags.js";
import { deleteRunDataHandler } from "../handlers/run-data/delete-run-data.js";

const router = Router({ mergeParams: true }); // To access :runId from parent route

// Apply authentication to all routes
router.use(authenticate);

/**
 * POST /api/v1/runs/:runId/data - Create run data entry
 */
router.post("/", createRunDataHandler);

/**
 * GET /api/v1/runs/:runId/data - Query run data with flexible filtering
 */
router.get("/", queryRunDataHandler);

/**
 * PATCH /api/v1/runs/:runId/data/:dataId/tags - Update tags on a run data entry
 */
router.patch("/:dataId/tags", updateRunDataTagsHandler);

/**
 * DELETE /api/v1/runs/:runId/data - Delete run data entries
 */
router.delete("/", deleteRunDataHandler);

export { router as runDataRouter };
