import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { prisma } from "@recur/db";
import { authenticate, requireSubscriber } from "../../middleware/auth.js";
import { wrap, ApiError } from "../../middleware/errors.js";

const router: ExpressRouter = Router();

router.use(authenticate, requireSubscriber);

// ---------------------------------------------------------------------------
// GET /subscriber/me
// ---------------------------------------------------------------------------
router.get(
  "/me",
  wrap(async (req, res) => {
    const subscriber = await prisma.subscriber.findUnique({
      where: { walletAddress: req.user!.walletAddress },
    });
    if (!subscriber) throw new ApiError(404, "Subscriber not found");
    res.json(subscriber);
  }),
);

// ---------------------------------------------------------------------------
// GET /subscriber/subscriptions — list all subscriptions for this subscriber
// ---------------------------------------------------------------------------
router.get(
  "/subscriptions",
  wrap(async (req, res) => {
    const subscriber = await getSubscriber(req.user!.walletAddress);
    const subs = await prisma.subscription.findMany({
      where: { subscriberId: subscriber.id },
      orderBy: { createdAt: "desc" },
      include: {
        plan: {
          include: { app: { include: { merchant: true } } },
        },
      },
    });
    res.json(subs.map(serializeSubscription));
  }),
);

// ---------------------------------------------------------------------------
// GET /subscriber/subscriptions/:subId — single subscription detail
// ---------------------------------------------------------------------------
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
    if (!sub) throw new ApiError(404, "Subscription not found");
    res.json(serializeSubscription(sub));
  }),
);

// ---------------------------------------------------------------------------
// POST /subscriber/subscriptions — register a new subscription (DB only;
// the on-chain transaction must already be confirmed before calling this).
// ---------------------------------------------------------------------------
const RegisterSubscriptionBody = z.object({
  planId: z.string().cuid(),
  subscriptionPda: z.string().min(32),
});

router.post(
  "/subscriptions",
  wrap(async (req, res) => {
    const { planId, subscriptionPda } = RegisterSubscriptionBody.parse(
      req.body,
    );
    const subscriber = await getSubscriber(req.user!.walletAddress);

    // Verify plan exists and is active.
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new ApiError(404, "Plan not found");
    if (!plan.isActive) throw new ApiError(400, "Plan is not active");

    const sub = await prisma.subscription.create({
      data: {
        planId,
        subscriberId: subscriber.id,
        subscriptionPda,
      },
      include: { plan: true },
    });
    res.status(201).json(serializeSubscription(sub));
  }),
);

// ---------------------------------------------------------------------------
// GET /subscriber/subscriptions/:subId/transactions
// ---------------------------------------------------------------------------
router.get(
  "/subscriptions/:subId/transactions",
  wrap(async (req, res) => {
    const subscriber = await getSubscriber(req.user!.walletAddress);
    const sub = await prisma.subscription.findFirst({
      where: { id: req.params["subId"], subscriberId: subscriber.id },
    });
    if (!sub) throw new ApiError(404, "Subscription not found");

    const page = Math.max(1, Number(req.query["page"] ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"] ?? 20)));

    const transactions = await prisma.merchantTransaction.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    res.json(transactions.map(serializeTx));
  }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSubscriber(walletAddress: string) {
  const s = await prisma.subscriber.findUnique({ where: { walletAddress } });
  if (!s) throw new ApiError(404, "Subscriber not found");
  return s;
}

function serializeSubscription(sub: Record<string, unknown>) {
  const plan = sub["plan"] as Record<string, unknown> | undefined;
  return {
    ...sub,
    ...(plan
      ? {
          plan: {
            ...plan,
            amountBaseUnits: plan["amountBaseUnits"]?.toString(),
          },
        }
      : {}),
    transactions: Array.isArray(sub["transactions"])
      ? (sub["transactions"] as Array<Record<string, unknown>>).map(serializeTx)
      : undefined,
  };
}

function serializeTx(tx: Record<string, unknown>) {
  return {
    ...tx,
    amountGross: tx["amountGross"]?.toString(),
    platformFee: tx["platformFee"]?.toString(),
    amountNet: tx["amountNet"]?.toString(),
  };
}

export default router;
