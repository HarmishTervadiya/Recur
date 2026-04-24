import crypto from "crypto";
import axios from "axios";
import { prisma } from "@recur/db";
import type { EventType, WebhookPayload } from "@recur/types";

const DISPATCH_TIMEOUT_MS = 5_000;

/**
 * Build and return the HMAC-SHA256 signature header value.
 * Format: "sha256=<hex>"
 */
function signPayload(body: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${hmac}`;
}

/**
 * Fire a single delivery attempt for a given endpoint + payload.
 * Returns { success, httpStatusCode }.
 */
async function attemptDelivery(
  url: string,
  secret: string,
  payload: WebhookPayload,
): Promise<{ success: boolean; httpStatusCode: number | null }> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signPayload(body, secret);

  try {
    const res = await axios.post(url, body, {
      timeout: DISPATCH_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        "X-Recur-Signature": signature,
        "X-Recur-Timestamp": timestamp,
      },
      // Treat any HTTP response as resolved (we inspect status ourselves)
      validateStatus: () => true,
    });
    const success = res.status >= 200 && res.status < 300;
    return { success, httpStatusCode: res.status };
  } catch {
    // Network error, DNS failure, timeout, etc.
    return { success: false, httpStatusCode: null };
  }
}

/**
 * Dispatch an event to all active webhook endpoints for the given app.
 * Creates a WebhookDelivery row and fires the HTTP POST for each endpoint.
 * This function is fire-and-forget — callers should NOT await it.
 */
export async function dispatchWebhook(
  appId: string,
  eventType: EventType,
  data: Record<string, unknown>,
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      appId,
      isActive: true,
    },
  });

  if (endpoints.length === 0) return;

  const timestamp = new Date().toISOString();
  const payload: WebhookPayload = { event: eventType, timestamp, data };

  await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      // Skip if endpoint has an event filter and this event is not in it
      if (endpoint.events.length > 0 && !endpoint.events.includes(eventType)) {
        return;
      }

      // Create a delivery record before attempting
      const delivery = await prisma.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          eventType,
          payload: payload as object,
          status: "pending",
          attempts: 0,
        },
      });

      const { success, httpStatusCode } = await attemptDelivery(
        endpoint.url,
        endpoint.secret,
        payload,
      );

      const now = new Date();
      if (success) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "delivered",
            httpStatusCode,
            attempts: 1,
            lastAttemptAt: now,
          },
        });
      } else {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "failed",
            httpStatusCode,
            attempts: 1,
            lastAttemptAt: now,
            nextRetryAt: new Date(now.getTime() + 60_000), // retry in 1 minute
          },
        });
      }
    }),
  );
}
