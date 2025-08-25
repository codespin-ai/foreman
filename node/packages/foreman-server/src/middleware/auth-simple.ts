import { Request, Response, NextFunction } from "express";
import { createLogger } from "@codespin/foreman-logger";
import { getBearerAuthConfig, validateBearerToken } from "../auth/bearer.js";

const logger = createLogger("AuthMiddleware");

// Extend Express Request type
declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      apiKeyId: string;
    };
  }
}

/**
 * Simple Bearer token authentication middleware for Foreman
 *
 * This middleware validates Bearer tokens in a simple, stateless manner.
 * In a full-trust environment (behind firewall), it only validates that
 * a Bearer token is present and matches the configured token if set.
 *
 * Key differences from traditional auth:
 * - No database lookups
 * - No bcrypt verification
 * - No JWT parsing
 * - Organization context comes from x-org-id header, not from token
 *
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const config = getBearerAuthConfig();

    if (!config.enabled) {
      // Authentication is disabled, allow all requests
      req.auth = {
        apiKeyId: "no-auth",
      };
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    const result = validateBearerToken(authHeader, config);

    if (!result.success) {
      res.status(401).json({ error: result.error.message });
      return;
    }

    // Extract token for creating auth context
    const token = authHeader?.substring(7) || "";

    // Simple validation - in a full-trust environment, we just check the key exists
    // The org context comes from x-org-id header, not from the API key
    req.auth = {
      apiKeyId: token.substring(0, 16), // Use first 16 chars as ID
    };

    logger.debug("API key authenticated", {
      apiKeyId: req.auth.apiKeyId,
    });

    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
