import {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { prisma } from "@recur/db";
import { createLogger } from "@recur/logger";
import { connection, keeperKeypair } from "../solana.js";
import { fetchSubscription } from "../lib/chainVerify.js";
import { buildProcessPaymentIx } from "../lib/txBuilder.js";
import {
  reportPaymentResult,
  reportPaymentFailed,
  reportCancelResult,
} from "../lib/reporter.js";

const logger = createLogger("processPayments");

const PLATFORM_FLAT_FEE = 50_000n;
const PLATFORM_BPS = 25n;
const BPS_DENOMINATOR = 10_000n;

function computeFee(amount: bigint): {
  gross: bigint;
  fee: bigint;
  net: bigint;
} {
  const percentFee = (amount * PLATFORM_BPS) / BPS_DENOMINATOR;
  const fee = PLATFORM_FLAT_FEE + percentFee;
  return { gross: amount, fee, net: amount - fee };
}

export async function processPayments(): Promise<void> {
  const subs = await prisma.subscription.findMany({
    where: { isActive: true, cancelRequestedAt: null },
    include: { plan: true },
    take: 50,
  });

  const now = Date.now();
  const keeper = keeperKeypair.publicKey;

  for (const sub of subs) {
    const lastPayment = sub.lastPaymentAt?.getTime() ?? sub.createdAt.getTime();
    const intervalMs = sub.plan.intervalSeconds * 1000;
    if (now < lastPayment + intervalMs) continue;

    const pda = new PublicKey(sub.subscriptionPda);
    const onchain = await fetchSubscription(pda);

    if (!onchain) {
      logger.warn(
        { pda: sub.subscriptionPda },
        "PDA not found on-chain, reporting force cancel",
      );
      await reportCancelResult({
        subscriptionPda: sub.subscriptionPda,
        cancelType: "force",
        confirmedAt: new Date().toISOString(),
      });
      continue;
    }

    if (onchain.cancelRequestedAt > 0n) {
      logger.info(
        { pda: sub.subscriptionPda },
        "Cancel requested on-chain, skipping payment",
      );
      continue;
    }

    const ix = buildProcessPaymentIx(onchain, pda, keeper);
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

      const { gross, fee, net } = computeFee(onchain.amount);
      await reportPaymentResult({
        subscriptionPda: sub.subscriptionPda,
        txSignature: sig,
        amountGross: gross.toString(),
        platformFee: fee.toString(),
        amountNet: net.toString(),
        confirmedAt: new Date().toISOString(),
      });

      logger.info({ pda: sub.subscriptionPda, sig }, "Payment processed");
    } catch (err) {
      logger.error({ pda: sub.subscriptionPda, err }, "Payment tx failed");
      const { gross, fee, net } = computeFee(onchain.amount);
      await reportPaymentFailed({
        subscriptionPda: sub.subscriptionPda,
        txSignature: `failed-${Date.now()}`,
        amountGross: gross.toString(),
        platformFee: fee.toString(),
        amountNet: net.toString(),
      });
    }
  }
}
