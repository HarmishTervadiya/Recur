import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
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

    // Subscriber must already have an ATA — they need one to subscribe.
    if (!ataInfos[0]) {
      logger.warn(
        { pda: sub.subscriptionPda },
        "Subscriber token account missing, skipping (forceCancel will handle)",
      );
      continue;
    }

    // Auto-create merchant and treasury ATAs if missing (keeper pays rent).
    const preIxs: TransactionInstruction[] = [];
    if (!ataInfos[1]) {
      logger.info({ pda: sub.subscriptionPda, merchant: onchain.merchant.toBase58() }, "Creating merchant ATA");
      preIxs.push(
        createAssociatedTokenAccountIdempotentInstruction(keeper, merchantAta, onchain.merchant, USDC_MINT),
      );
    }
    if (!ataInfos[2]) {
      logger.info({ pda: sub.subscriptionPda, treasury: treasuryVault.toBase58() }, "Creating treasury vault ATA");
      preIxs.push(
        createAssociatedTokenAccountIdempotentInstruction(keeper, treasuryAta, treasuryVault, USDC_MINT),
      );
    }

    // Grace period: if subscription was created < 5s ago, defer first payment
    // to allow RPC to propagate the delegation state.
    const ageMs = Date.now() - sub.createdAt.getTime();
    if (ageMs < 5_000) {
      logger.debug({ pda: sub.subscriptionPda, ageMs }, "Subscription too fresh, deferring payment by 10s");
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { nextPaymentDue: new Date(Date.now() + 10_000) },
      });
      continue;
    }

    // Pre-flight: verify delegation is valid (delegate = PDA, amount >= subscription amount)
    // Retry with backoff to handle devnet RPC staleness.
    const DELEGATION_RETRIES = 3;
    const DELEGATION_DELAY_MS = 5_000;
    let delegationOk = false;
    for (let attempt = 0; attempt < DELEGATION_RETRIES; attempt++) {
      try {
        const subAccount = await getAccount(connection, subscriberAta);
        if (subAccount.delegate && subAccount.delegate.equals(pda) && subAccount.delegatedAmount >= onchain.amount) {
          delegationOk = true;
          break;
        }
        if (attempt < DELEGATION_RETRIES - 1) {
          logger.debug({ pda: sub.subscriptionPda, attempt }, "Delegation not visible yet, retrying in 5s");
          await new Promise(r => setTimeout(r, DELEGATION_DELAY_MS));
        }
      } catch (err) {
        if (attempt < DELEGATION_RETRIES - 1) {
          await new Promise(r => setTimeout(r, DELEGATION_DELAY_MS));
        } else {
          logger.warn({ pda: sub.subscriptionPda, err }, "Failed to check delegation, skipping");
        }
      }
    }
    if (!delegationOk) {
      try {
        const subAccount = await getAccount(connection, subscriberAta);
        logger.warn(
          { pda: sub.subscriptionPda, delegate: subAccount.delegate?.toBase58() ?? "NONE", delegated: subAccount.delegatedAmount.toString() },
          "Delegation not set or insufficient after retry, skipping payment (forceCancel will handle)",
        );
      } catch {
        logger.warn({ pda: sub.subscriptionPda }, "Delegation check failed after retry, skipping");
      }
      continue;
    }

    const ix = buildProcessPaymentIx(onchain, pda, keeper);
    const tx = new Transaction().add(...preIxs, ix);

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
      const errMsg = err instanceof Error ? err.message : String(err);
      const isInsufficientFunds = errMsg.includes("insufficient funds") || errMsg.includes("0x1");
      const isPdaGone = errMsg.includes("AccountNotInitialized") || errMsg.includes("0xbc4");

      if (isPdaGone) {
        logger.warn(
          { pda: sub.subscriptionPda },
          "PDA closed on-chain (AccountNotInitialized) — marking subscription cancelled",
        );
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "cancelled", cancelledAt: new Date() },
        });
        continue;
      } else if (isInsufficientFunds) {
        logger.warn(
          { pda: sub.subscriptionPda },
          "Subscriber has insufficient token balance — deferring next payment by 1 hour",
        );
        // Defer next attempt by 1 hour instead of retrying every 15s
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { nextPaymentDue: new Date(Date.now() + 3_600_000) },
        });
      } else {
        logger.error({ pda: sub.subscriptionPda, err }, "Payment tx failed");
      }

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
