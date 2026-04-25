import {
  Router,
  type Router as ExpressRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import { prisma } from "@recur/db";
import { env } from "@recur/config";
import { createLogger } from "@recur/logger";
import { wrap, AppError } from "../../middleware/errors.js";
import { ok, fail } from "../../middleware/response.js";
import { ErrorCode } from "../../errors.js";
import { dispatchWebhook } from "../../services/webhook-dispatcher.js";

const logger = createLogger("keeper-api");
const router: ExpressRouter = Router();

function verifyKeeperSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = req.headers["x-keeper-secret"];
  if (!secret || secret !== env.KEEPER_SECRET) {
    fail(res, ErrorCode.UNAUTHORIZED, "Unauthorized");
    return;
  }
  next();
}

router.use(verifyKeeperSecret);

// ---------------------------------------------------------------------------
// POST /keeper/payment — successful payment
// ---------------------------------------------------------------------------

const PaymentEventBody = z.object({
  subscriptionPda: z.string().min(32),
  txSignature: z.string().min(32),
  amountGross: z.string().regex(/^\d+$/),
  platformFee: z.string().regex(/^\d+$/),
  amountNet: z.string().regex(/^\d+$/),
  fromWallet: z.string().min(32).optional(),
  toWallet: z.string().min(32).optional(),
  confirmedAt: z.string().datetime(),
});

router.post(
  "/payment",
  wrap(async (req, res) => {
    const body = PaymentEventBody.parse(req.body);

    const subscription = await prisma.subscription.findUnique({
      where: { subscriptionPda: body.subscriptionPda },
      include: { plan: true },
    });
    if (!subscription)
      throw new AppError(
        ErrorCode.SUBSCRIPTION_NOT_FOUND,
        `Subscription not found for PDA ${body.subscriptionPda}`,
      );

    // Compute next payment due
    const confirmedDate = new Date(body.confirmedAt);
    const nextPaymentDue = new Date(
      confirmedDate.getTime() + subscription.plan.intervalSeconds * 1000,
    );

    const tx = await prisma.merchantTransaction.upsert({
      where: { txSignature: body.txSignature },
      update: {},
      create: {
        subscriptionId: subscription.id,
        txSignature: body.txSignature,
        amountGross: BigInt(body.amountGross),
        platformFee: BigInt(body.platformFee),
        amountNet: BigInt(body.amountNet),
        fromWallet: body.fromWallet,
        toWallet: body.toWallet,
        status: "success",
      },
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        lastPaymentAt: confirmedDate,
        nextPaymentDue,
        status: "active",
        cancelRequestedAt: null,
      },
    });

    // Write audit event
    await prisma.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        eventType: "payment_success",
        txSignature: body.txSignature,
        metadata: {
          amountGross: body.amountGross,
          platformFee: body.platformFee,
          amountNet: body.amountNet,
        },
      },
    });

    logger.info(
      {
        pda: body.subscriptionPda,
        tx: body.txSignature,
        gross: body.amountGross,
        fee: body.platformFee,
        net: body.amountNet,
      },
      "Payment recorded",
    );

    void dispatchWebhook(subscription.plan.appId, "payment_success", {
      subscriptionId: subscription.id,
      subscriptionPda: body.subscriptionPda,
      txSignature: body.txSignature,
      amountGross: body.amountGross,
      platformFee: body.platformFee,
      amountNet: body.amountNet,
      fromWallet: body.fromWallet ?? null,
      toWallet: body.toWallet ?? null,
      confirmedAt: body.confirmedAt,
    }).catch((err) => logger.error({ err }, "Webhook dispatch failed for payment_success"));

    ok(res, { id: tx.id }, 201);
  }),
);

// ---------------------------------------------------------------------------
// POST /keeper/payment-failed
// ---------------------------------------------------------------------------

const PaymentFailedBody = z.object({
  subscriptionPda: z.string().min(32),
  txSignature: z.string().min(32),
  amountGross: z.string().regex(/^\d+$/),
  platformFee: z.string().regex(/^\d+$/),
  amountNet: z.string().regex(/^\d+$/),
});

router.post(
  "/payment-failed",
  wrap(async (req, res) => {
    const body = PaymentFailedBody.parse(req.body);

    const subscription = await prisma.subscription.findUnique({
      where: { subscriptionPda: body.subscriptionPda },
      include: { plan: true },
    });
    if (!subscription)
      throw new AppError(
        ErrorCode.SUBSCRIPTION_NOT_FOUND,
        `Subscription not found for PDA ${body.subscriptionPda}`,
      );

    const tx = await prisma.merchantTransaction.upsert({
      where: { txSignature: body.txSignature },
      update: {},
      create: {
        subscriptionId: subscription.id,
        txSignature: body.txSignature,
        amountGross: BigInt(body.amountGross),
        platformFee: BigInt(body.platformFee),
        amountNet: BigInt(body.amountNet),
        status: "failed",
      },
    });

    // Mark subscription as past_due on payment failure
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "past_due" },
    });

    // Write audit event
    await prisma.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        eventType: "payment_failed",
        txSignature: body.txSignature,
        metadata: {
          amountGross: body.amountGross,
          error: "Payment transaction failed",
        },
      },
    });

    logger.warn({ pda: body.subscriptionPda, tx: body.txSignature }, "Payment FAILED recorded");

    void dispatchWebhook(subscription.plan.appId, "payment_failed", {
      subscriptionId: subscription.id,
      subscriptionPda: body.subscriptionPda,
      txSignature: body.txSignature,
      amountGross: body.amountGross,
    }).catch((err) => logger.error({ err }, "Webhook dispatch failed for payment_failed"));

    ok(res, { id: tx.id }, 201);
  }),
);

