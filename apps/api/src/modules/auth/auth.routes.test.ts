import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { makeApp, prismaMock } from "../../test/helpers";
import type { Express } from "express";

const keypair = nacl.sign.keyPair();
const walletAddress = bs58.encode(keypair.publicKey);

const NOW = new Date();
const FUTURE = new Date(Date.now() + 120_000);

const NONCE_1 = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const NONCE_2 = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const NONCE_3 = "c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f";
const NONCE_4 = "d4e5f6a7-b8c9-4dae-bf2a-3b4c5d6e7f80";
const NONCE_5 = "e5f6a7b8-c9d0-4ebf-8a3b-4c5d6e7f8091";
const NONCE_99 = "f6a7b8c9-d0e1-4fc0-9b4c-5d6e7f809102";

function makeNonceRecord(
  overrides: Partial<{
    id: string;
    walletAddress: string;
    nonce: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }> = {},
) {
  return {
    id: "nonce-id-1",
    walletAddress,
    nonce: NONCE_1,
    expiresAt: FUTURE,
    usedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function buildMessage(wallet: string, nonce: string, role: string) {
  return `Sign in to Recur as ${role}.\n\nWallet: ${wallet}\nNonce: ${nonce}`;
}

function signMessage(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const sig = nacl.sign.detached(bytes, keypair.secretKey);
  return bs58.encode(sig);
}

describe("POST /auth/nonce", () => {
  let app: Express;

  beforeAll(async () => {
    app = await makeApp();
  });

  it("returns a nonce for valid wallet + role", async () => {
    prismaMock.authNonce.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.authNonce.create.mockResolvedValue(makeNonceRecord());

    const res = await request(app)
      .post("/auth/nonce")
      .send({ walletAddress, role: "merchant" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("nonce");
    expect(res.body.data).toHaveProperty("message");
    expect(res.body.data).toHaveProperty("expiresAt");
    expect(prismaMock.authNonce.create).toHaveBeenCalledOnce();
  });

  it("returns 400 for missing walletAddress", async () => {
    const res = await request(app)
      .post("/auth/nonce")
      .send({ role: "merchant" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid role", async () => {
    const res = await request(app)
      .post("/auth/nonce")
      .send({ walletAddress, role: "admin" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /auth/verify", () => {
  let app: Express;

  beforeAll(async () => {
    app = await makeApp();
  });

  it("issues a JWT when signature is valid", async () => {
    const nonce = NONCE_1;
    const role = "merchant" as const;
    const message = buildMessage(walletAddress, nonce, role);
    const signature = signMessage(message);
    const record = makeNonceRecord({ nonce });

    prismaMock.authNonce.findUnique.mockResolvedValue(record);
    prismaMock.authNonce.update.mockResolvedValue({
      ...record,
      usedAt: new Date(),
    });
    prismaMock.merchant.upsert.mockResolvedValue({
      id: "m1",
      walletAddress,
      name: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    prismaMock.refreshToken.create.mockResolvedValue({} as any);

    const res = await request(app)
      .post("/auth/verify")
      .send({ walletAddress, role, nonce, signature });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
    expect(res.body.data.accessToken.split(".")).toHaveLength(3);
  });

  it("returns 401 for wrong signature", async () => {
    const nonce = NONCE_2;
    const role = "merchant" as const;
    const record = makeNonceRecord({ nonce });

    prismaMock.authNonce.findUnique.mockResolvedValue(record);

    const badSig = signMessage("wrong message");

    const res = await request(app)
      .post("/auth/verify")
      .send({ walletAddress, role, nonce, signature: badSig });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_SIGNATURE");
  });

  it("returns 400 when nonce not found", async () => {
    prismaMock.authNonce.findUnique.mockResolvedValue(null);

    const nonce = NONCE_99;
    const signature = signMessage(
      buildMessage(walletAddress, nonce, "merchant"),
    );

    const res = await request(app).post("/auth/verify").send({
      walletAddress,
      role: "merchant",
      nonce,
      signature,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NONCE_NOT_FOUND");
  });

  it("returns 400 for already-used nonce", async () => {
    const nonce = NONCE_3;
    prismaMock.authNonce.findUnique.mockResolvedValue(
      makeNonceRecord({ nonce, usedAt: new Date() }),
    );

    const signature = signMessage(
      buildMessage(walletAddress, nonce, "merchant"),
    );

    const res = await request(app)
      .post("/auth/verify")
      .send({ walletAddress, role: "merchant", nonce, signature });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NONCE_ALREADY_USED");
  });

  it("returns 400 for expired nonce", async () => {
    const nonce = NONCE_4;
    prismaMock.authNonce.findUnique.mockResolvedValue(
      makeNonceRecord({ nonce, expiresAt: new Date("2000-01-01") }),
    );

    const signature = signMessage(
      buildMessage(walletAddress, nonce, "merchant"),
    );

    const res = await request(app)
      .post("/auth/verify")
      .send({ walletAddress, role: "merchant", nonce, signature });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NONCE_EXPIRED");
  });

  it("subscriber role upserts subscriber not merchant", async () => {
    const nonce = NONCE_5;
    const role = "subscriber" as const;
    const message = buildMessage(walletAddress, nonce, role);
    const signature = signMessage(message);
    const record = makeNonceRecord({ nonce, walletAddress });

    prismaMock.authNonce.findUnique.mockResolvedValue(record);
    prismaMock.authNonce.update.mockResolvedValue({
      ...record,
      usedAt: new Date(),
    });
    prismaMock.subscriber.upsert.mockResolvedValue({
      id: "s1",
      walletAddress,
      createdAt: NOW,
      updatedAt: NOW,
    });
    prismaMock.refreshToken.create.mockResolvedValue({} as any);

    const res = await request(app)
      .post("/auth/verify")
      .send({ walletAddress, role, nonce, signature });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prismaMock.subscriber.upsert).toHaveBeenCalledOnce();
    expect(prismaMock.merchant.upsert).not.toHaveBeenCalled();
  });
});

describe("POST /auth/refresh", () => {
  let app: Express;

  beforeAll(async () => {
    app = await makeApp();
  });

  it("rotates refresh token and returns new token pair", async () => {
    const existingToken = {
      id: "rt1",
      walletAddress,
      tokenHash: "somehash",
      family: "fam1",
      expiresAt: FUTURE,
      revokedAt: null,
      createdAt: NOW,
    };

    prismaMock.refreshToken.findUnique.mockResolvedValue(existingToken as any);
    prismaMock.refreshToken.update.mockResolvedValue({ ...existingToken, revokedAt: new Date() } as any);
    prismaMock.merchant.findUnique.mockResolvedValue({
      id: "m1",
      walletAddress,
      name: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    prismaMock.refreshToken.create.mockResolvedValue({} as any);

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "some-refresh-token" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
    expect(res.body.data.accessToken.split(".")).toHaveLength(3);
  });

  it("returns 401 for invalid refresh token", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "bad-token" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 and revokes family for reused token", async () => {
    const revokedToken = {
      id: "rt2",
      walletAddress,
      tokenHash: "somehash2",
      family: "fam2",
      expiresAt: FUTURE,
      revokedAt: new Date(),
      createdAt: NOW,
    };

    prismaMock.refreshToken.findUnique.mockResolvedValue(revokedToken as any);
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "reused-token" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledOnce();
  });
});
