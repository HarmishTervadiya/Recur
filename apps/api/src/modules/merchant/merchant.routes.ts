import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@recur/db";
// EventType enum defined inline (Zod 4) to avoid cross-version issues with @recur/types (Zod 3)
import { authenticate, requireMerchant } from "../../middleware/auth.js";
import { wrap, AppError } from "../../middleware/errors.js";
import { ok, okPaginated, parsePagination } from "../../middleware/response.js";
import { ErrorCode } from "../../errors.js";

const router: ExpressRouter = Router();

router.use(authenticate, requireMerchant);

// ---------------------------------------------------------------------------
// Merchant profile
// ---------------------------------------------------------------------------

router.get(
  "/me",
  wrap(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({
      where: { walletAddress: req.user!.walletAddress },
      include: {
        apps: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { plans: true } } },
        },
      },
    });
    if (!merchant)
      throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, "Merchant not found");
    ok(res, merchant);
  }),
);

const UpdateMerchantBody = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  businessName: z.string().max(200).optional(),
  businessUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
});

router.patch(
  "/me",
  wrap(async (req, res) => {
    const data = UpdateMerchantBody.parse(req.body);
    const merchant = await prisma.merchant.update({
      where: { walletAddress: req.user!.walletAddress },
      data,
    });
    ok(res, merchant);
  }),
);

// ---------------------------------------------------------------------------
// Apps
// ---------------------------------------------------------------------------

router.get(
  "/apps",
  wrap(async (req, res) => {
    const merchant = await getMerchant(req.user!.walletAddress);
    const apps = await prisma.app.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { plans: true } } },
    });
    ok(res, apps);
  }),
);

const CreateAppBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

router.post(
  "/apps",
  wrap(async (req, res) => {
    const { name, description } = CreateAppBody.parse(req.body);
    const merchant = await getMerchant(req.user!.walletAddress);
    const app = await prisma.app.create({
      data: { merchantId: merchant.id, name, description },
    });
    ok(res, app, 201);
  }),
);

router.get(
  "/apps/:appId",
  wrap(async (req, res) => {
    const app = await getOwnedApp(
      req.user!.walletAddress,
      req.params["appId"]!,
    );
    ok(res, app);
  }),
);

const UpdateAppBody = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  "/apps/:appId",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const data = UpdateAppBody.parse(req.body);
    const app = await prisma.app.update({
      where: { id: req.params["appId"] },
      data,
    });
    ok(res, app);
  }),
);

router.delete(
  "/apps/:appId",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    await prisma.app.update({
      where: { id: req.params["appId"] },
      data: { isActive: false },
    });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

router.get(
  "/apps/:appId/plans",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const plans = await prisma.plan.findMany({
      where: { appId: req.params["appId"] },
      orderBy: { createdAt: "desc" },
    });
    ok(res, plans);
  }),
);

const CreatePlanBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  amountBaseUnits: z.coerce.number().min(1),
  intervalSeconds: z.number().int().positive(),
  currency: z.string().default("USDC"),
});

router.post(
  "/apps/:appId/plans",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const body = CreatePlanBody.parse(req.body);

    // Generate a unique 8-byte plan seed (hex-encoded for storage).
    const planSeed = crypto.randomBytes(8).toString("hex");

    const plan = await prisma.plan.create({
      data: {
        appId: req.params["appId"]!,
        name: body.name,
        description: body.description,
        planSeed,
        amountBaseUnits: BigInt(body.amountBaseUnits),
        intervalSeconds: body.intervalSeconds,
        currency: body.currency,
      },
    });
    ok(res, plan, 201);
  }),
);

router.get(
  "/apps/:appId/plans/:planId",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const plan = await prisma.plan.findFirst({
      where: { id: req.params["planId"], appId: req.params["appId"] },
    });
    if (!plan) throw new AppError(ErrorCode.PLAN_NOT_FOUND, "Plan not found");
    ok(res, plan);
  }),
);

const UpdatePlanBody = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  "/apps/:appId/plans/:planId",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const data = UpdatePlanBody.parse(req.body);
    const plan = await prisma.plan.update({
      where: { id: req.params["planId"] },
      data,
    });
    ok(res, plan);
  }),
);

// ---------------------------------------------------------------------------
// Transactions (with pagination metadata)
// ---------------------------------------------------------------------------