// ---------------------------------------------------------------------------
// POST /keeper/cancel
// ---------------------------------------------------------------------------

const CancelEventBody = z.object({
  subscriptionPda: z.string().min(32),
  cancelType: z.enum(["request", "force", "finalize"]),
  confirmedAt: z.string().datetime(),
});

router.post(
  "/cancel",
  wrap(async (req, res) => {
    const body = CancelEventBody.parse(req.body);

    const subscription = await prisma.subscription.findUnique({
      where: { subscriptionPda: body.subscriptionPda },
      include: { plan: true },
    });
    if (!subscription)
      throw new AppError(
        ErrorCode.SUBSCRIPTION_NOT_FOUND,
        `Subscription not found for PDA ${body.subscriptionPda}`,
      );

    const isFinalized =
      body.cancelType === "finalize" || body.cancelType === "force";

    const updateData: Record<string, unknown> = {};
    if (body.cancelType === "request") {
      updateData["cancelRequestedAt"] = new Date(body.confirmedAt);
    }
    if (isFinalized) {
      updateData["status"] = "cancelled";
      updateData["cancelledAt"] = new Date(body.confirmedAt);
      updateData["nextPaymentDue"] = null;
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: updateData,
    });

    // Map cancel type to event type
    const eventTypeMap = {
      request: "cancel_requested" as const,
      finalize: "cancel_finalized" as const,
      force: "cancel_forced" as const,
    };

    await prisma.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        eventType: eventTypeMap[body.cancelType],
        metadata: { cancelType: body.cancelType },
      },
    });

    logger.info(
      { pda: body.subscriptionPda, type: body.cancelType, status: isFinalized ? "cancelled" : "active" },
      "Cancel event recorded",
    );

    void dispatchWebhook(subscription.plan.appId, eventTypeMap[body.cancelType], {
      subscriptionId: subscription.id,
      subscriptionPda: body.subscriptionPda,
      cancelType: body.cancelType,
      confirmedAt: body.confirmedAt,
    }).catch((err) => logger.error({ err }, "Webhook dispatch failed for cancel event"));

    ok(res, { ok: true });
  }),
);

// ---------------------------------------------------------------------------
// POST /keeper/subscription — new subscription discovered
// ---------------------------------------------------------------------------

const SubscriptionCreatedBody = z.object({
  subscriptionPda: z.string().min(32),
  planId: z.string().cuid(),
  subscriberWallet: z.string().min(32),
  confirmedAt: z.string().datetime(),
});

router.post(
  "/subscription",
  wrap(async (req, res) => {
    const body = SubscriptionCreatedBody.parse(req.body);

    const subscriber = await prisma.subscriber.upsert({
      where: { walletAddress: body.subscriberWallet },
      update: {},
      create: { walletAddress: body.subscriberWallet },
    });

    const plan = await prisma.plan.findUnique({ where: { id: body.planId } });
    if (!plan) throw new AppError(ErrorCode.PLAN_NOT_FOUND, "Plan not found");

    const confirmedDate = new Date(body.confirmedAt);
    const nextPaymentDue = new Date(
      confirmedDate.getTime() + plan.intervalSeconds * 1000,
    );

    const subscription = await prisma.subscription.upsert({
      where: { subscriptionPda: body.subscriptionPda },
      update: { status: "active" },
      create: {
        subscriptionPda: body.subscriptionPda,
        planId: body.planId,
        subscriberId: subscriber.id,
        status: "active",
        nextPaymentDue,
        createdAt: confirmedDate,
      },
    });

    // Write audit event
    await prisma.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        eventType: "subscription_created",
        metadata: { subscriberWallet: body.subscriberWallet, planId: body.planId },
      },
    });

    void dispatchWebhook(plan.appId, "subscription_created", {
      subscriptionId: subscription.id,
      subscriptionPda: body.subscriptionPda,
      planId: body.planId,
      subscriberWallet: body.subscriberWallet,
      confirmedAt: body.confirmedAt,
    }).catch((err) => logger.error({ err }, "Webhook dispatch failed for subscription_created"));

    ok(res, { id: subscription.id }, 201);
  }),
);

export default router;
