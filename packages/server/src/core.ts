/**
 * Framework-agnostic webhook verification helper.
 *
 * Verifies the `X-Recur-Signature` + `X-Recur-Timestamp` headers against the
 * raw request body using HMAC-SHA256 with the shared secret. Returns the
 * parsed `WebhookPayload` on success, or throws.
 *
 * All adapters (`express`, `next`, `node`) wrap this single function.
 */

import {
  verifyWebhookSignature,
  parseWebhookPayload,
  type WebhookPayload,
} from "@recur/sdk";

export const SIGNATURE_HEADER = "x-recur-signature";
export const TIMESTAMP_HEADER = "x-recur-timestamp";

export interface VerifyOptions {
  /** Max acceptable webhook age in seconds. Defaults to 300 (5 min). */
  toleranceSec?: number;
}

export class WebhookVerifyError extends Error {
  readonly code:
    | "MISSING_HEADERS"
    | "INVALID_SIGNATURE"
    | "INVALID_PAYLOAD";
  constructor(code: WebhookVerifyError["code"], message: string) {
    super(message);
    this.name = "WebhookVerifyError";
    this.code = code;
  }
}

export interface VerifyArgs {
  body: string;
  signature: string | null | undefined;
  timestamp: string | null | undefined;
  secret: string;
  options?: VerifyOptions;
}

export function verifyWebhook({
  body,
  signature,
  timestamp,
  secret,
  options,
}: VerifyArgs): WebhookPayload {
  if (!signature || !timestamp) {
    throw new WebhookVerifyError(
      "MISSING_HEADERS",
      `Missing required headers: ${SIGNATURE_HEADER} and/or ${TIMESTAMP_HEADER}`,
    );
  }

  const ok = verifyWebhookSignature(
    body,
    signature,
    timestamp,
    secret,
    options?.toleranceSec ?? 300,
  );
  if (!ok) {
    throw new WebhookVerifyError("INVALID_SIGNATURE", "Webhook signature verification failed");
  }

  const payload = parseWebhookPayload(body);
  if (!payload) {
    throw new WebhookVerifyError("INVALID_PAYLOAD", "Webhook payload is not valid JSON");
  }
  return payload;
}

/** Re-export low-level helpers for power users who need finer control. */
export { verifyWebhookSignature, parseWebhookPayload };
export type { WebhookPayload };
