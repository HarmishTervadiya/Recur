/**
 * force-cancel-orphan.ts — Force-cancel an orphaned subscription PDA via the keeper.
 *
 * Usage:
 *   bun run scripts/force-cancel-orphan.ts <subscription-pda>
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import crypto from "crypto";

const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx");
const conn = new Connection(RPC_URL, "confirmed");

function ixDiscriminator(name: string): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(`global:${name}`).digest()
  ).subarray(0, 8);
}

function loadKeeper(): Keypair {
  const raw = process.env.KEEPER_KEYPAIR;
  if (!raw) throw new Error("KEEPER_KEYPAIR not set in .env");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

async function main() {
  const pdaArg = process.argv[2];
  if (!pdaArg) {
    console.error("Usage: bun run scripts/force-cancel-orphan.ts <subscription-pda>");
    process.exit(1);
  }

  const subPda = new PublicKey(pdaArg);
  const keeper = loadKeeper();

  console.log(`Keeper:           ${keeper.publicKey.toBase58()}`);
  console.log(`Subscription PDA: ${subPda.toBase58()}`);

  // Read the PDA account
  const info = await conn.getAccountInfo(subPda);
  if (!info) {
    console.error("PDA account not found on-chain.");
    process.exit(1);
  }

  // Decode Subscription struct: 8 (disc) + 32 (subscriber) + 32 (merchant) + 8 (plan_seed) + ...
  const data = info.data;
  const subscriber = new PublicKey(data.subarray(8, 40));
  const merchant = new PublicKey(data.subarray(40, 72));
  const planSeed = data.subarray(72, 80);

  console.log(`Subscriber:       ${subscriber.toBase58()}`);
  console.log(`Merchant:         ${merchant.toBase58()}`);
  console.log(`Plan seed:        ${Buffer.from(planSeed).toString("hex")}`);

  // Build force_cancel instruction
  // Accounts: subscription (mut), subscriber (mut, receives rent), merchant, keeper (signer)
  const disc = ixDiscriminator("force_cancel");
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: subPda,     isSigner: false, isWritable: true },
      { pubkey: subscriber, isSigner: false, isWritable: true },
      { pubkey: merchant,   isSigner: false, isWritable: false },
      { pubkey: keeper.publicKey, isSigner: true, isWritable: false },
    ],
    data: disc,
  });

  console.log("\nSending force_cancel transaction...");
  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(conn, tx, [keeper]);
  console.log(`Done! Tx: ${sig}`);
  console.log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  // Verify it's closed
  const after = await conn.getAccountInfo(subPda);
  console.log(`PDA exists after close: ${after !== null}`);
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