router.get(
  "/apps/:appId/transactions",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);

    const { page, limit, skip } = parsePagination(
      req.query as Record<string, unknown>,
    );

    const [transactions, total] = await Promise.all([
      prisma.merchantTransaction.findMany({
        where: { subscription: { plan: { appId: req.params["appId"] } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { subscription: { include: { plan: true } } },
      }),
      prisma.merchantTransaction.count({
        where: { subscription: { plan: { appId: req.params["appId"] } } },
      }),
    ]);

    okPaginated(res, transactions, {
      page,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

// ---------------------------------------------------------------------------
// Webhook Endpoints (CRUD)
// ---------------------------------------------------------------------------

const CreateWebhookBody = z.object({
  url: z.string().url(),
  // Validate each event string against the known EventType enum.
  // Defined inline with Zod 4 to avoid cross-version incompatibility with @recur/types (Zod 3).
  events: z
    .array(
      z.enum([
        "subscription_created",
        "payment_success",
        "payment_failed",
        "cancel_requested",
        "cancel_finalized",
        "cancel_forced",
        "delegation_revoked",
        "platform_pro_activated",
        "platform_pro_past_due",
        "platform_pro_downgraded",
      ]),
    )
    .default([]),
});

router.post(
  "/apps/:appId/webhooks",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const body = CreateWebhookBody.parse(req.body);

    // Limit: 1 webhook endpoint per app
    const existing = await prisma.webhookEndpoint.count({
      where: { appId: req.params["appId"]!, isActive: true },
    });
    if (existing >= 1) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Only one active webhook endpoint is allowed per app. Delete the existing one before adding a new one.",
      );
    }

    const rawSecret = crypto.randomBytes(32).toString("hex");

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        appId: req.params["appId"]!,
        url: body.url,
        secret: rawSecret,
        events: body.events,
      },
    });

    // Return the raw secret once — stored as plaintext for HMAC signing.
    ok(res, { ...endpoint, secret: rawSecret }, 201);
  }),
);

router.get(
  "/apps/:appId/webhooks",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { appId: req.params["appId"] },
      orderBy: { createdAt: "desc" },
    });
    // Strip secret hash from response
    ok(
      res,
      endpoints.map(({ secret, ...e }) => e),
    );
  }),
);

