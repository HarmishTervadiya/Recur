import rateLimit from "express-rate-limit";

/// Strict limiter for auth endpoints (nonce, verify, refresh).
/// 20 requests per minute per IP.
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: "RATE_LIMITED", message: "Too many requests, try again later" } },
});

/// General API limiter — 200 requests per minute per IP.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: "RATE_LIMITED", message: "Too many requests, try again later" } },
});
