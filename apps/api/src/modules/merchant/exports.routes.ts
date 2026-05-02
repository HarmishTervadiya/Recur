import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { prisma } from "@recur/db";
import { stringify } from "csv-stringify";
import { authenticate, requireMerchant } from "../../middleware/auth.js";
import { requireProTier } from "../../middleware/tier.js";
import { wrap, AppError } from "../../middleware/errors.js";
import { fail } from "../../middleware/response.js";
import { ErrorCode } from "../../errors.js";

const router: ExpressRouter = Router();

router.use(authenticate, requireMerchant);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DateRangeQuery = z.object({
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
});

const FREE_TIER_MAX_DAYS = 30;

async function getMerchantId(walletAddress: string): Promise<string> {
  const merchant = await prisma.merchant.findUnique({
    where: { walletAddress },
    select: { id: true },
  });
  if (!merchant) {
    throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, "Merchant not found");
  }
  return merchant.id;
}

async function getMerchantTier(
  walletAddress: string,
): Promise<{ id: string; tier: string }> {
  const merchant = await prisma.merchant.findUnique({
    where: { walletAddress },
    select: { id: true, tier: true, subscriptionStatus: true, gracePeriodExpiresAt: true },
  });
  if (!merchant) {
    throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, "Merchant not found");
  }

  // Check if Pro access is valid
  const isPro =
    merchant.tier === "pro" &&
    (merchant.subscriptionStatus === "active" ||
      (merchant.subscriptionStatus === "past_due" &&
        merchant.gracePeriodExpiresAt &&
        merchant.gracePeriodExpiresAt > new Date()));

  return { id: merchant.id, tier: isPro ? "pro" : "free" };
}

function enforceDateRange(
  tier: string,
  since: Date | undefined,
  until: Date | undefined,
): { sinceDate: Date; untilDate: Date } {
  const untilDate = until ?? new Date();
  const thirtyDaysAgo = new Date(
    Date.now() - FREE_TIER_MAX_DAYS * 24 * 60 * 60 * 1000,
  );

  let sinceDate = since ?? thirtyDaysAgo;

  // Free tier: enforce 30-day max
  if (tier === "free" && sinceDate < thirtyDaysAgo) {
    sinceDate = thirtyDaysAgo;
  }

  return { sinceDate, untilDate };
}

function setCSVHeaders(
  res: import("express").Response,
  filename: string,
): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
}

// ---------------------------------------------------------------------------
// GET /merchant/exports/transactions.csv
// ---------------------------------------------------------------------------

router.get(
  "/transactions.csv",
  wrap(async (req, res) => {
    const query = DateRangeQuery.parse(req.query);
    const { id: merchantId, tier } = await getMerchantTier(
      req.user!.walletAddress,
    );

    const since = query.since ? new Date(query.since) : undefined;
    const until = query.until ? new Date(query.until) : undefined;

    // If free tier user tries to request data older than 30 days, return 402
    if (tier === "free" && since) {
      const thirtyDaysAgo = new Date(
        Date.now() - FREE_TIER_MAX_DAYS * 24 * 60 * 60 * 1000,
      );
      if (since < thirtyDaysAgo) {
        fail(
          res,
          ErrorCode.PRO_REQUIRED,
          "Free tier limited to last 30 days. Upgrade to Pro for full history.",
          { upgradePath: "/dashboard/settings#recur-pro" },
        );
        return;
      }
    }

    const { sinceDate, untilDate } = enforceDateRange(tier, since, until);

    const dateStr = new Date().toISOString().slice(0, 10);
    setCSVHeaders(res, `recur-transactions-${dateStr}.csv`);

    // Get all merchant app IDs
    const apps = await prisma.app.findMany({
      where: { merchantId },
      select: { id: true },
    });
    const appIds = apps.map((a) => a.id);

    const stringifier = stringify({
      header: true,
      columns: [
        "id",
        "created",
        "amount_gross",
        "platform_fee",
        "amount_net",
        "currency",
        "subscription_id",
        "subscriber_wallet",
        "merchant_wallet",
        "tx_signature",
        "status",
      ],
    });

    stringifier.pipe(res);

    const BATCH_SIZE = 500;
    let cursor: string | undefined;

    while (true) {
      const transactions = await prisma.merchantTransaction.findMany({
        where: {
          subscription: { plan: { appId: { in: appIds } } },
          createdAt: { gte: sinceDate, lte: untilDate },
        },
        orderBy: { createdAt: "desc" },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          subscription: {
            include: {
              plan: true,
              subscriber: { select: { walletAddress: true } },
            },
          },
        },
      });

      if (transactions.length === 0) break;

      for (const tx of transactions) {
        stringifier.write([
          tx.id,
          tx.createdAt.toISOString(),
          tx.amountGross.toString(),
          tx.platformFee.toString(),
          tx.amountNet.toString(),
          tx.subscription.plan.currency,
          tx.subscriptionId,
          tx.subscription.subscriber.walletAddress,
          tx.toWallet ?? "",
          tx.txSignature,
          tx.status,
        ]);
      }

      cursor = transactions[transactions.length - 1]!.id;
      if (transactions.length < BATCH_SIZE) break;
    }

    stringifier.end();
  }),
);

