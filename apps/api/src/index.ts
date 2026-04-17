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
import { ok } from "./middleware/response.js";

const log = createLogger("api");
const app: Express = express();
const PORT = process.env["PORT"] ? parseInt(process.env["PORT"], 10) : 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  ok(res, { status: "ok", timestamp: new Date().toISOString() });
});

app.use("/auth", authRouter);
app.use("/merchant", merchantRouter);
app.use("/plans", plansPublicRouter);
app.use("/subscriber", subscriptionRouter);
app.use("/keeper", keeperRouter);
app.use(errorHandler);

app.listen(PORT, () => {
  log.info(`Recur API running on http://localhost:${PORT}`);
});

export default app;
