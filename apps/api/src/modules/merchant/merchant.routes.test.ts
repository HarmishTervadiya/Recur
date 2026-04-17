import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { makeApp, prismaMock, signJwt } from "../../test/helpers";
import type { Express } from "express";

const WALLET = "7nYBm5mKQXHjGRxFgZMDqsNxick2LUEso2EHCjNbjLwi";
const NOW = new Date();

const MERCHANT = {
  id: "m1",
  walletAddress: WALLET,
  name: null,
  createdAt: NOW,
  updatedAt: NOW,
};
const APP_1 = {
  id: "app1",
  merchantId: "m1",
  name: "My App",
  description: null,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("merchant routes", () => {
  let app: Express;
  let token: string;

  beforeAll(async () => {
    app = await makeApp();
    token = signJwt(WALLET, "merchant");
  });

  describe("GET /merchant/me", () => {
    it("returns merchant profile", async () => {
      prismaMock.merchant.findUnique.mockResolvedValue({
        ...MERCHANT,
        apps: [],
      } as any);

      const res = await request(app)
        .get("/merchant/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.walletAddress).toBe(WALLET);
    });

    it("returns 404 when merchant not found", async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get("/merchant/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("MERCHANT_NOT_FOUND");
    });

    it("returns 401 without token", async () => {
      const res = await request(app).get("/merchant/me");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 403 for subscriber token", async () => {
      const subToken = signJwt(WALLET, "subscriber");
      const res = await request(app)
        .get("/merchant/me")
        .set("Authorization", `Bearer ${subToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("PATCH /merchant/me", () => {
    it("updates merchant name", async () => {
      prismaMock.merchant.update.mockResolvedValue({
        ...MERCHANT,
        name: "Acme",
      });

      const res = await request(app)
        .patch("/merchant/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Acme" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Acme");
    });

    it("returns 400 for empty name", async () => {
      const res = await request(app)
        .patch("/merchant/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /merchant/apps", () => {
    it("creates an app", async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(MERCHANT);
      prismaMock.app.create.mockResolvedValue(APP_1 as any);

      const res = await request(app)
        .post("/merchant/apps")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "My App" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("My App");
    });
  });

  describe("GET /merchant/apps", () => {
    it("lists merchant apps", async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(MERCHANT);
      prismaMock.app.findMany.mockResolvedValue([APP_1] as any);

      const res = await request(app)
        .get("/merchant/apps")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe("GET /merchant/apps/:appId", () => {
    it("returns a single app", async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(MERCHANT);
      prismaMock.app.findFirst.mockResolvedValue(APP_1 as any);

      const res = await request(app)
        .get("/merchant/apps/app1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe("app1");
    });

    it("returns 404 for non-existent app", async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(MERCHANT);
      prismaMock.app.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get("/merchant/apps/nope")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("APP_NOT_FOUND");
    });
  });

  describe("DELETE /merchant/apps/:appId", () => {
    it("soft-deletes an app", async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(MERCHANT);
      prismaMock.app.findFirst.mockResolvedValue(APP_1 as any);
      prismaMock.app.update.mockResolvedValue({
        ...APP_1,
        isActive: false,
      } as any);

      const res = await request(app)
        .delete("/merchant/apps/app1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(204);
    });
  });

  describe("POST /merchant/apps/:appId/plans", () => {
    it("creates a plan", async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(MERCHANT);
      prismaMock.app.findFirst.mockResolvedValue(APP_1 as any);
      prismaMock.plan.create.mockResolvedValue({
        id: "plan1",
        appId: "app1",
        name: "Pro",
        description: null,
        amountBaseUnits: BigInt(1000000),
        intervalSeconds: 2592000,
        currency: "USDC",
        isActive: true,
        createdAt: NOW,
        updatedAt: NOW,
      } as any);

      const res = await request(app)
        .post("/merchant/apps/app1/plans")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Pro",
          amountBaseUnits: "1000000",
          intervalSeconds: 2592000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amountBaseUnits).toBe("1000000");
    });
  });
});
