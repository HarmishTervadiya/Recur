import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj",
);

export const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

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
