import axios from "axios";
import { prisma } from "@recur/db";
import { createLogger } from "@recur/logger";
import type { WebhookPayload } from "@recur/types";
import { signPayload } from "./webhook-dispatcher.js";

const logger = createLogger("webhook-retry-worker");

const DISPATCH_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 30_000;

// Exponential backoff delays in milliseconds: 1m, 5m, 30m, 2h, 12h
const BACKOFF_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
];

async function retryFailedDeliveries(): Promise<void> {
  const now = new Date();

  const pending = await prisma.webhookDelivery.findMany({
    where: {
      status: "failed",
      nextRetryAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    include: { endpoint: true },
    take: 50, // process at most 50 per tick to avoid overload
  });

  if (pending.length === 0) return;

  logger.info({ count: pending.length }, "Retrying failed webhook deliveries");

  await Promise.allSettled(
    pending.map(async (delivery) => {
      const { endpoint } = delivery;

      // Endpoint may have been deleted or deactivated since delivery was created
      if (!endpoint || !endpoint.isActive) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: "abandoned" },
        });
        return;
      }

      const payload = delivery.payload as unknown as WebhookPayload;
      const body = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = signPayload(body, endpoint.secret, timestamp);

      let success = false;
      let httpStatusCode: number | null = null;

      try {
        const res = await axios.post(endpoint.url, body, {
          timeout: DISPATCH_TIMEOUT_MS,
          headers: {
            "Content-Type": "application/json",
            "X-Recur-Signature": signature,
            "X-Recur-Timestamp": timestamp,
          },
          validateStatus: () => true,
        });
        httpStatusCode = res.status;
        success = res.status >= 200 && res.status < 300;
      } catch {
        // Network error / timeout
      }

      const newAttempts = delivery.attempts + 1;
      const attemptedAt = new Date();

      if (success) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "delivered",
            httpStatusCode,
            attempts: newAttempts,
            lastAttemptAt: attemptedAt,
            nextRetryAt: null,
          },
        });
        logger.info({ deliveryId: delivery.id, attempts: newAttempts }, "Webhook delivery succeeded on retry");
      } else {
        const abandoned = newAttempts >= MAX_ATTEMPTS;
        // Use delivery.attempts (before increment) as backoff index:
        // attempt 1 failed -> backoff[1] = 5m, attempt 2 -> backoff[2] = 30m, etc.
        const backoffIndex = Math.min(delivery.attempts, BACKOFF_MS.length - 1);
        const nextRetry = abandoned
          ? null
          : new Date(attemptedAt.getTime() + BACKOFF_MS[backoffIndex]!);

        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: abandoned ? "abandoned" : "failed",
            httpStatusCode,
            attempts: newAttempts,
            lastAttemptAt: attemptedAt,
            nextRetryAt: nextRetry,
          },
        });

        if (abandoned) {
          logger.warn({ deliveryId: delivery.id, attempts: newAttempts }, "Webhook delivery abandoned after max attempts");
        } else {
          logger.warn({ deliveryId: delivery.id, attempts: newAttempts, nextRetry }, "Webhook delivery retry failed, will retry later");
        }
      }
    }),
  );
}

/**
 * Start the webhook retry worker. Polls every 30 seconds for failed
 * deliveries that are due for retry. Should be called once at API startup.
 */
export function startWebhookRetryWorker(): void {
  logger.info("Webhook retry worker started");
  // Run immediately on startup to clear any backlog
  retryFailedDeliveries().catch((err) => {
    logger.error({ err }, "Webhook retry worker initial run error");
  });
  setInterval(() => {
    retryFailedDeliveries().catch((err) => {
      logger.error({ err }, "Webhook retry worker error");
    });
  }, POLL_INTERVAL_MS);
}
