import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import crypto from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { prisma } from "@recur/db";
import { env } from "@recur/config";
import { wrap, AppError } from "../../middleware/errors.js";
import { ok } from "../../middleware/response.js";
import { ErrorCode } from "../../errors.js";
import type { AuthPayload } from "../../types.js";

const router: ExpressRouter = Router();
const NONCE_TTL_SECONDS = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function issueTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  });
  const refreshToken = crypto.randomBytes(48).toString("base64url");
  return { accessToken, refreshToken };
}

function buildSignMessage(
  walletAddress: string,
  nonce: string,
  role: string,
): string {
  return `Sign in to Recur as ${role}.\n\nWallet: ${walletAddress}\nNonce: ${nonce}`;
}

// ---------------------------------------------------------------------------
// POST /auth/nonce
// ---------------------------------------------------------------------------

const NonceBody = z.object({
  walletAddress: z.string().min(32),
  role: z.enum(["merchant", "subscriber"]),
});

router.post(
  "/nonce",
  wrap(async (req, res) => {
    const { walletAddress, role } = NonceBody.parse(req.body);

    await prisma.authNonce.deleteMany({
      where: { walletAddress, expiresAt: { lt: new Date() } },
    });

    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000);

    await prisma.authNonce.create({
      data: { walletAddress, nonce, expiresAt },
    });

    ok(res, {
      nonce,
      message: buildSignMessage(walletAddress, nonce, role),
      expiresAt,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /auth/verify — issues access + refresh token pair
// ---------------------------------------------------------------------------

const VerifyBody = z.object({
  walletAddress: z.string().min(32),
  role: z.enum(["merchant", "subscriber"]),
  nonce: z.string().uuid(),
  signature: z.string().min(1),
});

router.post(
  "/verify",
  wrap(async (req, res) => {
    const { walletAddress, role, nonce, signature } = VerifyBody.parse(
      req.body,
    );

    const record = await prisma.authNonce.findUnique({ where: { nonce } });

    if (!record)
      throw new AppError(ErrorCode.NONCE_NOT_FOUND, "Nonce not found");
    if (record.walletAddress !== walletAddress)
      throw new AppError(
        ErrorCode.NONCE_WALLET_MISMATCH,
        "Nonce wallet mismatch",
      );
    if (record.usedAt)
      throw new AppError(ErrorCode.NONCE_ALREADY_USED, "Nonce already used");
    if (record.expiresAt < new Date())
      throw new AppError(ErrorCode.NONCE_EXPIRED, "Nonce expired");

    const message = buildSignMessage(walletAddress, nonce, role);
    const messageBytes = new TextEncoder().encode(message);

    let pubkeyBytes: Uint8Array;
    let sigBytes: Uint8Array;
    try {
      pubkeyBytes = bs58.decode(walletAddress);
      sigBytes = bs58.decode(signature);
    } catch {
      throw new AppError(ErrorCode.INVALID_BASE58, "Invalid base58 encoding");
    }

    const valid = nacl.sign.detached.verify(
      messageBytes,
      sigBytes,
      pubkeyBytes,
    );
    if (!valid)
      throw new AppError(
        ErrorCode.INVALID_SIGNATURE,
        "Signature verification failed",
      );

    await prisma.authNonce.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    if (role === "merchant") {
      await prisma.merchant.upsert({
        where: { walletAddress },
        update: {},
        create: { walletAddress },
      });
    } else {
      await prisma.subscriber.upsert({
        where: { walletAddress },
        update: {},
        create: { walletAddress },
      });
    }

    const payload: AuthPayload = { walletAddress, role };
    const { accessToken, refreshToken } = issueTokens(payload);

    // Store hashed refresh token with a rotation family
    const family = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7d

    await prisma.refreshToken.create({
      data: {
        walletAddress,
        tokenHash: hashToken(refreshToken),
        family,
        expiresAt,
      },
    });

    ok(res, { accessToken, refreshToken });
  }),
);

// ---------------------------------------------------------------------------
// POST /auth/refresh — rotate refresh token, issue new access token
// ---------------------------------------------------------------------------

const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});

router.post(
  "/refresh",
  wrap(async (req, res) => {
    const { refreshToken } = RefreshBody.parse(req.body);
    const tokenHash = hashToken(refreshToken);

    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      // If the token was already revoked, it may be a replay attack.
      // Revoke the entire family to be safe.
      if (existing?.revokedAt) {
        await prisma.refreshToken.updateMany({
          where: { family: existing.family, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid refresh token");
    }

    // Revoke the used token (rotation)
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    // Determine role from wallet — check merchant first
    const merchant = await prisma.merchant.findUnique({
      where: { walletAddress: existing.walletAddress },
    });
    const role = merchant ? "merchant" : "subscriber";

    const payload: AuthPayload = {
      walletAddress: existing.walletAddress,
      role: role as "merchant" | "subscriber",
    };
    const { accessToken, refreshToken: newRefreshToken } =
      issueTokens(payload);

    // Store new refresh token in the same family
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        walletAddress: existing.walletAddress,
        tokenHash: hashToken(newRefreshToken),
        family: existing.family,
        expiresAt,
      },
    });

    ok(res, { accessToken, refreshToken: newRefreshToken });
  }),
);

export default router;
