import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import nacl from "tweetnacl";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { prisma } from "@recur/db";
import { wrap, AppError } from "../../middleware/errors.js";
import { ok } from "../../middleware/response.js";
import { ErrorCode } from "../../errors.js";
import type { AuthPayload } from "../../types.js";

const router: ExpressRouter = Router();
const JWT_SECRET = process.env["JWT_SECRET"] ?? "change-me-in-production";
const NONCE_TTL_SECONDS = 120;

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
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    ok(res, { token });
  }),
);

function buildSignMessage(
  walletAddress: string,
  nonce: string,
  role: string,
): string {
  return `Sign in to Recur as ${role}.\n\nWallet: ${walletAddress}\nNonce: ${nonce}`;
}

export default router;
