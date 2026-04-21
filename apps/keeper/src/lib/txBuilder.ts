import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PROGRAM_ID, findTreasuryVaultPda } from "@recur/solana-client";
import { env } from "@recur/config";
import type { OnChainSubscription } from "./chainVerify.js";

const USDC_MINT = new PublicKey(env.USDC_MINT);

const PROCESS_PAYMENT_DISCRIMINATOR = Buffer.from([
  189, 81, 30, 198, 139, 186, 115, 23,
]);
const FINALIZE_CANCEL_DISCRIMINATOR = Buffer.from([
  6, 200, 45, 123, 144, 47, 207, 102,
]);
const FORCE_CANCEL_DISCRIMINATOR = Buffer.from([
  175, 185, 230, 97, 169, 116, 227, 2,
]);

export function buildProcessPaymentIx(
  sub: OnChainSubscription,
  subscriptionPda: PublicKey,
  keeper: PublicKey,
): TransactionInstruction {
  const [treasuryVault] = findTreasuryVaultPda();
  const subscriberAta = getAssociatedTokenAddressSync(
    USDC_MINT,
    sub.subscriber,
  );
  const merchantAta = getAssociatedTokenAddressSync(
    USDC_MINT,
    sub.merchant,
  );
  const treasuryAta = getAssociatedTokenAddressSync(
    USDC_MINT,
    treasuryVault,
    true,
  );

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: subscriptionPda, isSigner: false, isWritable: true },
      { pubkey: sub.subscriber, isSigner: false, isWritable: false },
      { pubkey: sub.merchant, isSigner: false, isWritable: false },
      { pubkey: subscriberAta, isSigner: false, isWritable: true },
      { pubkey: merchantAta, isSigner: false, isWritable: true },
      { pubkey: treasuryVault, isSigner: false, isWritable: false },
      { pubkey: treasuryAta, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: keeper, isSigner: true, isWritable: false },
    ],
    data: PROCESS_PAYMENT_DISCRIMINATOR,
  });
}

export function buildFinalizeCancelIx(
  sub: OnChainSubscription,
  subscriptionPda: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: subscriptionPda, isSigner: false, isWritable: true },
      { pubkey: sub.subscriber, isSigner: false, isWritable: true },  // rent refund destination
      { pubkey: sub.merchant, isSigner: false, isWritable: false },
    ],
    data: FINALIZE_CANCEL_DISCRIMINATOR,
  });
}

export function buildForceCancelIx(
  sub: OnChainSubscription,
  subscriptionPda: PublicKey,
  keeper: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: subscriptionPda, isSigner: false, isWritable: true },
      { pubkey: sub.subscriber, isSigner: false, isWritable: true },  // rent refund destination
      { pubkey: sub.merchant, isSigner: false, isWritable: false },
      { pubkey: keeper, isSigner: true, isWritable: false },
    ],
    data: FORCE_CANCEL_DISCRIMINATOR,
  });
}
