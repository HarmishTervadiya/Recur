/**
 * Localnet end-to-end seed script.
 *
 * Prerequisites:
 *   1. `solana-test-validator` running (default: http://127.0.0.1:8899)
 *   2. Program deployed:  anchor build --features testing && anchor deploy
 *   3. Postgres running with DATABASE_URL set
 *
 * Usage:
 *   bun seed:localnet
 *
 * After it runs, copy the printed env vars into your .env, then start:
 *   bun dev:api   (in one terminal)
 *   bun dev:keeper (in another terminal)
 *
 * The keeper will fire its first process_payment ~60 s after the cron tick.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  approve,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { prisma } from "@recur/db";
import {
  PROGRAM_ID,
  findSubscriptionPda,
  findTreasuryVaultPda,
} from "@recur/solana-client";

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
/** $5.00 USDC — large enough to cover the $0.05 + 0.25% platform fee. */
const AMOUNT = 5_000_000n;
/** 60 s interval — quick enough to observe without waiting hours. */
const INTERVAL = 60n;
/** Mint 100 USDC to the subscriber so they can be billed multiple times. */
const INITIAL_USDC = 100_000_000;

// ── Instruction discriminators (from contracts/target/idl/recur.json) ─────────

const INIT_TREASURY_DISCRIMINATOR = Buffer.from([
  124, 186, 211, 195, 85, 165, 129, 166,
]);
const INIT_SUBSCRIPTION_DISCRIMINATOR = Buffer.from([
  208, 156, 144, 38, 56, 65, 152, 18,
]);

const DEFAULT_PLAN_SEED = Buffer.alloc(8);
DEFAULT_PLAN_SEED.writeBigUInt64LE(BigInt(1));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function airdrop(
  connection: Connection,
  pubkey: PublicKey,
  sol = 2,
): Promise<void> {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ ...latest, signature: sig });
  console.log(`  airdropped ${sol} SOL → ${pubkey.toBase58()}`);
}

function buildInitTreasuryIx(
  treasuryVault: PublicKey,
  treasuryVaultAta: PublicKey,
  mint: PublicKey,
  initializer: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: treasuryVault, isSigner: false, isWritable: true },
      { pubkey: treasuryVaultAta, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: initializer, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: INIT_TREASURY_DISCRIMINATOR,
  });
}

