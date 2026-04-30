/**
 * Raw Node `http`/`http2` helper.
 *
 *   import { createServer } from "node:http";
 *   import { verifyWebhookNode } from "@recur/server/node";
 *
 *   createServer(async (req, res) => {
 *     try {
 *       const event = await verifyWebhookNode(req, process.env.RECUR_WEBHOOK_SECRET!);
 *       res.statusCode = 200;
 *       res.end("ok");
 *     } catch (err) {
 *       res.statusCode = 401;
 *       res.end(err.message);
 *     }
 *   }).listen(3000);
 */

import type { IncomingMessage } from "node:http";
import {
  verifyWebhook,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  type VerifyOptions,
} from "./core.js";
import type { WebhookPayload } from "@recur/sdk";

export async function verifyWebhookNode(
  req: IncomingMessage,
  secret: string,
  options?: VerifyOptions,
): Promise<WebhookPayload> {
  const body = await readBody(req);
  return verifyWebhook({
    body,
    signature: header(req, SIGNATURE_HEADER),
    timestamp: header(req, TIMESTAMP_HEADER),
    secret,
    options,
  });
}

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export { WebhookVerifyError } from "./core.js";
