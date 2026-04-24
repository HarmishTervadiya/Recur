import { vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@recur/db";
import type { Express } from "express";
import jwt from "jsonwebtoken";

export const prismaMock = mockDeep<PrismaClient>();

beforeEach(() => {
  mockReset(prismaMock);
});

vi.mock("@recur/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@recur/logger", () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }),
  logger: {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

// Set test env vars before config is imported
export const TEST_JWT_SECRET = "test-jwt-secret-at-least-16-chars";
export const TEST_JWT_REFRESH_SECRET = "test-refresh-secret-16-chars-ok";
export const KEEPER_SECRET = "test-keeper-secret";

process.env["NODE_ENV"] = "test";
process.env["JWT_SECRET"] = TEST_JWT_SECRET;
process.env["JWT_REFRESH_SECRET"] = TEST_JWT_REFRESH_SECRET;
process.env["KEEPER_SECRET"] = KEEPER_SECRET;

vi.mock("@recur/config", () => ({
  env: {
    NODE_ENV: "test",
    JWT_SECRET: TEST_JWT_SECRET,
    JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET,
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
    KEEPER_SECRET: KEEPER_SECRET,
    SOLANA_RPC_URL: "http://127.0.0.1:8899",
    PROGRAM_ID: "3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx",
    USDC_MINT: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    DATABASE_URL: "postgresql://localhost:5432/recur",
    PORT: 3001,
    API_URL: "http://localhost:3001",
  },
}));

export async function makeApp(): Promise<Express> {
  const { default: express } = await import("express");
  const { default: cors } = await import("cors");
  const { default: helmet } = await import("helmet");

  const { default: authRouter } = await import("../modules/auth/auth.routes");
  const { default: merchantRouter } =
    await import("../modules/merchant/merchant.routes");
  const { default: plansPublicRouter } =
    await import("../modules/merchant/plans.public.routes");
  const { default: subscriptionRouter } =
    await import("../modules/subscription/subscription.routes");
  const { default: keeperRouter } =
    await import("../modules/webhook/keeper.routes");
  const { errorHandler } = await import("../middleware/errors");
  const { ok } = await import("../middleware/response");

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => ok(res, { status: "ok" }));
  app.use("/auth", authRouter);
  app.use("/merchant", merchantRouter);
  app.use("/plans", plansPublicRouter);
  app.use("/subscriber", subscriptionRouter);
  app.use("/keeper", keeperRouter);
  app.use(errorHandler);

  return app;
}

export function signJwt(
  walletAddress: string,
  role: "merchant" | "subscriber",
): string {
  return jwt.sign({ walletAddress, role }, TEST_JWT_SECRET, { expiresIn: "1h" });
}

export function keeperHeaders(): Record<string, string> {
  return { "x-keeper-secret": KEEPER_SECRET };
}
