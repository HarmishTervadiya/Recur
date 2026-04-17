import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthPayload } from "../types.js";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "change-me-in-production";

/** Verify JWT and attach decoded payload to req.user. */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ error: "Missing or malformed Authorization header" });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Require that the authenticated user has the merchant role. */
export function requireMerchant(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.user?.role !== "merchant") {
    res.status(403).json({ error: "Merchant access required" });
    return;
  }
  next();
}

/** Require that the authenticated user has the subscriber role. */
export function requireSubscriber(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.user?.role !== "subscriber") {
    res.status(403).json({ error: "Subscriber access required" });
    return;
  }
  next();
}
