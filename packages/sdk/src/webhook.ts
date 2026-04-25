import crypto from "crypto";
import type { WebhookPayload } from "@recur/types";

/**
 * Verify a Recur webhook signature.
 *
 * Use this in your server's webhook handler to confirm the request
 * actually came from Recur and hasn't been tampered with.
 *
 * @param body      - The raw request body string (JSON).
 * @param signature - The `X-Recur-Signature` header value (e.g. "sha256=abc123...").
 * @param timestamp - The `X-Recur-Timestamp` header value (unix seconds string).
 * @param secret    - Your webhook signing secret (from dashboard).
 * @param toleranceSec - Max age of the webhook in seconds (default 300 = 5 min).
 * @returns true if the signature is valid and the timestamp is within tolerance.
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  timestamp: string,
  secret: string,
  toleranceSec = 300,
): boolean {
  // 1. Check timestamp freshness to prevent replay attacks
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSec) return false;

  // 2. Recompute HMAC: sign "${timestamp}.${body}" with the shared secret
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  // 3. Constant-time comparison to prevent timing attacks
  const sig = signature.replace(/^sha256=/, "");

  if (sig.length !== expected.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(sig, "hex"),
    Buffer.from(expected, "hex"),
  );
}

/**
 * Parse and type-check a webhook payload body.
 * Returns the typed payload or null if parsing fails.
 */
export function parseWebhookPayload(body: string): WebhookPayload | null {
  try {
    const parsed = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.event === "string" &&
      typeof parsed.timestamp === "string" &&
      typeof parsed.data === "object"
    ) {
      return parsed as WebhookPayload;
    }
    return null;
  } catch {
    return null;
  }
}
