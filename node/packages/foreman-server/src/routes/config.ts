import { Router } from "express";
import { authenticate } from "../middleware/auth-simple.js";
import { getConfigHandler } from "../handlers/config/get-config.js";
import { getRedisConfigHandler } from "../handlers/config/get-redis-config.js";
import { getQueuesConfigHandler } from "../handlers/config/get-queues-config.js";

const router = Router();

// Apply authentication to all config routes
router.use(authenticate);

// Route definitions
router.get("/", getConfigHandler);
router.get("/redis", getRedisConfigHandler);
router.get("/queues", getQueuesConfigHandler);

export { router as configRouter };
