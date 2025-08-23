import { Router } from "express";
import { authenticate } from "../middleware/auth-simple.js";
import { createTaskHandler } from "../handlers/tasks/create-task.js";
import { getTaskHandler } from "../handlers/tasks/get-task.js";
import { updateTaskHandler } from "../handlers/tasks/update-task.js";
import { listTasksHandler } from "../handlers/tasks/list-tasks.js";

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * POST /api/v1/tasks - Create a new task
 */
router.post("/", createTaskHandler);

/**
 * GET /api/v1/tasks/:id - Get a task by ID
 */
router.get("/:id", getTaskHandler);

/**
 * PATCH /api/v1/tasks/:id - Update a task
 */
router.patch("/:id", updateTaskHandler);

/**
 * GET /api/v1/tasks - List tasks
 */
router.get("/", listTasksHandler);

export { router as tasksRouter };
