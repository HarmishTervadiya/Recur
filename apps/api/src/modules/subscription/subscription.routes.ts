import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { prisma } from "@recur/db";
import { authenticate, requireSubscriber } from "../../middleware/auth.js";
import { wrap, AppError } from "../../middleware/errors.js";
import { ok, okPaginated, parsePagination } from "../../middleware/response.js";
import { ErrorCode } from "../../errors.js";

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
      subs.map(serializeSubscription),
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
    ok(res, serializeSubscription(sub));
  }),
);

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

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new AppError(ErrorCode.PLAN_NOT_FOUND, "Plan not found");
    if (!plan.isActive)
      throw new AppError(ErrorCode.PLAN_INACTIVE, "Plan is not active");

    // Compute first payment due date
    const nextPaymentDue = new Date(
      Date.now() + plan.intervalSeconds * 1000,
    );

    const sub = await prisma.subscription.create({
      data: {
        planId,
        subscriberId: subscriber.id,
        subscriptionPda,
        status: "active",
        nextPaymentDue,
      },
      include: { plan: true },
    });
    ok(res, serializeSubscription(sub), 201);
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
      transactions.map(serializeTx),
      { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
    );
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
