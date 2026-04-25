import {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { prisma } from "@recur/db";
import { createLogger } from "@recur/logger";
import { connection, keeperKeypair } from "../solana.js";
import { fetchSubscription, verifyDelegation } from "../lib/chainVerify.js";
import { buildForceCancelIx } from "../lib/txBuilder.js";
import { reportCancelResult } from "../lib/reporter.js";

const logger = createLogger("forceCancel");

const BATCH_SIZE = parseInt(process.env["KEEPER_BATCH_SIZE"] ?? "100", 10);

/**
 * Track consecutive PDA-not-found counts per subscription.
 * Only mark as cancelled after confirmed missing across multiple forceCancel runs.
 */
const pdaNotFoundCounts = new Map<string, number>();
const PDA_GONE_THRESHOLD = 5;

export async function forceCancel(): Promise<void> {
  const subs = await prisma.subscription.findMany({
    where: { status: "active" },
    include: { plan: true },
    take: BATCH_SIZE,
  });

  const keeper = keeperKeypair.publicKey;

  for (const sub of subs) {
    let pda: PublicKey;
    try {
      pda = new PublicKey(sub.subscriptionPda);
    } catch {
      logger.warn({ pda: sub.subscriptionPda }, "Invalid PDA (non-base58), skipping");
      continue;
    }
    const onchain = await fetchSubscription(pda);

    if (!onchain) {
      // PDA not found — could be transient RPC failure or genuinely closed.
      // Only report cancel after confirmed missing across multiple job runs.
      const count = (pdaNotFoundCounts.get(sub.subscriptionPda) ?? 0) + 1;
      pdaNotFoundCounts.set(sub.subscriptionPda, count);

      if (count < PDA_GONE_THRESHOLD) {
        logger.warn(
          { pda: sub.subscriptionPda, notFoundCount: count, threshold: PDA_GONE_THRESHOLD },
          "PDA not found on-chain, waiting for confirmation",
        );
        continue;
      }

      // Confirmed gone after N consecutive checks — safe to mark cancelled in DB.
      // The PDA was already closed on-chain (by finalize_cancel, force_cancel,
      // or Anchor garbage collection), so no on-chain tx is needed.
      logger.info(
        { pda: sub.subscriptionPda, notFoundCount: count },
        "PDA confirmed closed on-chain after repeated checks, marking cancelled",
      );
      pdaNotFoundCounts.delete(sub.subscriptionPda);
      await reportCancelResult({
        subscriptionPda: sub.subscriptionPda,
        cancelType: "force",
        confirmedAt: new Date().toISOString(),
      });
      continue;
    }

    // PDA exists — reset not-found counter
    pdaNotFoundCounts.delete(sub.subscriptionPda);

    const delegationValid = await verifyDelegation(
      onchain.subscriber,
      pda,
      onchain.amount,
    );

    if (delegationValid) continue;

    logger.info(
      { pda: sub.subscriptionPda },
      "Delegation revoked or insufficient, force cancelling",
    );

    const ix = buildForceCancelIx(onchain, pda, keeper);
    const tx = new Transaction().add(ix);

    try {
      const sig = await sendAndConfirmTransaction(
        connection,
        tx,
        [keeperKeypair],
        {
          commitment: "confirmed",
          maxRetries: 3,
        },
      );

      // Only report cancel AFTER confirmed on-chain force_cancel tx
      await reportCancelResult({
        subscriptionPda: sub.subscriptionPda,
        cancelType: "force",
        confirmedAt: new Date().toISOString(),
      });

      logger.info({ pda: sub.subscriptionPda, sig }, "Force cancel completed");
    } catch (err) {
      logger.error({ pda: sub.subscriptionPda, err }, "Force cancel tx failed");
    }
  }
}
