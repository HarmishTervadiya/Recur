import {
  Router,
  type Router as ExpressRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import { prisma } from "@recur/db";
import { wrap, AppError } from "../../middleware/errors.js";
import { ok, fail } from "../../middleware/response.js";
import { ErrorCode } from "../../errors.js";

const router: ExpressRouter = Router();

function verifyKeeperSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = req.headers["x-keeper-secret"];
  const expected = process.env["KEEPER_SECRET"];
  if (!expected || secret !== expected) {
    fail(res, ErrorCode.UNAUTHORIZED, "Unauthorized");
    return;
  }
  next();
}

router.use(verifyKeeperSecret);

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
        status: "success",
      },
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        lastPaymentAt: new Date(body.confirmedAt),
        isActive: true,
        cancelRequestedAt: null,
      },
    });

    ok(res, { id: tx.id }, 201);
  }),
);

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

    ok(res, { id: tx.id }, 201);
  }),
);

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
      throw new AppError(
        ErrorCode.SUBSCRIPTION_NOT_FOUND,
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

    ok(res, { ok: true });
  }),
);

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

    ok(res, { id: subscription.id }, 201);
  }),
);

export default router;