// ---------------------------------------------------------------------------
// GET /merchant/exports/subscriptions.csv
// ---------------------------------------------------------------------------

router.get(
  "/subscriptions.csv",
  wrap(async (req, res) => {
    const query = DateRangeQuery.parse(req.query);
    const { id: merchantId, tier } = await getMerchantTier(
      req.user!.walletAddress,
    );

    const since = query.since ? new Date(query.since) : undefined;
    const until = query.until ? new Date(query.until) : undefined;

    if (tier === "free" && since) {
      const thirtyDaysAgo = new Date(
        Date.now() - FREE_TIER_MAX_DAYS * 24 * 60 * 60 * 1000,
      );
      if (since < thirtyDaysAgo) {
        fail(
          res,
          ErrorCode.PRO_REQUIRED,
          "Free tier limited to last 30 days. Upgrade to Pro for full history.",
          { upgradePath: "/dashboard/settings#recur-pro" },
        );
        return;
      }
    }

    const { sinceDate, untilDate } = enforceDateRange(tier, since, until);

    const dateStr = new Date().toISOString().slice(0, 10);
    setCSVHeaders(res, `recur-subscriptions-${dateStr}.csv`);

    const apps = await prisma.app.findMany({
      where: { merchantId },
      select: { id: true },
    });
    const appIds = apps.map((a) => a.id);

    const stringifier = stringify({
      header: true,
      columns: [
        "id",
        "created",
        "plan_id",
        "plan_name",
        "subscriber_wallet",
        "status",
        "next_payment_due",
        "last_payment_at",
        "cancelled_at",
      ],
    });

    stringifier.pipe(res);

    const BATCH_SIZE = 500;
    let cursor: string | undefined;

    while (true) {
      const subscriptions = await prisma.subscription.findMany({
        where: {
          plan: { appId: { in: appIds } },
          createdAt: { gte: sinceDate, lte: untilDate },
        },
        orderBy: { createdAt: "desc" },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          plan: { select: { id: true, name: true } },
          subscriber: { select: { walletAddress: true } },
        },
      });

      if (subscriptions.length === 0) break;

      for (const sub of subscriptions) {
        stringifier.write([
          sub.id,
          sub.createdAt.toISOString(),
          sub.plan.id,
          sub.plan.name,
          sub.subscriber.walletAddress,
          sub.status,
          sub.nextPaymentDue?.toISOString() ?? "",
          sub.lastPaymentAt?.toISOString() ?? "",
          sub.cancelledAt?.toISOString() ?? "",
        ]);
      }

      cursor = subscriptions[subscriptions.length - 1]!.id;
      if (subscriptions.length < BATCH_SIZE) break;
    }

    stringifier.end();
  }),
);

// ---------------------------------------------------------------------------
// GET /merchant/exports/subscribers.csv  (Pro only — full history)
// ---------------------------------------------------------------------------

router.get(
  "/subscribers.csv",
  requireProTier,
  wrap(async (req, res) => {
    const merchantId = await getMerchantId(req.user!.walletAddress);

    const dateStr = new Date().toISOString().slice(0, 10);
    setCSVHeaders(res, `recur-subscribers-${dateStr}.csv`);

    const apps = await prisma.app.findMany({
      where: { merchantId },
      select: { id: true },
    });
    const appIds = apps.map((a) => a.id);

    const stringifier = stringify({
      header: true,
      columns: [
        "wallet_address",
        "name",
        "email",
        "first_subscribed_at",
        "total_subscriptions",
        "total_paid_base_units",
        "current_status",
      ],
    });

    stringifier.pipe(res);

    // Get all subscribers who have subscriptions to this merchant's plans
    const BATCH_SIZE = 500;
    let cursor: string | undefined;

    while (true) {
      const subscribers = await prisma.subscriber.findMany({
        where: {
          subscriptions: { some: { plan: { appId: { in: appIds } } } },
        },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          subscriptions: {
            where: { plan: { appId: { in: appIds } } },
            include: {
              transactions: {
                select: { amountGross: true },
              },
            },
          },
        },
      });

      if (subscribers.length === 0) break;

      for (const sub of subscribers) {
        const totalSubscriptions = sub.subscriptions.length;
        const totalPaid = sub.subscriptions.reduce(
          (sum, s) =>
            sum +
            s.transactions.reduce(
              (txSum, tx) => txSum + tx.amountGross,
              BigInt(0),
            ),
          BigInt(0),
        );

        // First subscription date
        const firstSubscribedAt = sub.subscriptions.reduce(
          (earliest: Date | null, s) =>
            !earliest || s.createdAt < earliest ? s.createdAt : earliest,
          null as Date | null,
        );

        // Current status: most recent subscription's status
        const latestSub = sub.subscriptions.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        )[0];

        stringifier.write([
          sub.walletAddress,
          sub.name ?? "",
          sub.email ?? "",
          firstSubscribedAt?.toISOString() ?? "",
          totalSubscriptions.toString(),
          totalPaid.toString(),
          latestSub?.status ?? "unknown",
        ]);
      }

      cursor = subscribers[subscribers.length - 1]!.id;
      if (subscribers.length < BATCH_SIZE) break;
    }

    stringifier.end();
  }),
);

export default router;
