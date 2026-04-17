import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { makeApp, prismaMock, keeperHeaders } from "../../test/helpers";
import type { Express } from "express";

const NOW = new Date();
const PDA = "pda123456789012345678901234567890";
const TX_SIG = "sig123456789012345678901234567890";

const SUB_RECORD = {
  id: "sub1",
  planId: "plan1",
  subscriberId: "s1",
  subscriptionPda: PDA,
  isActive: true,
  lastPaymentAt: null,
  cancelRequestedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("keeper routes", () => {
  let app: Express;

  beforeAll(async () => {
    app = await makeApp();
  });

  it("rejects requests without keeper secret", async () => {
    const res = await request(app).post("/keeper/payment").send({});

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  describe("POST /keeper/payment", () => {
    it("records a successful payment", async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(SUB_RECORD as any);
      prismaMock.merchantTransaction.upsert.mockResolvedValue({
        id: "tx1",
        subscriptionId: "sub1",
        txSignature: TX_SIG,
        amountGross: BigInt(1000000),
        platformFee: BigInt(2550),
        amountNet: BigInt(997450),
        status: "success",
        createdAt: NOW,
      } as any);
      prismaMock.subscription.update.mockResolvedValue(SUB_RECORD as any);

      const res = await request(app)
        .post("/keeper/payment")
        .set(keeperHeaders())
        .send({
          subscriptionPda: PDA,
          txSignature: TX_SIG,
          amountGross: "1000000",
          platformFee: "2550",
          amountNet: "997450",
          confirmedAt: NOW.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id");
    });

    it("returns 404 for unknown subscription PDA", async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/keeper/payment")
        .set(keeperHeaders())
        .send({
          subscriptionPda: PDA,
          txSignature: TX_SIG,
          amountGross: "1000000",
          platformFee: "2550",
          amountNet: "997450",
          confirmedAt: NOW.toISOString(),
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("SUBSCRIPTION_NOT_FOUND");
    });
  });

  describe("POST /keeper/payment-failed", () => {
    it("records a failed payment", async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(SUB_RECORD as any);
      prismaMock.merchantTransaction.upsert.mockResolvedValue({
        id: "tx2",
        subscriptionId: "sub1",
        txSignature: TX_SIG,
        amountGross: BigInt(1000000),
        platformFee: BigInt(2550),
        amountNet: BigInt(997450),
        status: "failed",
        createdAt: NOW,
      } as any);

      const res = await request(app)
        .post("/keeper/payment-failed")
        .set(keeperHeaders())
        .send({
          subscriptionPda: PDA,
          txSignature: TX_SIG,
          amountGross: "1000000",
          platformFee: "2550",
          amountNet: "997450",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /keeper/cancel", () => {
    it("records a cancel request", async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(SUB_RECORD as any);
      prismaMock.subscription.update.mockResolvedValue(SUB_RECORD as any);

      const res = await request(app)
        .post("/keeper/cancel")
        .set(keeperHeaders())
        .send({
          subscriptionPda: PDA,
          cancelType: "request",
          confirmedAt: NOW.toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("records a force cancel", async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(SUB_RECORD as any);
      prismaMock.subscription.update.mockResolvedValue({
        ...SUB_RECORD,
        isActive: false,
      } as any);

      const res = await request(app)
        .post("/keeper/cancel")
        .set(keeperHeaders())
        .send({
          subscriptionPda: PDA,
          cancelType: "force",
          confirmedAt: NOW.toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /keeper/subscription", () => {
    it("creates a subscription from on-chain event", async () => {
      prismaMock.subscriber.upsert.mockResolvedValue({
        id: "s1",
        walletAddress: "someWallet12345678901234567890abc",
        createdAt: NOW,
        updatedAt: NOW,
      } as any);
      prismaMock.plan.findUnique.mockResolvedValue({
        id: "plan1",
        isActive: true,
      } as any);
      prismaMock.subscription.upsert.mockResolvedValue({
        id: "sub1",
        subscriptionPda: PDA,
      } as any);

      const res = await request(app)
        .post("/keeper/subscription")
        .set(keeperHeaders())
        .send({
          subscriptionPda: PDA,
          planId: "clx0000000000000000000000",
          subscriberWallet: "someWallet12345678901234567890abc",
          confirmedAt: NOW.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id");
    });

    it("returns 404 when plan not found", async () => {
      prismaMock.subscriber.upsert.mockResolvedValue({
        id: "s1",
        walletAddress: "someWallet12345678901234567890abc",
        createdAt: NOW,
        updatedAt: NOW,
      } as any);
      prismaMock.plan.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/keeper/subscription")
        .set(keeperHeaders())
        .send({
          subscriptionPda: PDA,
          planId: "clx0000000000000000000000",
          subscriberWallet: "someWallet12345678901234567890abc",
          confirmedAt: NOW.toISOString(),
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("PLAN_NOT_FOUND");
    });
  });
});
