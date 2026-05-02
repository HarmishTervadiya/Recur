import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { prisma } from "@recur/db";
import { env } from "@recur/config";
import { createLogger } from "@recur/logger";
import { authenticate, requireMerchant } from "../../middleware/auth.js";
import { wrap, AppError } from "../../middleware/errors.js";
import { ok, fail } from "../../middleware/response.js";
import { ErrorCode } from "../../errors.js";

const logger = createLogger("pro-api");
const router: ExpressRouter = Router();

router.use(authenticate, requireMerchant);

// ---------------------------------------------------------------------------
// GET /merchant/me/pro — current Pro tier status
// ---------------------------------------------------------------------------

router.get(
  "/",
  wrap(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({
      where: { walletAddress: req.user!.walletAddress },
      select: {
        tier: true,
        subscriptionStatus: true,
        gracePeriodExpiresAt: true,
        platformSubscriptionId: true,
        platformSubscription: {
          select: {
            id: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            nextPaymentDue: true,
            subscriptionPda: true,
            platformPlan: {
              select: {
                id: true,
                name: true,
                priceBaseUnits: true,
                feeBps: true,
              },
            },
          },
        },
      },
    });

    if (!merchant) {
      throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, "Merchant not found");
    }

    // Look up available Pro plan from GlobalConfig
    const proPlanId = await prisma.globalConfig.findUnique({
      where: { key: "platform.proPlanId" },
    });

    ok(res, {
      tier: merchant.tier,
      subscriptionStatus: merchant.subscriptionStatus,
      gracePeriodExpiresAt: merchant.gracePeriodExpiresAt,
      subscription: merchant.platformSubscription,
      proPlanId: proPlanId?.value ?? null,
      proPriceBaseUnits: env.RECUR_PRO_PRICE_BASE_UNITS,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /merchant/me/pro/subscribe — returns platform plan details for client
// to build the on-chain subscribe transaction
// ---------------------------------------------------------------------------

const SubscribeBody = z.object({
  planType: z.enum(["monthly", "annual"]).default("monthly"),
});

router.post(
  "/subscribe",
  wrap(async (req, res) => {
    const { planType } = SubscribeBody.parse(req.body);

    const merchant = await prisma.merchant.findUnique({
      where: { walletAddress: req.user!.walletAddress },
      select: { id: true, tier: true, subscriptionStatus: true },
    });

    if (!merchant) {
      throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, "Merchant not found");
    }

    // Don't allow re-subscribe if already active
    if (merchant.tier === "pro" && merchant.subscriptionStatus === "active") {
      throw new AppError(
        ErrorCode.CONFLICT,
        "You already have an active Pro subscription",
      );
    }

    // Look up the platform plan config
    const configKey =
      planType === "annual"
        ? "platform.annualPlanId"
        : "platform.proPlanId";

    const planConfig = await prisma.globalConfig.findUnique({
      where: { key: configKey },
    });

    if (!planConfig) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        "Platform Pro plan not configured. Run the seed script first.",
      );
    }

    // Look up the seed for PDA derivation
    const seedConfig = await prisma.globalConfig.findUnique({
      where: {
        key:
          planType === "annual"
            ? "platform.annualPlanSeed"
            : "platform.proPlanSeed",
      },
    });

    // Look up the platform merchant wallet
    const appConfig = await prisma.globalConfig.findUnique({
      where: { key: "platform.appId" },
    });

    if (!appConfig) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        "Platform app not configured. Run the seed script first.",
      );
    }

    // Get plan details
    const plan = await prisma.plan.findUnique({
      where: { id: planConfig.value },
      include: {
        app: {
          include: { merchant: { select: { walletAddress: true } } },
        },
      },
    });

    if (!plan) {
      throw new AppError(ErrorCode.PLAN_NOT_FOUND, "Platform plan not found");
    }

    // Return everything the frontend needs to build the subscribe tx
    ok(res, {
      planId: plan.id,
      planSeed: seedConfig?.value ?? plan.planSeed,
      amountBaseUnits: plan.amountBaseUnits.toString(),
      intervalSeconds: plan.intervalSeconds,
      merchantWallet: plan.app.merchant.walletAddress,
      currency: plan.currency,
      planName: plan.name,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /merchant/me/pro/confirm — verify on-chain tx, activate Pro tier
// ---------------------------------------------------------------------------

const ConfirmBody = z.object({
  txSignature: z.string().min(32),
  subscriptionPda: z.string().min(32),
  planId: z.string(),
});

router.post(
  "/confirm",
  wrap(async (req, res) => {
    const body = ConfirmBody.parse(req.body);

    const merchant = await prisma.merchant.findUnique({
      where: { walletAddress: req.user!.walletAddress },
    });

    if (!merchant) {
      throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, "Merchant not found");
    }

    // Look up the plan to get platformPlanId linkage
    const plan = await prisma.plan.findUnique({
      where: { id: body.planId },
    });

    if (!plan) {
      throw new AppError(ErrorCode.PLAN_NOT_FOUND, "Plan not found");
    }

    // Find or create the PlatformPlan that matches
    let platformPlan = await prisma.platformPlan.findFirst({
      where: { name: plan.name },
    });

    if (!platformPlan) {
      platformPlan = await prisma.platformPlan.create({
        data: {
          name: plan.name,
          feeBps: 0,
          flatFeeBaseUnits: BigInt(0),
          priceBaseUnits: plan.amountBaseUnits,
        },
      });
    }

    const now = new Date();
    const periodEnd = new Date(
      now.getTime() + plan.intervalSeconds * 1000,
    );

    // Create the platform subscription + link to merchant
    const platformSub = await prisma.platformSubscription.create({
      data: {
        merchantId: merchant.id,
        platformPlanId: platformPlan.id,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        subscriptionPda: body.subscriptionPda,
        nextPaymentDue: now, // First payment is immediate
      },
    });

    // Update merchant tier
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        tier: "pro",
        subscriptionStatus: "active",
        gracePeriodExpiresAt: null,
        platformSubscriptionId: platformSub.id,
      },
    });

    // Also create the regular Subscription row so the keeper picks it up
    const subscriber = await prisma.subscriber.upsert({
      where: { walletAddress: req.user!.walletAddress },
      update: {},
      create: { walletAddress: req.user!.walletAddress },
    });

    await prisma.subscription.upsert({
      where: { subscriptionPda: body.subscriptionPda },
      update: { status: "active" },
      create: {
        subscriptionPda: body.subscriptionPda,
        planId: plan.id,
        subscriberId: subscriber.id,
        status: "active",
        nextPaymentDue: now,
        createdAt: now,
      },
    });

    logger.info(
      { merchantId: merchant.id, pda: body.subscriptionPda },
      "Pro subscription confirmed",
    );

    ok(res, { id: platformSub.id, tier: "pro", status: "active" }, 201);
  }),
);

// ---------------------------------------------------------------------------
// POST /merchant/me/pro/cancel — returns data for client to build cancel tx
// ---------------------------------------------------------------------------

router.post(
  "/cancel",
  wrap(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({
      where: { walletAddress: req.user!.walletAddress },
      include: {
        platformSubscription: true,
      },
    });

    if (!merchant) {
      throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, "Merchant not found");
    }

    if (!merchant.platformSubscription) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        "No active Pro subscription found",
      );
    }

    if (merchant.subscriptionStatus === "cancelled") {
      throw new AppError(
        ErrorCode.CONFLICT,
        "Subscription is already cancelled",
      );
    }

    // Return the subscription PDA so the frontend can build the cancel tx
    ok(res, {
      subscriptionPda: merchant.platformSubscription.subscriptionPda,
      currentPeriodEnd: merchant.platformSubscription.currentPeriodEnd,
    });
  }),
);

export default router;
