import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { config } from "dotenv";
import { createLogger } from "@codespin/foreman-logger";
import { createLazyDb } from "@codespin/foreman-db";
import { runsRouter } from "./routes/runs.js";
import { tasksRouter } from "./routes/tasks.js";
import { runDataRouter } from "./routes/run-data.js";
import { configRouter } from "./routes/config.js";

// Load environment variables
config();

const logger = createLogger("foreman-server");
const app = express();
const port = process.env.FOREMAN_SERVER_PORT || process.env.PORT || 5002;

// Initialize health check database (ROOT context)
const healthCheckDb = createLazyDb();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "*",
    credentials: true,
  }),
);

// Request parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Rate limiting (disabled in test mode)
if (process.env.NODE_ENV !== "test") {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
  });
  app.use("/api/", limiter);
}

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("Request completed", {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
    });
  });
  next();
});

// Health check (no auth required)
app.get("/health", async (_req, res) => {
  const services: Record<string, string> = {};

  // Check database connection
  try {
    await healthCheckDb.one("SELECT 1 as ok");
    services.database = "connected";
  } catch (error) {
    services.database = "disconnected";
    logger.error("Database health check failed:", error);
  }

  // Check Redis connection (if configured)
  if (process.env.REDIS_HOST) {
    // Redis check would go here if we had a Redis client imported
    // For now, we'll just indicate it's configured
    services.redis = "configured";
  }

  const isHealthy = services.database === "connected";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    services,
  });
});

// API routes
app.use("/api/v1/runs", runsRouter);
app.use("/api/v1/tasks", tasksRouter);
app.use("/api/v1/runs/:runId/data", runDataRouter);
app.use("/api/v1/config", configRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    // Handle JSON parsing errors
    if (err instanceof SyntaxError && "body" in err) {
      logger.warn("Invalid JSON in request", { error: err.message });
      res.status(400).json({ error: "Invalid JSON in request body" });
      return;
    }

    logger.error("Unhandled error", { error: err });
    res.status(500).json({ error: "Internal server error" });
  },
);

// Start server
async function start(): Promise<void> {
  try {
    // Start listening
    app.listen(port, () => {
      logger.info("Server running", { port });
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Start the server
start();
