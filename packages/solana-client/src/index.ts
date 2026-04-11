import { PublicKey } from "@solana/web3.js";

export const SUBSCRIPTION_SEED = Buffer.from("subscription");

export const USDC_MINT_DEVNET = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export function findSubscriptionPda(
  merchant: PublicKey,
  subscriber: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SUBSCRIPTION_SEED, merchant.toBuffer(), subscriber.toBuffer()],
    programId
  );
}
