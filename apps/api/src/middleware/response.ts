import type { Response } from "express";
import type { ApiSuccess, ApiFailure } from "../errors.js";
import { type ErrorCode, ERROR_HTTP_STATUS } from "../errors.js";

export function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { success: true, data, error: null };
  res.status(status).json(body);
}

export function fail(
  res: Response,
  code: ErrorCode,
  message: string,
  details?: unknown,
): void {
  const status = ERROR_HTTP_STATUS[code] ?? 500;
  const body: ApiFailure = {
    success: false,
    data: null,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
  res.status(status).json(body);
}
