/**
 * Nuclear cleanup: find ALL subscription PDAs on-chain, force-cancel them,
 * then mark ALL subscriptions + platform subscriptions as cancelled in DB.
 *
 * Usage: bun run scripts/clean-stale-subs.ts
 */
import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";
import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, TransactionInstruction } from "@solana/web3.js";
import { readFileSync } from "fs";

const prisma = new PrismaClient();
const connection = new Connection(
  "https://devnet.helius-rpc.com/?api-key=6e39e37f-a078-4ca2-b36d-6bb311409f2a",
);
const keeperKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync("C:\\Users\\harmi\\deploy-key.json", "utf-8")))
);
const PROGRAM_ID = new PublicKey("5HFL1agQqg6wHeLEsLuJVKdLZbMzAC2rGRQkEWk8smLk");
const FORCE_CANCEL_DISC = Buffer.from([175, 185, 230, 97, 169, 116, 227, 2]);

async function forceCancelPda(pda: PublicKey): Promise<boolean> {
  const info = await connection.getAccountInfo(pda);
  if (!info) {
    console.log(`  PDA ${pda.toBase58()} — already closed on-chain`);
    return true;
  }

  // Parse: 8 (disc) + 32 (subscriber) + 32 (merchant)
  const data = info.data;
  const subscriber = new PublicKey(data.subarray(8, 40));
  const merchant = new PublicKey(data.subarray(40, 72));

  const ix: TransactionInstruction = {
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: subscriber, isSigner: false, isWritable: true },
      { pubkey: merchant, isSigner: false, isWritable: false },
      { pubkey: keeperKeypair.publicKey, isSigner: true, isWritable: false },
    ],
    data: FORCE_CANCEL_DISC,
  };

  try {
    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [keeperKeypair], { commitment: "confirmed" });
    console.log(`  PDA ${pda.toBase58()} — force cancelled on-chain. Sig: ${sig}`);
    return true;
  } catch (err: any) {
    console.error(`  PDA ${pda.toBase58()} — force cancel FAILED: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("=== STEP 1: Force cancel all PDAs on-chain ===\n");

  // Get all subscription PDAs from DB (any status)
  const allSubs = await prisma.subscription.findMany({
    select: { id: true, subscriptionPda: true, status: true },
  });
  const allPlatformSubs = await prisma.platformSubscription.findMany({
    select: { id: true, subscriptionPda: true, status: true },
  });

  const allPdas = new Set<string>();
  for (const s of allSubs) allPdas.add(s.subscriptionPda);
  for (const s of allPlatformSubs) allPdas.add(s.subscriptionPda);

  console.log(`Found ${allPdas.size} unique PDAs to check on-chain\n`);

  for (const pdaStr of allPdas) {
    await forceCancelPda(new PublicKey(pdaStr));
  }

  console.log("\n=== STEP 2: Mark all subscriptions as cancelled in DB ===\n");

  const r1 = await prisma.subscription.updateMany({
    where: { status: { not: "cancelled" } },
    data: { status: "cancelled", cancelledAt: new Date() },
  });
  console.log(`Updated ${r1.count} subscriptions → cancelled`);

  const r2 = await prisma.platformSubscription.updateMany({
    where: { status: { not: "cancelled" } },
    data: { status: "cancelled" },
  });
  console.log(`Updated ${r2.count} platform subscriptions → cancelled`);

  // Reset all merchants to free tier
  const r3 = await prisma.merchant.updateMany({
    where: { tier: "pro" },
    data: { tier: "free", subscriptionStatus: null },
  });
  console.log(`Reset ${r3.count} merchants from pro → free`);

  await prisma.$disconnect();
  console.log("\n=== DONE! Clean slate achieved. ===");
}

main().catch(console.error);
