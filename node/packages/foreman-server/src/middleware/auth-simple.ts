import { Request, Response, NextFunction } from "express";
import { createLogger } from "@codespin/foreman-logger";

const logger = createLogger("foreman:middleware:auth");

// Extend Express Request type
declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      orgId: string;
      apiKeyId: string;
    };
  }
}

/**
 * Simple API Key authentication middleware for full-trust environment
 *
 * Since Foreman is behind a firewall with full trust, this is a simplified
 * authentication that only validates the API key format and extracts org info.
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
        orgId: "default-org",
        apiKeyId: "no-auth",
      };
      next();
      return;
    }

    // Check for API key in x-api-key header or Authorization header
    let apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res
          .status(401)
          .json({ error: "Missing or invalid authorization header" });
        return;
      }

      apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    if (!apiKey) {
      res.status(401).json({ error: "API key required but not provided" });
      return;
    }

    // If FOREMAN_API_KEY is set, validate against it (for test environments)
    if (process.env.FOREMAN_API_KEY) {
      // In test mode, accept either the exact test key or properly formatted keys
      if (apiKey === process.env.FOREMAN_API_KEY) {
        // For test API key, use default org
        req.auth = {
          orgId: "test-org",
          apiKeyId: "test-key-id",
        };
        next();
        return;
      }
      // Continue to format validation below
    }

    // Simple validation - just check if API key matches expected format
    // Format: fmn_[env]_[orgId]_[random] (e.g., fmn_prod_org123_abc456)
    const keyParts = apiKey.split("_");

    if (keyParts.length < 4 || keyParts[0] !== "fmn") {
      res.status(401).json({ error: "Invalid API key format" });
      return;
    }

    // Extract org ID from the API key
    const orgId = keyParts[2];

    // In a full-trust environment, we just validate the format and extract org info
    // No database lookup or bcrypt verification needed
    req.auth = {
      orgId: orgId || "default-org",
      apiKeyId: apiKey.substring(0, 16), // Use first 16 chars as ID
    };

    logger.debug("API key authenticated", {
      orgId,
      ip: req.ip || req.socket.remoteAddress,
    });

    next();
  } catch (error) {
    logger.error("Authentication error", { error });
    res.status(500).json({ error: "Internal server error" });
  }
}
