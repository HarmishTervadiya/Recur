import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@recur/db";
import { wrap, AppError } from "../../middleware/errors.js";
import { ok } from "../../middleware/response.js";
import { ErrorCode } from "../../errors.js";

const router: ExpressRouter = Router();

router.get(
  "/",
  wrap(async (req, res) => {
    const appId = req.query["appId"] as string | undefined;
    if (!appId)
      throw new AppError(
        ErrorCode.MISSING_APP_ID,
        "appId query param required",
      );

    const plans = await prisma.plan.findMany({
      where: { appId, isActive: true, app: { isActive: true } },
      orderBy: { createdAt: "asc" },
    });
    ok(res, plans);
  }),
);

router.get(
  "/:planId",
  wrap(async (req, res) => {
    const appId = req.query["appId"] as string | undefined;
    if (!appId)
      throw new AppError(
        ErrorCode.MISSING_APP_ID,
        "appId query param required",
      );

    const plan = await prisma.plan.findFirst({
      where: { id: req.params["planId"], appId },
      include: {
        app: {
          include: {
            merchant: { select: { id: true, name: true, walletAddress: true } },
          },
        },
      },
    });
    if (!plan || !plan.isActive || !plan.app.isActive)
      throw new AppError(ErrorCode.PLAN_NOT_FOUND, "Plan not found");
    ok(res, plan);
  }),
);

export default router;