router.delete(
  "/apps/:appId/webhooks/:webhookId",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: req.params["webhookId"], appId: req.params["appId"] },
    });
    if (!endpoint)
      throw new AppError(
        ErrorCode.WEBHOOK_NOT_FOUND,
        "Webhook endpoint not found",
      );
    await prisma.webhookEndpoint.delete({ where: { id: endpoint.id } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

const CreateApiKeyBody = z.object({
  label: z.string().max(100).optional(),
});

router.post(
  "/api-keys",
  wrap(async (req, res) => {
    const body = CreateApiKeyBody.parse(req.body);
    const merchant = await getMerchant(req.user!.walletAddress);
    const rawKey = `sk_live_${crypto.randomBytes(24).toString("base64url")}`;

    const apiKey = await prisma.apiKey.create({
      data: {
        merchantId: merchant.id,
        prefix: rawKey.slice(0, 16),
        keyHash: crypto.createHash("sha256").update(rawKey).digest("hex"),
        label: body.label,
      },
    });

    // Return the raw key once.
    ok(
      res,
      {
        id: apiKey.id,
        key: rawKey,
        prefix: apiKey.prefix,
        label: apiKey.label,
      },
      201,
    );
  }),
);

router.get(
  "/api-keys",
  wrap(async (req, res) => {
    const merchant = await getMerchant(req.user!.walletAddress);
    const keys = await prisma.apiKey.findMany({
      where: { merchantId: merchant.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        prefix: true,
        label: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    ok(res, keys);
  }),
);

router.delete(
  "/api-keys/:keyId",
  wrap(async (req, res) => {
    const merchant = await getMerchant(req.user!.walletAddress);
    const key = await prisma.apiKey.findFirst({
      where: {
        id: req.params["keyId"],
        merchantId: merchant.id,
        revokedAt: null,
      },
    });
    if (!key)
      throw new AppError(ErrorCode.API_KEY_NOT_FOUND, "API key not found");
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { revokedAt: new Date() },
    });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getMerchant(walletAddress: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { walletAddress },
  });
  if (!merchant)
    throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, "Merchant not found");
  return merchant;
}

async function getOwnedApp(walletAddress: string, appId: string) {
  const merchant = await getMerchant(walletAddress);
  const app = await prisma.app.findFirst({
    where: { id: appId, merchantId: merchant.id },
    include: { plans: false },
  });
  if (!app) throw new AppError(ErrorCode.APP_NOT_FOUND, "App not found");
  return app;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

router.get(
  "/me/analytics",
  wrap(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({
      where: { walletAddress: req.user!.walletAddress },
    });
    if (!merchant)
      throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, "Merchant not found");

    const apps = await prisma.app.findMany({
      where: { merchantId: merchant.id },
      select: { id: true },
    });
    const appIds = apps.map((a) => a.id);

    // If no apps, return zeros
    if (appIds.length === 0) {
      ok(res, {
        totalRevenue: "0",
        activeSubscriptions: 0,
        totalSubscribers: 0,
        mrr: "0",
        revenueByDay: [],
        subscriptionsByStatus: {
          active: 0,
          cancelled: 0,
          past_due: 0,
          expired: 0,
        },
        topPlans: [],
      });
      return;
    }

    const plans = await prisma.plan.findMany({
      where: { appId: { in: appIds } },
      select: {
        id: true,
        name: true,
        amountBaseUnits: true,
        intervalSeconds: true,
        appId: true,
      },
    });
    const planIds = plans.map((p) => p.id);

    // Aggregate subscriptions
    const [activeCount, cancelledCount, pastDueCount, expiredCount] =
      await Promise.all([
        prisma.subscription.count({
          where: { planId: { in: planIds }, status: "active" },
        }),
        prisma.subscription.count({
          where: { planId: { in: planIds }, status: "cancelled" },
        }),
        prisma.subscription.count({
          where: { planId: { in: planIds }, status: "past_due" },
        }),
        prisma.subscription.count({
          where: { planId: { in: planIds }, status: "expired" },
        }),
      ]);

    // Total unique subscribers
    const totalSubscribers = await prisma.subscription.findMany({
      where: { planId: { in: planIds } },
      select: { subscriberId: true },
      distinct: ["subscriberId"],
    });

    // Revenue (all successful transactions)
    const transactions = await prisma.merchantTransaction.findMany({
      where: {
        subscription: { planId: { in: planIds } },
        status: "success",
      },
      select: { amountNet: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const totalRevenue = transactions.reduce(
      (sum, t) => sum + t.amountNet,
      BigInt(0),
    );

    // Revenue by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const revenueByDay: { date: string; amount: string }[] = [];
    const dayMap = new Map<string, bigint>();
    for (const tx of transactions) {
      if (tx.createdAt < thirtyDaysAgo) continue;
      const day = tx.createdAt.toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? BigInt(0)) + tx.amountNet);
    }
    for (const [date, amount] of dayMap.entries()) {
      revenueByDay.push({ date, amount: amount.toString() });
    }

    // MRR: sum of active subscriptions normalized to monthly
    const activeSubscriptions = await prisma.subscription.findMany({
      where: { planId: { in: planIds }, status: "active" },
      select: { planId: true },
    });
    // const planMap = new Map(plans.map((p) => [p.id, p]));
    const planMap = new Map<string, any>(plans.map((p: any) => [p.id, p]));
    let mrr = BigInt(0);
    const MONTH_SECONDS = 30 * 24 * 60 * 60;
    for (const sub of activeSubscriptions) {
      const plan = planMap.get(sub.planId);
      if (!plan) continue;
      // Normalize to monthly: (amountBaseUnits / intervalSeconds) * MONTH_SECONDS
      if (plan.intervalSeconds > 0) {
        mrr +=
          (plan.amountBaseUnits * BigInt(MONTH_SECONDS)) /
          BigInt(plan.intervalSeconds);
      }
    }

    // Top plans by subscriber count
    const topPlans = plans
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: p.amountBaseUnits.toString(),
        interval:
          p.intervalSeconds <= 604800
            ? "weekly"
            : p.intervalSeconds <= 2678400
              ? "monthly"
              : "yearly",
        activeCount: activeSubscriptions.filter((s) => s.planId === p.id)
          .length,
      }))
      .sort((a, b) => b.activeCount - a.activeCount)
      .slice(0, 5);

    ok(res, {
      totalRevenue: totalRevenue.toString(),
      activeSubscriptions: activeCount,
      totalSubscribers: totalSubscribers.length,
      mrr: mrr.toString(),
      revenueByDay,
      subscriptionsByStatus: {
        active: activeCount,
        cancelled: cancelledCount,
        past_due: pastDueCount,
        expired: expiredCount,
      },
      topPlans,
    });
  }),
);

export default router;
