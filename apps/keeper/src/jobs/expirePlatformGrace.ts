/**
 * Grace period expiry job.
 *
 * Finds merchants whose Pro subscription is past_due and grace period has
 * expired, then downgrades them to the free tier.
 *
 * Scheduled every 6 hours in the keeper. Idempotent — safe to re-run.
 */

import { prisma } from "@recur/db";
import { createLogger } from "@recur/logger";

const logger = createLogger("grace-expiry");

export async function expirePlatformGrace(): Promise<void> {
  const now = new Date();

  const expired = await prisma.merchant.findMany({
    where: {
      subscriptionStatus: "past_due",
      gracePeriodExpiresAt: { lte: now },
    },
    select: {
      id: true,
      walletAddress: true,
      tier: true,
      platformSubscriptionId: true,
    },
  });

  if (expired.length === 0) return;

  logger.info({ count: expired.length }, "Expiring grace periods");

  for (const merchant of expired) {
    try {
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: {
          tier: "free",
          subscriptionStatus: "expired",
          gracePeriodExpiresAt: null,
        },
      });

      // Update the linked PlatformSubscription status too
      if (merchant.platformSubscriptionId) {
        await prisma.platformSubscription.update({
          where: { id: merchant.platformSubscriptionId },
          data: { status: "expired" },
        });
      }

      // Write audit event if the merchant has a linked subscription
      if (merchant.platformSubscriptionId) {
        // Find the regular Subscription row linked to this platform subscription
        const platformSub = await prisma.platformSubscription.findUnique({
          where: { id: merchant.platformSubscriptionId },
          select: { subscriptionPda: true },
        });

        if (platformSub) {
          const sub = await prisma.subscription.findUnique({
            where: { subscriptionPda: platformSub.subscriptionPda },
          });

          if (sub) {
            await prisma.subscriptionEvent.create({
              data: {
                subscriptionId: sub.id,
                eventType: "platform_pro_downgraded",
                metadata: {
                  reason: "grace_period_expired",
                  merchantId: merchant.id,
                },
              },
            });
          }
        }
      }

      logger.info(
        {
          merchantId: merchant.id,
          wallet: merchant.walletAddress,
          oldTier: merchant.tier,
          newTier: "free",
          reason: "grace_period_expired",
        },
        "Merchant downgraded — grace period expired",
      );
    } catch (err) {
      logger.error(
        { err, merchantId: merchant.id },
        "Failed to expire grace period for merchant",
      );
    }
  }
}
