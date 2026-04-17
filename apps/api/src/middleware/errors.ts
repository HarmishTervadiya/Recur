import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { createLogger } from "@recur/logger";
import { type ErrorCode, ErrorCode as EC } from "../errors.js";
import { fail } from "./response.js";

const log = createLogger("api:error");

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    fail(res, EC.VALIDATION_ERROR, "Validation error", details);
    return;
  }

  if (err instanceof AppError) {
    fail(res, err.code, err.message);
    return;
  }

  log.error({ err }, "Unhandled error");
  fail(res, EC.INTERNAL_ERROR, "Internal server error");
}

export function wrap(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
