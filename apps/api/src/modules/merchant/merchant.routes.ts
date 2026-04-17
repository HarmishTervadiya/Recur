import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { prisma } from "@recur/db";
import { authenticate, requireMerchant } from "../../middleware/auth.js";
import { wrap, ApiError } from "../../middleware/errors.js";

const router: ExpressRouter = Router();

// All merchant routes require authentication + merchant role.
router.use(authenticate, requireMerchant);

// ---------------------------------------------------------------------------
// GET /merchant/me — fetch own merchant profile
// ---------------------------------------------------------------------------
router.get(
  "/me",
  wrap(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({
      where: { walletAddress: req.user!.walletAddress },
      include: { apps: { orderBy: { createdAt: "desc" } } },
    });
    if (!merchant) throw new ApiError(404, "Merchant not found");
    res.json(merchant);
  }),
);

// ---------------------------------------------------------------------------
// PATCH /merchant/me — update merchant profile (name)
// ---------------------------------------------------------------------------
const UpdateMerchantBody = z.object({
  name: z.string().min(1).max(100),
});

router.patch(
  "/me",
  wrap(async (req, res) => {
    const { name } = UpdateMerchantBody.parse(req.body);
    const merchant = await prisma.merchant.update({
      where: { walletAddress: req.user!.walletAddress },
      data: { name },
    });
    res.json(merchant);
  }),
);

// ---------------------------------------------------------------------------
// Apps  — /merchant/apps
// ---------------------------------------------------------------------------

// GET /merchant/apps
router.get(
  "/apps",
  wrap(async (req, res) => {
    const merchant = await getMerchant(req.user!.walletAddress);
    const apps = await prisma.app.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
      include: { plans: { where: { isActive: true } } },
    });
    res.json(apps);
  }),
);

// POST /merchant/apps
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
    res.status(201).json(app);
  }),
);

// GET /merchant/apps/:appId
router.get(
  "/apps/:appId",
  wrap(async (req, res) => {
    const app = await getOwnedApp(
      req.user!.walletAddress,
      req.params["appId"]!,
    );
    res.json(app);
  }),
);

// PATCH /merchant/apps/:appId
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
    res.json(app);
  }),
);

// DELETE /merchant/apps/:appId — soft-delete by setting isActive = false
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
// Plans  — /merchant/apps/:appId/plans
// ---------------------------------------------------------------------------

// GET /merchant/apps/:appId/plans
router.get(
  "/apps/:appId/plans",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const plans = await prisma.plan.findMany({
      where: { appId: req.params["appId"] },
      orderBy: { createdAt: "desc" },
    });
    res.json(plans);
  }),
);

// POST /merchant/apps/:appId/plans
const CreatePlanBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  amountBaseUnits: z
    .string()
    .regex(/^\d+$/, "Must be a non-negative integer string"),
  intervalSeconds: z.number().int().positive(),
  currency: z.string().default("USDC"),
});

router.post(
  "/apps/:appId/plans",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const body = CreatePlanBody.parse(req.body);
    const plan = await prisma.plan.create({
      data: {
        appId: req.params["appId"]!,
        name: body.name,
        description: body.description,
        amountBaseUnits: BigInt(body.amountBaseUnits),
        intervalSeconds: body.intervalSeconds,
        currency: body.currency,
      },
    });
    res.status(201).json(serializePlan(plan));
  }),
);

// GET /merchant/apps/:appId/plans/:planId
router.get(
  "/apps/:appId/plans/:planId",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const plan = await prisma.plan.findFirst({
      where: { id: req.params["planId"], appId: req.params["appId"] },
    });
    if (!plan) throw new ApiError(404, "Plan not found");
    res.json(serializePlan(plan));
  }),
);

// PATCH /merchant/apps/:appId/plans/:planId
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
    res.json(serializePlan(plan));
  }),
);

// ---------------------------------------------------------------------------
// Transactions — /merchant/apps/:appId/transactions
// ---------------------------------------------------------------------------

router.get(
  "/apps/:appId/transactions",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);

    const page = Math.max(1, Number(req.query["page"] ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"] ?? 20)));

    const transactions = await prisma.merchantTransaction.findMany({
      where: {
        subscription: { plan: { appId: req.params["appId"] } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });
    res.json(transactions.map(serializeTransaction));
  }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getMerchant(walletAddress: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { walletAddress },
  });
  if (!merchant) throw new ApiError(404, "Merchant not found");
  return merchant;
}

async function getOwnedApp(walletAddress: string, appId: string) {
  const merchant = await getMerchant(walletAddress);
  const app = await prisma.app.findFirst({
    where: { id: appId, merchantId: merchant.id },
    include: { plans: false },
  });
  if (!app) throw new ApiError(404, "App not found");
  return app;
}

function serializePlan(plan: {
  amountBaseUnits: bigint;
  [key: string]: unknown;
}) {
  return { ...plan, amountBaseUnits: plan.amountBaseUnits.toString() };
}

function serializeTransaction(tx: {
  amountGross: bigint;
  platformFee: bigint;
  amountNet: bigint;
  [key: string]: unknown;
}) {
  return {
    ...tx,
    amountGross: tx.amountGross.toString(),
    platformFee: tx.platformFee.toString(),
    amountNet: tx.amountNet.toString(),
  };
}

export default router;