function buildInitSubscriptionIx(
  subscriptionPda: PublicKey,
  subscriber: PublicKey,
  merchant: PublicKey,
  amount: bigint,
  interval: bigint,
  planSeed: Buffer,
): TransactionInstruction {
  const data = Buffer.alloc(8 + 8 + 8 + 8);
  INIT_SUBSCRIPTION_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);
  data.writeBigUInt64LE(interval, 16);
  planSeed.copy(data, 24);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: subscriptionPda, isSigner: false, isWritable: true },
      { pubkey: subscriber, isSigner: true, isWritable: true },
      { pubkey: merchant, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function loadOrGenerateKeypair(envVar: string | undefined, label: string): [Keypair, boolean] {
  if (envVar) {
    try {
      return [Keypair.fromSecretKey(bs58.decode(envVar)), true];
    } catch {
      return [Keypair.fromSecretKey(Uint8Array.from(JSON.parse(envVar))), true];
    }
  }
  const kp = Keypair.generate();
  console.log(`  Generated ${label}: ${kp.publicKey.toBase58()}`);
  return [kp, false];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n=== Recur Localnet Seed ===\n");
  console.log(`RPC: ${RPC_URL}\n`);

  const connection = new Connection(RPC_URL, "confirmed");

  // ── Keypairs ────────────────────────────────────────────────────────────────
  const [payerKeypair, keeperLoaded] = loadOrGenerateKeypair(
    process.env.KEEPER_KEYPAIR,
    "keeper/payer",
  );
  if (keeperLoaded) {
    console.log(`  Loaded keeper from env: ${payerKeypair.publicKey.toBase58()}`);
  }
  const merchantKeypair = Keypair.generate();
  const subscriberKeypair = Keypair.generate();
  console.log(`  merchant:   ${merchantKeypair.publicKey.toBase58()}`);
  console.log(`  subscriber: ${subscriberKeypair.publicKey.toBase58()}`);

  // ── Airdrop SOL ─────────────────────────────────────────────────────────────
  console.log("\nAirdropping SOL...");
  await airdrop(connection, payerKeypair.publicKey, 5);
  await airdrop(connection, merchantKeypair.publicKey, 2);
  await airdrop(connection, subscriberKeypair.publicKey, 1);

  // ── Mock USDC mint ──────────────────────────────────────────────────────────
  console.log("\nCreating mock USDC mint...");
  const usdcMint = await createMint(
    connection,
    payerKeypair,
    payerKeypair.publicKey, // mint authority
    null,                   // freeze authority
    6,                      // decimals (same as real USDC)
  );
  console.log(`  mint: ${usdcMint.toBase58()}`);

  // ── Token accounts ──────────────────────────────────────────────────────────
  console.log("\nCreating ATAs...");
  const subscriberAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payerKeypair,
    usdcMint,
    subscriberKeypair.publicKey,
  );
  await getOrCreateAssociatedTokenAccount(
    connection,
    payerKeypair,
    usdcMint,
    merchantKeypair.publicKey,
  );
  console.log("  subscriber and merchant ATAs ready.");

  // ── Fund subscriber ─────────────────────────────────────────────────────────
  console.log(`\nMinting ${INITIAL_USDC / 1_000_000} USDC to subscriber...`);
  await mintTo(
    connection,
    payerKeypair,
    usdcMint,
    subscriberAta.address,
    payerKeypair,
    INITIAL_USDC,
  );
  console.log("  done.");

  // ── Initialize treasury (bypasses multisig when built with --features testing) ──
  console.log("\nInitializing treasury...");
  const [vaultPda] = findTreasuryVaultPda();
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true);
  try {
    const tx = new Transaction().add(
      buildInitTreasuryIx(vaultPda, vaultAta, usdcMint, payerKeypair.publicKey),
    );
    await sendAndConfirmTransaction(connection, tx, [payerKeypair]);
    console.log("  treasury vault initialized.");
  } catch (e: any) {
    const logs: string[] = e.logs ?? [];
    if (logs.some((l) => l.includes("already in use"))) {
      console.log("  treasury already initialized — skipping.");
    } else {
      throw e;
    }
  }

  // ── Approve delegation: subscriber ATA → subscription PDA ──────────────────
  const [subPda] = findSubscriptionPda(
    subscriberKeypair.publicKey,
    merchantKeypair.publicKey,
    DEFAULT_PLAN_SEED,
  );
  console.log(`\nDelegating subscriber tokens to PDA: ${subPda.toBase58()}`);
  await approve(
    connection,
    payerKeypair,
    subscriberAta.address,
    subPda,            // delegate
    subscriberKeypair, // token account owner
    AMOUNT * 12n,      // 12 billing cycles worth
  );
  console.log("  delegation approved.");

  // ── Initialize subscription on-chain ────────────────────────────────────────
  console.log("\nInitializing subscription on-chain...");
  const initSubTx = new Transaction().add(
    buildInitSubscriptionIx(
      subPda,
      subscriberKeypair.publicKey,
      merchantKeypair.publicKey,
      AMOUNT,
      INTERVAL,
      DEFAULT_PLAN_SEED,
    ),
  );
  await sendAndConfirmTransaction(connection, initSubTx, [
    payerKeypair,
    subscriberKeypair,
  ]);
  console.log(`  subscription PDA: ${subPda.toBase58()}`);

  // ── Database seed ───────────────────────────────────────────────────────────
  console.log("\nSeeding database...");

  const merchantRecord = await prisma.merchant.upsert({
    where: { walletAddress: merchantKeypair.publicKey.toBase58() },
    create: {
      walletAddress: merchantKeypair.publicKey.toBase58(),
      name: "Localnet Test Merchant",
    },
    update: {},
  });

  const app = await prisma.app.create({
    data: { merchantId: merchantRecord.id, name: "Localnet Test App" },
  });

  const plan = await prisma.plan.create({
    data: {
      appId: app.id,
      name: "Localnet Test Plan",
      amountBaseUnits: AMOUNT,
      intervalSeconds: Number(INTERVAL),
      currency: "USDC",
    },
  });

  const subscriberRecord = await prisma.subscriber.upsert({
    where: { walletAddress: subscriberKeypair.publicKey.toBase58() },
    create: { walletAddress: subscriberKeypair.publicKey.toBase58() },
    update: {},
  });

  const subscription = await prisma.subscription.create({
    data: {
      planId: plan.id,
      subscriberId: subscriberRecord.id,
      subscriptionPda: subPda.toBase58(),
    },
  });

  await prisma.$disconnect();
  console.log("  DB records created.");

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  SEED COMPLETE — add these to your .env                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`SOLANA_RPC_URL=http://127.0.0.1:8899`);
  console.log(`USDC_MINT=${usdcMint.toBase58()}`);
  if (!keeperLoaded) {
    console.log(`KEEPER_KEYPAIR=${bs58.encode(payerKeypair.secretKey)}`);
  }
  console.log(`\nSubscription DB id : ${subscription.id}`);
  console.log(`Subscription PDA   : ${subPda.toBase58()}`);
  console.log(
    `\nKeeper will fire its first process_payment in ~${INTERVAL}s after the next cron tick.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
