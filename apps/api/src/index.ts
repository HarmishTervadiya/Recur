import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { createLogger } from "@recur/logger";

import authRouter from "./modules/auth/auth.routes.js";
import merchantRouter from "./modules/merchant/merchant.routes.js";
import plansPublicRouter from "./modules/merchant/plans.public.routes.js";
import subscriptionRouter from "./modules/subscription/subscription.routes.js";
import keeperRouter from "./modules/webhook/keeper.routes.js";
import { errorHandler } from "./middleware/errors.js";

const logger = createLogger("api");
const app: Express = express();
const PORT = process.env["PORT"] ? parseInt(process.env["PORT"], 10) : 3001;

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Public health check */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/** Auth — nonce challenge + JWT issuance */
app.use("/auth", authRouter);

/** Merchant dashboard — apps, plans, transactions */
app.use("/merchant", merchantRouter);

/** Public plan discovery (unauthenticated) */
app.use("/plans", plansPublicRouter);

/** Subscriber — own subscriptions + transaction history */
app.use("/subscriber", subscriptionRouter);

/** Keeper ingest — internal only, protected by shared secret */
app.use("/keeper", keeperRouter);

// ---------------------------------------------------------------------------
// Error handler (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  logger.info(`Recur API running on http://localhost:${PORT}`);
});

export default app;
