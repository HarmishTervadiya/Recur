import {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { prisma } from "@recur/db";
import { createLogger } from "@recur/logger";
import { connection, keeperKeypair } from "../solana.js";
import { fetchSubscription } from "../lib/chainVerify.js";
import { buildFinalizeCancelIx } from "../lib/txBuilder.js";
import { reportCancelResult } from "../lib/reporter.js";

const logger = createLogger("finalizeCancel");

export async function finalizeCancel(): Promise<void> {
  const subs = await prisma.subscription.findMany({
    where: { isActive: true, cancelRequestedAt: { not: null } },
    include: { plan: true },
    take: 50,
  });

  const now = Date.now();

  for (const sub of subs) {
    if (!sub.cancelRequestedAt) continue;
    const cancelTime = sub.cancelRequestedAt.getTime();
    const intervalMs = sub.plan.intervalSeconds * 1000;
    if (now < cancelTime + intervalMs) continue;

    const pda = new PublicKey(sub.subscriptionPda);
    const onchain = await fetchSubscription(pda);

    if (!onchain) {
      await reportCancelResult({
        subscriptionPda: sub.subscriptionPda,
        cancelType: "finalize",
        confirmedAt: new Date().toISOString(),
      });
      continue;
    }

    if (onchain.cancelRequestedAt === 0n) {
      logger.warn(
        { pda: sub.subscriptionPda },
        "On-chain cancel not requested, skipping",
      );
      continue;
    }

    const ix = buildFinalizeCancelIx(onchain, pda);
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

      await reportCancelResult({
        subscriptionPda: sub.subscriptionPda,
        cancelType: "finalize",
        confirmedAt: new Date().toISOString(),
      });

      logger.info(
        { pda: sub.subscriptionPda, sig },
        "Finalize cancel completed",
      );
    } catch (err) {
      logger.error(
        { pda: sub.subscriptionPda, err },
        "Finalize cancel tx failed",
      );
    }
  }
}
