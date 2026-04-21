import { PublicKey } from "@solana/web3.js";
import { prisma } from "@recur/db";
import { createLogger } from "@recur/logger";
import { connection } from "../solana.js";
import { PROGRAM_ID } from "@recur/solana-client";
import { reportSubscriptionCreated } from "../lib/reporter.js";

const logger = createLogger("chainScan");

/**
 * Safety-net job: scans the chain for Subscription PDAs owned by our program
 * using `getProgramAccounts`, and registers any that are missing from the DB.
 *
 * This catches subscriptions that were created on-chain but never reported
 * to the API (e.g., SDK → chain succeeded, but SDK → API call failed).
 *
 * Runs every 5 minutes via cron.
 */
export async function chainScan(): Promise<void> {
  logger.info("Starting chain scan for unregistered subscriptions");

  try {
    // Fetch all accounts owned by our program.
    // Subscription accounts have discriminator + specific size.
    // Subscription struct: 8 (disc) + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 = 121 bytes
    const SUBSCRIPTION_SIZE = 121;

    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: SUBSCRIPTION_SIZE }],
    });

    if (accounts.length === 0) {
      logger.debug("No subscription accounts found on-chain");
      return;
    }

    // Get all known PDAs from DB
    const knownPdas = new Set(
      (
        await prisma.subscription.findMany({
          select: { subscriptionPda: true },
        })
      ).map((s) => s.subscriptionPda),
    );

    let discovered = 0;

    for (const { pubkey, account } of accounts) {
      const pdaStr = pubkey.toBase58();
      if (knownPdas.has(pdaStr)) continue;

      // Parse minimal fields from the account data
      const data = Buffer.from(account.data);
      const offset = 8; // skip discriminator
      const subscriber = new PublicKey(data.subarray(offset, offset + 32));
      const merchant = new PublicKey(data.subarray(offset + 32, offset + 64));
      // plan_seed at offset+64..offset+72
      // amount at offset+72
      const createdAt = data.readBigUInt64LE(offset + 96);

      logger.info(
        {
          pda: pdaStr,
          subscriber: subscriber.toBase58(),
          merchant: merchant.toBase58(),
        },
        "Discovered unregistered subscription on-chain",
      );

      // Try to find matching plan by looking up merchant's plans
      // For now, report to API with minimal info — the API's /keeper/subscription
      // endpoint will handle upsert. We need a planId, so we try to find one.
      const merchantRecord = await prisma.merchant.findUnique({
        where: { walletAddress: merchant.toBase58() },
        include: { apps: { include: { plans: true } } },
      });

      if (!merchantRecord) {
        logger.warn(
          { pda: pdaStr, merchant: merchant.toBase58() },
          "Merchant not found in DB for discovered subscription, skipping",
        );
        continue;
      }

      // Find the first active plan for this merchant (best effort)
      const plans = merchantRecord.apps.flatMap((a) => a.plans);
      if (plans.length === 0) {
        logger.warn(
          { pda: pdaStr },
          "No plans found for merchant, skipping subscription registration",
        );
        continue;
      }

      // TODO: Match plan_seed from on-chain data to plan.planSeed for exact match
      const matchedPlan = plans[0]; // fallback to first plan

      await reportSubscriptionCreated({
        subscriptionPda: pdaStr,
        planId: matchedPlan!.id,
        subscriberWallet: subscriber.toBase58(),
        confirmedAt: new Date(Number(createdAt) * 1000).toISOString(),
      });

      discovered++;
    }

    if (discovered > 0) {
      logger.info({ discovered }, "Chain scan completed — new subscriptions registered");
    } else {
      logger.debug("Chain scan completed — no new subscriptions found");
    }
  } catch (err) {
    logger.error({ err }, "Chain scan failed");
  }
}
