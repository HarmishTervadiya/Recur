import { PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { connection } from "../solana.js";
import { PROGRAM_ID } from "@recur/solana-client";
import { env } from "@recur/config";
import { createLogger } from "@recur/logger";

const USDC_MINT = new PublicKey(env.USDC_MINT);

const logger = createLogger("chainVerify");

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

/** Exponential backoff retry wrapper for RPC calls. */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_BASE_MS * 2 ** attempt;
        logger.debug({ attempt, delay, label }, "RPC call failed, retrying");
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("unreachable");
}

export interface OnChainSubscription {
  subscriber: PublicKey;
  merchant: PublicKey;
  planSeed: Buffer;
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
    const info = await withRetry(
      () => connection.getAccountInfo(pda),
      `getAccountInfo(${pda.toBase58().slice(0, 8)})`,
    );
    if (!info || !info.data || info.data.length < 8) return null;
    if (!info.owner.equals(PROGRAM_ID)) return null;

    const d = Buffer.from(info.data);
    const o = 8; // skip discriminator
    return {
      subscriber: readPubkey(d, o),
      merchant: readPubkey(d, o + 32),
      planSeed: Buffer.from(d.subarray(o + 64, o + 72)),
      amount: readU64(d, o + 72),
      interval: readU64(d, o + 80),
      lastPaymentTimestamp: readU64(d, o + 88),
      createdAt: readU64(d, o + 96),
      cancelRequestedAt: readU64(d, o + 104),
      bump: d.readUInt8(o + 112),
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
    const account = await withRetry(
      () => getAccount(connection, ata),
      `getAccount(${ata.toBase58().slice(0, 8)})`,
    );
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
