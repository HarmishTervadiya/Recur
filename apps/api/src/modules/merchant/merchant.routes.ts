import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { prisma } from "@recur/db";
import { authenticate, requireMerchant } from "../../middleware/auth.js";
import { wrap, AppError } from "../../middleware/errors.js";
import { ok } from "../../middleware/response.js";
import { ErrorCode } from "../../errors.js";

const router: ExpressRouter = Router();

router.use(authenticate, requireMerchant);

router.get(
  "/me",
  wrap(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({
      where: { walletAddress: req.user!.walletAddress },
      include: { apps: { orderBy: { createdAt: "desc" } } },
    });
    if (!merchant)
      throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, "Merchant not found");
    ok(res, merchant);
  }),
);

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
    ok(res, merchant);
  }),
);

router.get(
  "/apps",
  wrap(async (req, res) => {
    const merchant = await getMerchant(req.user!.walletAddress);
    const apps = await prisma.app.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
      include: { plans: { where: { isActive: true } } },
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

router.get(
  "/apps/:appId/plans",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);
    const plans = await prisma.plan.findMany({
      where: { appId: req.params["appId"] },
      orderBy: { createdAt: "desc" },
    });
    ok(res, plans.map(serializePlan));
  }),
);

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
    ok(res, serializePlan(plan), 201);
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
    ok(res, serializePlan(plan));
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
    ok(res, serializePlan(plan));
  }),
);

router.get(
  "/apps/:appId/transactions",
  wrap(async (req, res) => {
    await getOwnedApp(req.user!.walletAddress, req.params["appId"]!);

    const page = Math.max(1, Number(req.query["page"] ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"] ?? 20)));

    const transactions = await prisma.merchantTransaction.findMany({
      where: { subscription: { plan: { appId: req.params["appId"] } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { subscription: { include: { plan: true } } },
    });
    ok(res, transactions.map(serializeTransaction));
  }),
);

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
