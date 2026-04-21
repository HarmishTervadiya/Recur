import type { Response } from "express";
import type { ApiSuccess, ApiFailure, PaginationMeta } from "../errors.js";
import { type ErrorCode, ERROR_HTTP_STATUS } from "../errors.js";

export function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { success: true, data, error: null };
  res.status(status).json(body);
}

export function okPaginated<T>(
  res: Response,
  data: T,
  pagination: PaginationMeta,
  status = 200,
): void {
  const body: ApiSuccess<T> = { success: true, data, pagination, error: null };
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

/** Parse page/limit query params with safe defaults. */
export function parsePagination(query: Record<string, unknown>): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, Number(query["page"] ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query["limit"] ?? 20)));
  return { page, limit, skip: (page - 1) * limit };
}
