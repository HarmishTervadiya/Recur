/**
 * Next.js (App Router or Pages API) helpers.
 *
 * App Router (recommended):
 *
 *   // app/api/webhook/route.ts
 *   import { verifyWebhookNext } from "@recur/server/next";
 *   export async function POST(req: Request) {
 *     const event = await verifyWebhookNext(req, process.env.RECUR_WEBHOOK_SECRET!);
 *     // handle event…
 *     return new Response("ok");
 *   }
 *
 * Errors throw `WebhookVerifyError`; callers can catch and return 401.
 */

import {
  verifyWebhook,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  type VerifyOptions,
} from "./core.js";
import type { WebhookPayload } from "@recur/sdk";

export async function verifyWebhookNext(
  req: Request,
  secret: string,
  options?: VerifyOptions,
): Promise<WebhookPayload> {
  const body = await req.text();
  return verifyWebhook({
    body,
    signature: req.headers.get(SIGNATURE_HEADER),
    timestamp: req.headers.get(TIMESTAMP_HEADER),
    secret,
    options,
  });
}

export { WebhookVerifyError } from "./core.js";
