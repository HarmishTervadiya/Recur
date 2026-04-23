import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { createLogger } from "@recur/logger";
import { type ErrorCode, ErrorCode as EC } from "../errors.js";
import { fail } from "./response.js";

const log = createLogger("api:error");
const isDev = (process.env["NODE_ENV"] ?? "development") !== "production";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

function formatDevError(err: unknown, req: Request): void {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;

  console.log("\n" + "=".repeat(60));
  console.log(`  ERROR  ${method} ${url}`);
  console.log("  " + timestamp);
  console.log("=".repeat(60));

  if (err instanceof ZodError) {
    console.log(`  Type:    Validation Error (${err.issues.length} issue(s))`);
    for (const issue of err.issues) {
      console.log(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
  } else if (err instanceof AppError) {
    console.log(`  Type:    AppError`);
    console.log(`  Code:    ${err.code}`);
    console.log(`  Message: ${err.message}`);
  } else if (err instanceof Error) {
    console.log(`  Type:    ${err.constructor.name}`);
    console.log(`  Message: ${err.message}`);
    if (err.stack) {
      const stackLines = err.stack.split("\n").slice(1, 6);
      console.log("  Stack:");
      for (const line of stackLines) {
        console.log(`    ${line.trim()}`);
      }
    }
  } else {
    console.log(`  Error: ${String(err)}`);
  }

  console.log("=".repeat(60) + "\n");
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isDev) {
    formatDevError(err, req);
  }

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

  // Production: structured log only
  if (!isDev) {
    log.error({ err }, "Unhandled error");
  }

  fail(res, EC.INTERNAL_ERROR, "Internal server error");
}

export function wrap(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
