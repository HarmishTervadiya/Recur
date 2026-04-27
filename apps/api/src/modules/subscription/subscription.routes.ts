import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { prisma } from "@recur/db";
import { authenticate, requireSubscriber } from "../../middleware/auth.js";
import { wrap, AppError } from "../../middleware/errors.js";
import { ok, okPaginated, parsePagination } from "../../middleware/response.js";
import { ErrorCode } from "../../errors.js";
import { dispatchWebhook } from "../../services/webhook-dispatcher.js";
import { createLogger } from "@recur/logger";

const logger = createLogger("subscriber-api");

const router: ExpressRouter = Router();

router.use(authenticate, requireSubscriber);

// ---------------------------------------------------------------------------
// Subscriber profile
// ---------------------------------------------------------------------------

router.get(
  "/me",
  wrap(async (req, res) => {
    const subscriber = await prisma.subscriber.findUnique({
      where: { walletAddress: req.user!.walletAddress },
    });
    if (!subscriber)
      throw new AppError(
        ErrorCode.SUBSCRIBER_NOT_FOUND,
        "Subscriber not found",
      );
    ok(res, subscriber);
  }),
);

const UpdateSubscriberBody = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
});

router.patch(
  "/me",
  wrap(async (req, res) => {
    const data = UpdateSubscriberBody.parse(req.body);
    const subscriber = await prisma.subscriber.update({
      where: { walletAddress: req.user!.walletAddress },
      data,
    });
    ok(res, subscriber);
  }),
);

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

router.get(
  "/subscriptions",
  wrap(async (req, res) => {
    const subscriber = await getSubscriber(req.user!.walletAddress);
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const statusFilter = req.query["status"] as string | undefined;

    const where: Record<string, unknown> = { subscriberId: subscriber.id };
    if (statusFilter) where["status"] = statusFilter;

    const [subs, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          plan: { include: { app: { include: { merchant: true } } } },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    okPaginated(
      res,
      subs,
      { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
    );
  }),
);

router.get(
  "/subscriptions/:subId",
  wrap(async (req, res) => {
    const subscriber = await getSubscriber(req.user!.walletAddress);
    const sub = await prisma.subscription.findFirst({
      where: { id: req.params["subId"], subscriberId: subscriber.id },
      include: {
        plan: { include: { app: { include: { merchant: true } } } },
        transactions: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!sub)
      throw new AppError(
        ErrorCode.SUBSCRIPTION_NOT_FOUND,
        "Subscription not found",
      );
    ok(res, sub);
  }),
);

const RegisterSubscriptionBody = z.object({
  appId: z.string().min(1),
  planId: z.string().cuid(),
  subscriptionPda: z.string().min(32),
});

router.post(
  "/subscriptions",
  wrap(async (req, res) => {
    const { appId, planId, subscriptionPda } = RegisterSubscriptionBody.parse(
      req.body,
    );
    const subscriber = await getSubscriber(req.user!.walletAddress);

    const plan = await prisma.plan.findFirst({
      where: { id: planId, appId },
      include: { app: true },
    });
    if (!plan) throw new AppError(ErrorCode.PLAN_NOT_FOUND, "Plan not found");
    if (!plan.app.isActive)
      throw new AppError(ErrorCode.APP_NOT_FOUND, "App not found");
    if (!plan.isActive)
      throw new AppError(ErrorCode.PLAN_INACTIVE, "Plan is not active");

    // Compute first payment due date
    const nextPaymentDue = new Date(
      Date.now() + plan.intervalSeconds * 1000,
    );

    const sub = await prisma.subscription.upsert({
      where: { subscriptionPda },
      create: {
        planId,
        subscriberId: subscriber.id,
        subscriptionPda,
        status: "active",
        nextPaymentDue,
      },
      update: {
        planId,
        subscriberId: subscriber.id,
        status: "active",
        nextPaymentDue,
        lastPaymentAt: null,
        cancelRequestedAt: null,
        cancelledAt: null,
      },
      include: { plan: true },
    });
    ok(res, sub, 201);
  }),
);

router.get(
  "/subscriptions/:subId/transactions",
  wrap(async (req, res) => {
    const subscriber = await getSubscriber(req.user!.walletAddress);
    const sub = await prisma.subscription.findFirst({
      where: { id: req.params["subId"], subscriberId: subscriber.id },
    });
    if (!sub)
      throw new AppError(
        ErrorCode.SUBSCRIPTION_NOT_FOUND,
        "Subscription not found",
      );

    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);

    const [transactions, total] = await Promise.all([
      prisma.merchantTransaction.findMany({
        where: { subscriptionId: sub.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.merchantTransaction.count({
        where: { subscriptionId: sub.id },
      }),
    ]);

    okPaginated(
      res,
      transactions,
      { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
    );
  }),
);

// ---------------------------------------------------------------------------
// POST /subscriber/subscriptions/:subId/cancel
//
// Subscriber-initiated instant cancel. Called by the merchant dApp AFTER the
// on-chain `subscriber_cancel` instruction has confirmed and the PDA is
// closed. Sets status=cancelled and dispatches the cancel_finalized webhook.
//
// The keeper's forceCancel job is the backup detector if this call fails.
// ---------------------------------------------------------------------------

const SubscriberCancelBody = z.object({
  txSignature: z.string().min(64).max(128).optional(),
});

router.post(
  "/subscriptions/:subId/cancel",
  wrap(async (req, res) => {
    const { txSignature } = SubscriberCancelBody.parse(req.body ?? {});
    const subscriber = await getSubscriber(req.user!.walletAddress);

    const sub = await prisma.subscription.findFirst({
      where: { id: req.params["subId"], subscriberId: subscriber.id },
      include: { plan: true },
    });
    if (!sub)
      throw new AppError(
        ErrorCode.SUBSCRIPTION_NOT_FOUND,
        "Subscription not found",
      );

    // Idempotent: if already cancelled, just return current state
    if (sub.status === "cancelled") {
      ok(res, sub);
      return;
    }

    const now = new Date();
    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "cancelled",
        cancelledAt: now,
        cancelRequestedAt: sub.cancelRequestedAt ?? now,
        nextPaymentDue: null,
      },
      include: { plan: true },
    });

    await prisma.subscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        eventType: "cancel_finalized",
        metadata: { source: "subscriber", txSignature: txSignature ?? null },
      },
    });

    logger.info(
      { subId: sub.id, pda: sub.subscriptionPda, txSignature },
      "Subscriber-initiated cancel confirmed",
    );

    void dispatchWebhook(sub.plan.appId, "cancel_finalized", {
      subscriptionId: sub.id,
      subscriptionPda: sub.subscriptionPda,
      cancelType: "subscriber",
      confirmedAt: now.toISOString(),
      txSignature: txSignature ?? null,
    }).catch((err) =>
      logger.error({ err }, "Webhook dispatch failed for subscriber cancel"),
    );

    ok(res, updated);
  }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSubscriber(walletAddress: string) {
  const s = await prisma.subscriber.findUnique({ where: { walletAddress } });
  if (!s)
    throw new AppError(ErrorCode.SUBSCRIBER_NOT_FOUND, "Subscriber not found");
  return s;
}

export default router;
