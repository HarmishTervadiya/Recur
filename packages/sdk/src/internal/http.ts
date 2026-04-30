/**
 * Internal HTTP helpers — single source of truth for API envelope handling,
 * JWT injection, and error mapping. All `RecurClient` API methods route here.
 */

import type { ApiResponse } from "../types.js";
import { AuthError, NetworkError, mapError } from "../errors.js";

export interface HttpOptions {
  baseUrl: string;
  apiKey?: string;
  authToken?: string;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  authToken?: string;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): string {
  const url = `${baseUrl}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function request<T>(
  http: HttpOptions,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = options.authToken ?? http.apiKey;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(buildUrl(http.baseUrl, path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    return (await res.json()) as ApiResponse<T>;
  } catch (err) {
    return {
      success: false,
      data: null,
      error: { code: "NETWORK_ERROR", message: "Failed to reach Recur API", details: err },
    };
  }
}

/**
 * Unwrap an `ApiResponse<T>` to `T`, throwing a typed `RecurError` on failure.
 * Used by high-level SDK methods that return raw values instead of envelopes.
 */
export function unwrap<T>(res: ApiResponse<T>): T {
  if (res.success && res.data !== null && res.data !== undefined) return res.data;
  if (res.error?.code === "NETWORK_ERROR") {
    throw new NetworkError(res.error.message);
  }
  if (res.error?.code === "UNAUTHORIZED" || res.error?.code === "AUTH_ERROR") {
    throw new AuthError(res.error.message);
  }
  throw mapError(res.error ?? new Error("API error"), res.error?.message ?? "API request failed");
}
