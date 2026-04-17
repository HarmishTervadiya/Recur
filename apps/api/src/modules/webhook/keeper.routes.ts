import {
  Router,
  type Router as ExpressRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import { prisma } from "@recur/db";
import { wrap, ApiError } from "../../middleware/errors.js";

/**
 * Keeper ingest endpoint — receives payment events from the keeper process
 * after confirming on-chain transactions, and writes/updates the DB mirror.
 *
 * Authentication: shared secret in `X-Keeper-Secret` header.
 * The keeper and API share the KEEPER_SECRET env variable.
 *
 * NOTE: These endpoints are internal and should NOT be publicly reachable in
 * production (put behind VPC or nginx allow-list).
 */

const router: ExpressRouter = Router();

function verifyKeeperSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = req.headers["x-keeper-secret"];
  const expected = process.env["KEEPER_SECRET"];
  if (!expected || secret !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use(verifyKeeperSecret);

// ---------------------------------------------------------------------------
// POST /keeper/payment
// Called by the keeper after successfully confirming a process_payment tx.
// ---------------------------------------------------------------------------
const PaymentEventBody = z.object({
  subscriptionPda: z.string().min(32),
  txSignature: z.string().min(32),
  amountGross: z.string().regex(/^\d+$/),
  platformFee: z.string().regex(/^\d+$/),
  amountNet: z.string().regex(/^\d+$/),
  confirmedAt: z.string().datetime(),
});

router.post(
  "/payment",
  wrap(async (req, res) => {
    const body = PaymentEventBody.parse(req.body);

    const subscription = await prisma.subscription.findUnique({
      where: { subscriptionPda: body.subscriptionPda },
    });
    if (!subscription)
      throw new ApiError(
        404,
        `Subscription not found for PDA ${body.subscriptionPda}`,
      );

    // Upsert the transaction (idempotent — re-delivery of same signature is safe).
    const tx = await prisma.merchantTransaction.upsert({
      where: { txSignature: body.txSignature },
      update: {},
      create: {
        subscriptionId: subscription.id,
        txSignature: body.txSignature,
        amountGross: BigInt(body.amountGross),
        platformFee: BigInt(body.platformFee),
        amountNet: BigInt(body.amountNet),
        status: "success",
      },
    });

    // Mirror on-chain state: update lastPaymentAt.
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        lastPaymentAt: new Date(body.confirmedAt),
        isActive: true,
        cancelRequestedAt: null,
      },
    });

    res.status(201).json({ id: tx.id });
  }),
);

// ---------------------------------------------------------------------------
// POST /keeper/payment-failed
// Called by the keeper when process_payment fails (e.g. insufficient balance).
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
    });
    if (!subscription)
      throw new ApiError(
        404,
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

    res.status(201).json({ id: tx.id });
  }),
);

// ---------------------------------------------------------------------------
// POST /keeper/cancel
// Called by the keeper after request_cancel or force_cancel is confirmed.
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
    });
    if (!subscription)
      throw new ApiError(
        404,
        `Subscription not found for PDA ${body.subscriptionPda}`,
      );

    const isFinalized =
      body.cancelType === "finalize" || body.cancelType === "force";

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelRequestedAt:
          body.cancelType === "request"
            ? new Date(body.confirmedAt)
            : subscription.cancelRequestedAt,
        isActive: !isFinalized,
      },
    });

    res.status(200).json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// POST /keeper/subscription
// Called by the keeper after initialize_subscription is confirmed on-chain.
// Upserts the subscription DB record (PDA is the canonical key).
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

    // Upsert subscriber.
    const subscriber = await prisma.subscriber.upsert({
      where: { walletAddress: body.subscriberWallet },
      update: {},
      create: { walletAddress: body.subscriberWallet },
    });

    // Verify plan exists.
    const plan = await prisma.plan.findUnique({ where: { id: body.planId } });
    if (!plan) throw new ApiError(404, "Plan not found");

    // Upsert subscription.
    const subscription = await prisma.subscription.upsert({
      where: { subscriptionPda: body.subscriptionPda },
      update: { isActive: true },
      create: {
        subscriptionPda: body.subscriptionPda,
        planId: body.planId,
        subscriberId: subscriber.id,
        createdAt: new Date(body.confirmedAt),
      },
    });

    res.status(201).json({ id: subscription.id });
  }),
);

export default router;
