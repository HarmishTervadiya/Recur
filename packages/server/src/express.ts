/**
 * Express middleware factory.
 *
 * Mount on a route that uses `express.raw({ type: 'application/json' })` so
 * the request body is a Buffer (we need the exact bytes for HMAC).
 *
 *   import { verifyWebhookExpress } from "@recur/server/express";
 *   app.post("/webhook",
 *     express.raw({ type: "application/json" }),
 *     verifyWebhookExpress(process.env.RECUR_WEBHOOK_SECRET!),
 *     (req, res) => { console.log(req.recurEvent); res.sendStatus(200); }
 *   );
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { WebhookPayload } from "@recur/sdk";
import {
  verifyWebhook,
  WebhookVerifyError,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  type VerifyOptions,
} from "./core.js";

export interface RecurRequest extends Request {
  recurEvent?: WebhookPayload;
}

export function verifyWebhookExpress(
  secret: string,
  options?: VerifyOptions,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body);

      (req as RecurRequest).recurEvent = verifyWebhook({
        body,
        signature: header(req, SIGNATURE_HEADER),
        timestamp: header(req, TIMESTAMP_HEADER),
        secret,
        options,
      });
      next();
    } catch (err) {
      if (err instanceof WebhookVerifyError) {
        res.status(401).json({ error: err.code, message: err.message });
        return;
      }
      next(err);
    }
  };
}

function header(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}
