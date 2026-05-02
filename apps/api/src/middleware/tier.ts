import type { Request, Response, NextFunction } from "express";
import { prisma } from "@recur/db";
import { ErrorCode } from "../errors.js";
import { fail } from "./response.js";

/**
 * Middleware that gates a route behind the Pro tier.
 *
 * Checks the merchant's tier and subscription status in the database
 * (not the JWT) because tier can change mid-token-lifetime due to
 * grace period expiry or payment success.
 *
 * Must be used AFTER `authenticate` + `requireMerchant`.
 *
 * Allows access when:
 *   - tier === "pro" AND subscriptionStatus === "active"
 *   - tier === "pro" AND subscriptionStatus === "past_due" AND gracePeriodExpiresAt > now
 *
 * Returns 402 Payment Required otherwise.
 */
export async function requireProTier(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const walletAddress = req.user?.walletAddress;
  if (!walletAddress) {
    fail(res, ErrorCode.UNAUTHORIZED, "Authentication required");
    return;
  }

  const merchant = await prisma.merchant.findUnique({
    where: { walletAddress },
    select: {
      tier: true,
      subscriptionStatus: true,
      gracePeriodExpiresAt: true,
    },
  });

  if (!merchant) {
    fail(res, ErrorCode.MERCHANT_NOT_FOUND, "Merchant not found");
    return;
  }

  if (merchant.tier === "pro") {
    if (merchant.subscriptionStatus === "active") {
      next();
      return;
    }

    // Allow access during grace period
    if (
      merchant.subscriptionStatus === "past_due" &&
      merchant.gracePeriodExpiresAt &&
      merchant.gracePeriodExpiresAt > new Date()
    ) {
      next();
      return;
    }
  }

  fail(res, ErrorCode.PRO_REQUIRED, "Pro subscription required", {
    upgradePath: "/dashboard/settings#recur-pro",
  });
}
