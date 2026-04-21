import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { makeApp, prismaMock } from "../../test/helpers";
import type { Express } from "express";

const NOW = new Date();

describe("public plan routes", () => {
  let app: Express;

  beforeAll(async () => {
    app = await makeApp();
  });

  describe("GET /plans?appId=...", () => {
    it("returns plans for an app", async () => {
      prismaMock.plan.findMany.mockResolvedValue([
        {
          id: "plan1",
          appId: "app1",
          name: "Basic",
          description: null,
          planSeed: "a1b2c3d4e5f6a7b8",
          amountBaseUnits: BigInt(500000),
          intervalSeconds: 2592000,
          currency: "USDC",
          isActive: true,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ] as any);

      const res = await request(app).get("/plans?appId=app1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].amountBaseUnits).toBe("500000");
    });

    it("returns 400 without appId", async () => {
      const res = await request(app).get("/plans");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("MISSING_APP_ID");
    });
  });

  describe("GET /plans/:planId", () => {
    it("returns a single plan with app and merchant info", async () => {
      prismaMock.plan.findUnique.mockResolvedValue({
        id: "plan1",
        appId: "app1",
        name: "Pro",
        description: null,
        planSeed: "b2c3d4e5f6a7b8c9",
        amountBaseUnits: BigInt(1000000),
        intervalSeconds: 2592000,
        currency: "USDC",
        isActive: true,
        createdAt: NOW,
        updatedAt: NOW,
        app: {
          id: "app1",
          name: "My App",
          merchant: { id: "m1", name: "Acme", walletAddress: "abc" },
        },
      } as any);

      const res = await request(app).get("/plans/plan1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amountBaseUnits).toBe("1000000");
    });

    it("returns 404 for non-existent plan", async () => {
      prismaMock.plan.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/plans/nope");

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("PLAN_NOT_FOUND");
    });
  });
});
