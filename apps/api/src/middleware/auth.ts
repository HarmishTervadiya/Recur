import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "@recur/config";
import type { AuthPayload } from "../types.js";
import { ErrorCode } from "../errors.js";
import { fail } from "./response.js";

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    fail(
      res,
      ErrorCode.UNAUTHORIZED,
      "Missing or malformed Authorization header",
    );
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    fail(res, ErrorCode.UNAUTHORIZED, "Invalid or expired token");
  }
}

export function requireMerchant(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.user?.role !== "merchant") {
    fail(res, ErrorCode.FORBIDDEN, "Merchant access required");
    return;
  }
  next();
}

export function requireSubscriber(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.user?.role !== "subscriber") {
    fail(res, ErrorCode.FORBIDDEN, "Subscriber access required");
    return;
  }
  next();
}
