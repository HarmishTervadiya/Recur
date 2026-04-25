import {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { prisma } from "@recur/db";
import { createLogger } from "@recur/logger";
import { env } from "@recur/config";
import { connection, keeperKeypair } from "../solana.js";
import { fetchSubscription } from "../lib/chainVerify.js";
import { buildProcessPaymentIx } from "../lib/txBuilder.js";
import { findTreasuryVaultPda } from "@recur/solana-client";
import {
  reportPaymentResult,
  reportPaymentFailed,
} from "../lib/reporter.js";

const USDC_MINT = new PublicKey(env.USDC_MINT);

const logger = createLogger("processPayments");

const BATCH_SIZE = parseInt(process.env["KEEPER_BATCH_SIZE"] ?? "50", 10);

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
  // Use nextPaymentDue for efficient query instead of computing interval
  const subs = await prisma.subscription.findMany({
    where: {
      status: "active",
      cancelRequestedAt: null,
      nextPaymentDue: { lte: new Date() },
    },
    include: { plan: true, subscriber: true },
    take: BATCH_SIZE,
    orderBy: { nextPaymentDue: "asc" },
  });

  if (subs.length === 0) return;

  logger.info({ count: subs.length }, "Processing due payments");
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
      // Do NOT report a cancel here. The forceCancel job is responsible for
      // detecting truly closed PDAs and reporting cancels after actually
      // verifying on-chain state. processPayments only processes payments.
      logger.warn(
        { pda: sub.subscriptionPda },
        "PDA not found on-chain, skipping (forceCancel job will handle if truly closed)",
      );
      continue;
    }

    if (onchain.cancelRequestedAt > 0n) {
      logger.info(
        { pda: sub.subscriptionPda },
        "Cancel requested on-chain, skipping payment",
      );
      continue;
    }

    // Pre-flight: verify all token accounts exist before sending tx
    const subscriberAta = getAssociatedTokenAddressSync(USDC_MINT, onchain.subscriber);
    const merchantAta = getAssociatedTokenAddressSync(USDC_MINT, onchain.merchant);
    const [treasuryVault] = findTreasuryVaultPda();
    const treasuryAta = getAssociatedTokenAddressSync(USDC_MINT, treasuryVault, true);

    const ataInfos = await connection.getMultipleAccountsInfo([subscriberAta, merchantAta, treasuryAta]);
    const ataLabels = ["subscriber", "merchant", "treasury"];
    const missingAtas = ataLabels.filter((_, i) => !ataInfos[i]);
    if (missingAtas.length > 0) {
      logger.warn(
        { pda: sub.subscriptionPda, missing: missingAtas },
        "Token account(s) not initialized, skipping payment",
      );
      continue;
    }

    // Pre-flight: verify delegation is valid (delegate = PDA, amount >= subscription amount)
    try {
      const subAccount = await getAccount(connection, subscriberAta);
      if (!subAccount.delegate || !subAccount.delegate.equals(pda)) {
        logger.warn(
          { pda: sub.subscriptionPda, delegate: subAccount.delegate?.toBase58() ?? "NONE" },
          "Delegation not set or wrong delegate, skipping payment (forceCancel will handle)",
        );
        continue;
      }
      if (subAccount.delegatedAmount < onchain.amount) {
        logger.warn(
          { pda: sub.subscriptionPda, delegated: subAccount.delegatedAmount.toString(), required: onchain.amount.toString() },
          "Insufficient delegated amount, skipping payment (forceCancel will handle)",
        );
        continue;
      }
    } catch (err) {
      logger.warn({ pda: sub.subscriptionPda, err }, "Failed to check delegation, skipping");
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

      logger.info({ pda: sub.subscriptionPda, sig }, "Payment processed on-chain");

      // Report to API — if this fails, the payment still happened on-chain.
      // The next cycle will see the updated lastPaymentTimestamp and won't
      // double-charge. The chainScan job can reconcile later.
      try {
        await reportPaymentResult({
          subscriptionPda: sub.subscriptionPda,
          txSignature: sig,
          amountGross: gross.toString(),
          platformFee: fee.toString(),
          amountNet: net.toString(),
          fromWallet: sub.subscriber.walletAddress,
          toWallet: onchain.merchant.toBase58(),
          confirmedAt: new Date().toISOString(),
        });
        logger.info({ pda: sub.subscriptionPda, sig }, "Payment reported to API");
      } catch (reportErr) {
        logger.error(
          { pda: sub.subscriptionPda, sig, err: reportErr },
          "Payment succeeded on-chain but reporter failed — will reconcile later",
        );
      }
    } catch (err) {
      logger.error({ pda: sub.subscriptionPda, err }, "Payment tx failed");
      const { gross, fee, net } = computeFee(onchain.amount);
      try {
        await reportPaymentFailed({
          subscriptionPda: sub.subscriptionPda,
          txSignature: `failed-${Date.now()}-${"0".repeat(20)}`,
          amountGross: gross.toString(),
          platformFee: fee.toString(),
          amountNet: net.toString(),
        });
      } catch (reportErr) {
        logger.error({ pda: sub.subscriptionPda, err: reportErr }, "Failed to report payment failure");
      }
    }
  }
}
