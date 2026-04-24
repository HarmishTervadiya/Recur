import { PublicKey, Connection } from "@solana/web3.js";

// Default program ID — can be overridden at runtime via env.
const DEFAULT_PROGRAM_ID = "3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx";
const DEFAULT_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const PROGRAM_ID = new PublicKey(DEFAULT_PROGRAM_ID);
export const USDC_MINT_DEVNET = new PublicKey(DEFAULT_USDC_MINT);

/**
 * Create a program ID PublicKey from a string.
 * Use this when you need to pass env.PROGRAM_ID at runtime.
 */
export function getProgramId(id?: string): PublicKey {
  return new PublicKey(id ?? DEFAULT_PROGRAM_ID);
}

/**
 * Create a Connection from config values.
 */
export function createConnection(rpcUrl: string, commitment: "confirmed" | "finalized" = "confirmed"): Connection {
  return new Connection(rpcUrl, commitment);
}

/**
 * Convert a hex-encoded planSeed string (from DB) to an 8-byte Buffer
 * suitable for PDA derivation and on-chain instruction args.
 */
export function planSeedToBuffer(hexSeed: string): Buffer {
  const buf = Buffer.from(hexSeed, "hex");
  if (buf.length !== 8)
    throw new Error(`planSeed must be 8 bytes (16 hex chars), got ${buf.length}`);
  return buf;
}

/**
 * Convert a planSeed Buffer to the `[u8; 8]` array format expected by Anchor.
 */
export function planSeedToArray(hexSeed: string): number[] {
  return Array.from(planSeedToBuffer(hexSeed));
}

export function findSubscriptionPda(
  subscriber: PublicKey,
  merchant: PublicKey,
  planSeed: Buffer | Uint8Array,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("subscription"), subscriber.toBuffer(), merchant.toBuffer(), Buffer.from(planSeed)],
    programId,
  );
}

export function findTreasuryVaultPda(
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_vault")],
    programId,
  );
}

export function findWithdrawalProposalPda(
  proposer: PublicKey,
  nonce: bigint,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  const nonceBytes = Buffer.alloc(8);
  nonceBytes.writeBigUInt64LE(nonce);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("withdrawal_proposal"), proposer.toBuffer(), nonceBytes],
    programId,
  );
}
