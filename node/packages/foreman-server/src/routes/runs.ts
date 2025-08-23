import { Router } from "express";
import { authenticate } from "../middleware/auth-simple.js";
import { createRunHandler } from "../handlers/runs/create-run.js";
import { getRunHandler } from "../handlers/runs/get-run.js";
import { updateRunHandler } from "../handlers/runs/update-run.js";
import { listRunsHandler } from "../handlers/runs/list-runs.js";

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Route definitions
router.post("/", createRunHandler);
router.get("/:id", getRunHandler);
router.patch("/:id", updateRunHandler);
router.get("/", listRunsHandler);

export { router as runsRouter };
