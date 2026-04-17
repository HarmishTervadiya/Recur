import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import nacl from "tweetnacl";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { prisma } from "@recur/db";
import { wrap, ApiError } from "../../middleware/errors.js";
import type { AuthPayload } from "../../types.js";

const router: ExpressRouter = Router();
const JWT_SECRET = process.env["JWT_SECRET"] ?? "change-me-in-production";
const NONCE_TTL_SECONDS = 120; // nonce expires after 2 minutes

// ---------------------------------------------------------------------------
// POST /auth/nonce
// Issues a fresh challenge nonce for the given wallet address.
// ---------------------------------------------------------------------------
const NonceBody = z.object({
  walletAddress: z.string().min(32),
  role: z.enum(["merchant", "subscriber"]),
});

router.post(
  "/nonce",
  wrap(async (req, res) => {
    const { walletAddress, role } = NonceBody.parse(req.body);

    // Clean up stale nonces for this wallet.
    await prisma.authNonce.deleteMany({
      where: {
        walletAddress,
        expiresAt: { lt: new Date() },
      },
    });

    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000);

    await prisma.authNonce.create({
      data: { walletAddress, nonce, expiresAt },
    });

    res.json({
      nonce,
      message: buildSignMessage(walletAddress, nonce, role),
      expiresAt,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /auth/verify
// Verifies Ed25519 signature over the challenge message, issues JWT.
// ---------------------------------------------------------------------------
const VerifyBody = z.object({
  walletAddress: z.string().min(32),
  role: z.enum(["merchant", "subscriber"]),
  nonce: z.string().uuid(),
  signature: z.string().min(1), // base58-encoded 64-byte Ed25519 signature
});

router.post(
  "/verify",
  wrap(async (req, res) => {
    const { walletAddress, role, nonce, signature } = VerifyBody.parse(
      req.body,
    );

    // Look up the nonce.
    const record = await prisma.authNonce.findUnique({ where: { nonce } });

    if (!record) throw new ApiError(400, "Nonce not found");
    if (record.walletAddress !== walletAddress)
      throw new ApiError(400, "Nonce wallet mismatch");
    if (record.usedAt) throw new ApiError(400, "Nonce already used");
    if (record.expiresAt < new Date()) throw new ApiError(400, "Nonce expired");

    // Verify Ed25519 signature.
    const message = buildSignMessage(walletAddress, nonce, role);
    const messageBytes = new TextEncoder().encode(message);

    let pubkeyBytes: Uint8Array;
    let sigBytes: Uint8Array;
    try {
      pubkeyBytes = bs58.decode(walletAddress);
      sigBytes = bs58.decode(signature);
    } catch {
      throw new ApiError(400, "Invalid base58 encoding");
    }

    const valid = nacl.sign.detached.verify(
      messageBytes,
      sigBytes,
      pubkeyBytes,
    );
    if (!valid) throw new ApiError(401, "Signature verification failed");

    // Mark nonce as used.
    await prisma.authNonce.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    // Upsert the identity record.
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
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    res.json({ token });
  }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSignMessage(
  walletAddress: string,
  nonce: string,
  role: string,
): string {
  return `Sign in to Recur as ${role}.\n\nWallet: ${walletAddress}\nNonce: ${nonce}`;
}

export default router;
