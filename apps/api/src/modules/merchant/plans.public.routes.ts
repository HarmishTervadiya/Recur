import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@recur/db";
import { wrap, ApiError } from "../../middleware/errors.js";

/**
 * Public read-only routes — no authentication required.
 * Used by subscriber UIs to discover plans before signing up.
 */
const router: ExpressRouter = Router();

// GET /plans/:planId — fetch a single public plan
router.get(
  "/:planId",
  wrap(async (req, res) => {
    const plan = await prisma.plan.findUnique({
      where: { id: req.params["planId"], isActive: true },
      include: {
        app: {
          include: {
            merchant: { select: { id: true, name: true, walletAddress: true } },
          },
        },
      },
    });
    if (!plan) throw new ApiError(404, "Plan not found");
    res.json({ ...plan, amountBaseUnits: plan.amountBaseUnits.toString() });
  }),
);

// GET /plans?appId=... — list active plans for an app
router.get(
  "/",
  wrap(async (req, res) => {
    const appId = req.query["appId"] as string | undefined;
    if (!appId) throw new ApiError(400, "appId query param required");

    const plans = await prisma.plan.findMany({
      where: { appId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(
      plans.map((p) => ({
        ...p,
        amountBaseUnits: p.amountBaseUnits.toString(),
      })),
    );
  }),
);

export default router;
