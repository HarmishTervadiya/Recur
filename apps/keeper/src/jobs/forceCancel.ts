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

export async function forceCancel(): Promise<void> {
  const subs = await prisma.subscription.findMany({
    where: { isActive: true },
    include: { plan: true },
    take: 100,
  });

  const keeper = keeperKeypair.publicKey;

  for (const sub of subs) {
    const pda = new PublicKey(sub.subscriptionPda);
    const onchain = await fetchSubscription(pda);

    if (!onchain) {
      await reportCancelResult({
        subscriptionPda: sub.subscriptionPda,
        cancelType: "force",
        confirmedAt: new Date().toISOString(),
      });
      continue;
    }

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
