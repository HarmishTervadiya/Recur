import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { makeApp, prismaMock, signJwt } from "../../test/helpers";
import type { Express } from "express";

const WALLET = "9xYBm5mKQXHjGRxFgZMDqsNxick2LUEso2EHCjNbjLwi";
const NOW = new Date();

const SUBSCRIBER = {
  id: "s1",
  walletAddress: WALLET,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("subscriber routes", () => {
  let app: Express;
  let token: string;

  beforeAll(async () => {
    app = await makeApp();
    token = signJwt(WALLET, "subscriber");
  });

  describe("GET /subscriber/me", () => {
    it("returns subscriber profile", async () => {
      prismaMock.subscriber.findUnique.mockResolvedValue(SUBSCRIBER as any);

      const res = await request(app)
        .get("/subscriber/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.walletAddress).toBe(WALLET);
    });

    it("returns 404 when not found", async () => {
      prismaMock.subscriber.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get("/subscriber/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("SUBSCRIBER_NOT_FOUND");
    });

    it("returns 403 for merchant token", async () => {
      const mToken = signJwt(WALLET, "merchant");
      const res = await request(app)
        .get("/subscriber/me")
        .set("Authorization", `Bearer ${mToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("GET /subscriber/subscriptions", () => {
    it("lists subscriptions", async () => {
      prismaMock.subscriber.findUnique.mockResolvedValue(SUBSCRIBER as any);
      prismaMock.subscription.findMany.mockResolvedValue([
        {
          id: "sub1",
          planId: "plan1",
          subscriberId: "s1",
          subscriptionPda: "pda123456789012345678901234567890",
          status: "active",
          nextPaymentDue: new Date(Date.now() + 2592000000),
          lastPaymentAt: null,
          cancelRequestedAt: null,
          cancelledAt: null,
          createdAt: NOW,
          updatedAt: NOW,
          plan: {
            id: "plan1",
            name: "Pro",
            amountBaseUnits: BigInt(1000000),
            app: { id: "app1", name: "App", merchant: { id: "m1" } },
          },
        },
      ] as any);
      prismaMock.subscription.count.mockResolvedValue(1);

      const res = await request(app)
        .get("/subscriber/subscriptions")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body).toHaveProperty("pagination");
    });
  });

  describe("POST /subscriber/subscriptions", () => {
    it("registers a subscription", async () => {
      prismaMock.subscriber.findUnique.mockResolvedValue(SUBSCRIBER as any);
      prismaMock.plan.findFirst.mockResolvedValue({
        id: "plan1",
        appId: "app1",
        isActive: true,
        app: { id: "app1", isActive: true },
      } as any);
      prismaMock.subscription.create.mockResolvedValue({
        id: "sub1",
        planId: "plan1",
        subscriberId: "s1",
        subscriptionPda: "pda123456789012345678901234567890",
        status: "active",
        nextPaymentDue: new Date(Date.now() + 2592000000),
        lastPaymentAt: null,
        cancelRequestedAt: null,
        cancelledAt: null,
        createdAt: NOW,
        updatedAt: NOW,
        plan: { id: "plan1", name: "Pro", amountBaseUnits: BigInt(1000000) },
      } as any);

      const res = await request(app)
        .post("/subscriber/subscriptions")
        .set("Authorization", `Bearer ${token}`)
        .send({
          appId: "app1",
          planId: "clx0000000000000000000000",
          subscriptionPda: "pda123456789012345678901234567890",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(prismaMock.plan.findFirst).toHaveBeenCalledWith({
        where: { id: "clx0000000000000000000000", appId: "app1" },
        include: { app: true },
      });
    });

    it("returns 404 for missing plan", async () => {
      prismaMock.subscriber.findUnique.mockResolvedValue(SUBSCRIBER as any);
      prismaMock.plan.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/subscriber/subscriptions")
        .set("Authorization", `Bearer ${token}`)
        .send({
          appId: "app1",
          planId: "clx0000000000000000000000",
          subscriptionPda: "pda123456789012345678901234567890",
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("PLAN_NOT_FOUND");
    });

    it("returns 400 for inactive plan", async () => {
      prismaMock.subscriber.findUnique.mockResolvedValue(SUBSCRIBER as any);
      prismaMock.plan.findFirst.mockResolvedValue({
        id: "plan1",
        appId: "app1",
        isActive: false,
        app: { id: "app1", isActive: true },
      } as any);

      const res = await request(app)
        .post("/subscriber/subscriptions")
        .set("Authorization", `Bearer ${token}`)
        .send({
          appId: "app1",
          planId: "clx0000000000000000000000",
          subscriptionPda: "pda123456789012345678901234567890",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("PLAN_INACTIVE");
    });
  });
});
