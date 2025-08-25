import { Request, Response, NextFunction } from "express";
import { createLogger } from "@codespin/foreman-logger";

const logger = createLogger("foreman:middleware:auth");

// Extend Express Request type
declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      apiKeyId: string;
    };
  }
}

/**
 * Simple Bearer token authentication middleware for full-trust environment
 *
 * Since Foreman is behind a firewall with full trust, this is a simplified
 * authentication that only validates the Bearer token format and extracts org info.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Check if authentication is disabled (similar to Permiso pattern)
    const authEnabled =
      process.env.FOREMAN_API_KEY_ENABLED === "true" ||
      !!process.env.FOREMAN_API_KEY;

    if (!authEnabled) {
      // Authentication is disabled, allow all requests
      req.auth = {
        apiKeyId: "no-auth",
      };
      next();
      return;
    }

    // Check for Bearer token in Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
      return;
    }

    const bearerToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!bearerToken) {
      res.status(401).json({ error: "Bearer token required but not provided" });
      return;
    }

    // If FOREMAN_API_KEY is set, validate against it (for test environments)
    if (process.env.FOREMAN_API_KEY) {
      // In test mode, accept the exact test token
      if (bearerToken === process.env.FOREMAN_API_KEY) {
        // For test Bearer token, just validate
        req.auth = {
          apiKeyId: "test-token-id",
        };
        next();
        return;
      }
      // If token doesn't match, reject
      res.status(401).json({ error: "Invalid bearer token" });
      return;
    }

    // Simple validation - in a full-trust environment, we just check the token exists
    // No specific format required, no database lookup or bcrypt verification needed
    // The org context comes from x-org-id header, not from the Bearer token
    req.auth = {
      apiKeyId: bearerToken.substring(0, 16), // Use first 16 chars as ID
    };

    logger.debug("Bearer token authenticated", {
      apiKeyId: req.auth.apiKeyId,
      ip: req.ip || req.socket.remoteAddress,
    });

    next();
  } catch (error) {
    logger.error("Authentication error", { error });
    res.status(500).json({ error: "Internal server error" });
  }
}
