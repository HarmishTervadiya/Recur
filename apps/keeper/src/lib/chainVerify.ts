import { PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { connection } from "../solana.js";
import { PROGRAM_ID } from "@recur/solana-client";
import { env } from "@recur/config";
import { createLogger } from "@recur/logger";

const USDC_MINT = new PublicKey(env.USDC_MINT);

const logger = createLogger("chainVerify");

export interface OnChainSubscription {
  subscriber: PublicKey;
  merchant: PublicKey;
  amount: bigint;
  interval: bigint;
  lastPaymentTimestamp: bigint;
  createdAt: bigint;
  cancelRequestedAt: bigint;
  bump: number;
}

function readPubkey(buf: Buffer, offset: number): PublicKey {
  return new PublicKey(buf.subarray(offset, offset + 32));
}

function readU64(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

export async function fetchSubscription(
  pda: PublicKey,
): Promise<OnChainSubscription | null> {
  try {
    const info = await connection.getAccountInfo(pda);
    if (!info || !info.data || info.data.length < 8) return null;
    if (!info.owner.equals(PROGRAM_ID)) return null;

    const d = Buffer.from(info.data);
    const o = 8; // skip discriminator
    return {
      subscriber: readPubkey(d, o),
      merchant: readPubkey(d, o + 32),
      amount: readU64(d, o + 64),
      interval: readU64(d, o + 72),
      lastPaymentTimestamp: readU64(d, o + 80),
      createdAt: readU64(d, o + 88),
      cancelRequestedAt: readU64(d, o + 96),
      bump: d.readUInt8(o + 104),
    };
  } catch (err) {
    logger.error(
      { pda: pda.toBase58(), err },
      "Failed to fetch subscription PDA",
    );
    return null;
  }
}

export async function verifyDelegation(
  subscriberWallet: PublicKey,
  subscriptionPda: PublicKey,
  requiredAmount: bigint,
): Promise<boolean> {
  try {
    const ata = getAssociatedTokenAddressSync(
      USDC_MINT,
      subscriberWallet,
    );
    const account = await getAccount(connection, ata);
    return (
      account.delegate !== null &&
      account.delegate.equals(subscriptionPda) &&
      account.delegatedAmount >= requiredAmount
    );
  } catch (err) {
    logger.warn(
      { wallet: subscriberWallet.toBase58(), err },
      "Delegation check failed",
    );
    return false;
  }
}
