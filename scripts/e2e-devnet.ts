/**
 * Devnet E2E Smoke Test for Recur Protocol
 *
 * Prerequisites:
 *   1. Program deployed to devnet with --features testing
 *   2. Neon Postgres reachable (DATABASE_URL in .env)
 *   3. API server running: bun dev:api
 *   4. .env has KEEPER_KEYPAIR funded with devnet SOL
 *
 * Usage:
 *   bun run scripts/e2e-devnet.ts
 *
 * This script:
 *   1. Creates a mock USDC mint on devnet (6 decimals)
 *   2. Initializes the treasury vault on-chain
 *   3. Funds subscriber with mock USDC
 *   4. Authenticates merchant + subscriber via API
 *   5. Merchant creates app + plan
 *   6. Subscriber creates on-chain subscription (PDA + delegation)
 *   7. Registers subscription in DB via subscriber API
 *   8. Processes first payment instantly on-chain (no interval wait)
 *   9. Reports payment to API (as keeper)
 *  10. Verifies DB state via API
 *  11. Tests cancel flow
 *
 * After successful run, prints env vars to use for keeper testing.
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
import nacl from "tweetnacl";
import bs58 from "bs58";
import crypto from "crypto";

// ── Config ──────────────────────────────────────────────────────────────────

const RPC_URL = "https://api.devnet.solana.com";
const API_URL = process.env.API_URL ?? "http://localhost:3001";
const KEEPER_SECRET = process.env.KEEPER_SECRET ?? "localnet-keeper-secret";
const PROGRAM_ID = new PublicKey("3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx");

/** $5 USDC — above $1 minimum, covers platform fee ($0.05 flat + 0.25%). */
const AMOUNT = 5_000_000;
/** 10 seconds — short enough to test quickly on devnet. */
const INTERVAL = 10;

const conn = new Connection(RPC_URL, "confirmed");

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(step: string, msg: string) {
  console.log(`\n[${step}] ${msg}`);
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`\n  ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

function sha256Disc(name: string): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  );
}

async function airdrop(pubkey: PublicKey, sol = 2) {
  const sig = await conn.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const latest = await conn.getLatestBlockhash();
  await conn.confirmTransaction({ ...latest, signature: sig });
}

/** Transfer SOL from payer to recipient (avoids devnet airdrop rate limits). */
async function fundWallet(payer: Keypair, recipient: PublicKey, sol: number) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient,
      lamports: Math.floor(sol * LAMPORTS_PER_SOL),
    }),
  );
  await sendAndConfirmTransaction(conn, tx, [payer]);
}

function loadKeypair(raw: string): Keypair {
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }
}

async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

async function authenticateWallet(
  keypair: Keypair,
  role: "merchant" | "subscriber",
): Promise<string> {
  const walletAddress = keypair.publicKey.toBase58();
  const nonceRes = await api("POST", "/auth/nonce", { walletAddress, role });
  assert(nonceRes.json["success"] === true, `nonce failed: ${JSON.stringify(nonceRes.json)}`);
  const nonceData = nonceRes.json["data"] as Record<string, unknown>;
  const message = nonceData["message"] as string;
  const nonce = nonceData["nonce"] as string;

  const sig = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
  const verifyRes = await api("POST", "/auth/verify", {
    walletAddress,
    role,
    nonce,
    signature: bs58.encode(sig),
  });
  assert(verifyRes.json["success"] === true, `verify failed: ${JSON.stringify(verifyRes.json)}`);
  return (verifyRes.json["data"] as Record<string, unknown>)["accessToken"] as string;
}

function subscriptionPda(subscriber: PublicKey, merchant: PublicKey, planSeed: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("subscription"), subscriber.toBuffer(), merchant.toBuffer(), planSeed],
    PROGRAM_ID,
  );
}

function treasuryVaultPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury_vault")], PROGRAM_ID);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   Recur Protocol — Devnet E2E Test   ║");
  console.log("╚══════════════════════════════════════╝");

  // Load keeper keypair (also used as payer/mint authority)
  const keeperRaw = process.env.KEEPER_KEYPAIR;
  if (!keeperRaw) {
    console.error("KEEPER_KEYPAIR env var is required");
    process.exit(1);
  }
  const payerKp = loadKeypair(keeperRaw);
  log("0", `Payer/Keeper: ${payerKp.publicKey.toBase58()}`);

  let payerBal = await conn.getBalance(payerKp.publicKey);
  log("0", `Payer balance: ${(payerBal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (payerBal < 0.5 * LAMPORTS_PER_SOL) {
    log("0", "Low balance — requesting airdrop...");
    try {
      await airdrop(payerKp.publicKey, 2);
      payerBal = await conn.getBalance(payerKp.publicKey);
      log("0", `Payer balance after airdrop: ${(payerBal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    } catch (e: any) {
      console.error(`  airdrop failed: ${e.message}`);
      console.error("  Fund the keeper wallet manually: solana airdrop 2 --url devnet");
      process.exit(1);
    }
  }

  // Step 1: Generate merchant + subscriber wallets, fund via SOL transfer
  log("1", "Creating and funding test wallets");
  const merchantKp = Keypair.generate();
  const subscriberKp = Keypair.generate();
  console.log(`  merchant:   ${merchantKp.publicKey.toBase58()}`);
  console.log(`  subscriber: ${subscriberKp.publicKey.toBase58()}`);

  await fundWallet(payerKp, merchantKp.publicKey, 0.05);
  console.log("  merchant funded with 0.05 SOL");
  await fundWallet(payerKp, subscriberKp.publicKey, 0.05);
  console.log("  subscriber funded with 0.05 SOL");

  // Step 2: Create mock USDC mint on devnet
  log("2", "Creating mock USDC mint (6 decimals)");
  const usdcMint = await createMint(conn, payerKp, payerKp.publicKey, null, 6);
  console.log(`  mock USDC mint: ${usdcMint.toBase58()}`);

  // Step 3: Create ATAs and fund subscriber
  log("3", "Creating ATAs and funding subscriber with 1000 mock USDC");
  const subscriberAta = await getOrCreateAssociatedTokenAccount(
    conn, payerKp, usdcMint, subscriberKp.publicKey,
  );
  const merchantAta = await getOrCreateAssociatedTokenAccount(
    conn, payerKp, usdcMint, merchantKp.publicKey,
  );
  await mintTo(conn, payerKp, usdcMint, subscriberAta.address, payerKp, 1_000_000_000);
  console.log("  subscriber ATA funded with 1000 USDC");

  // Step 4: Initialize treasury vault
  log("4", "Initializing treasury vault on-chain");
  const [vaultPda] = treasuryVaultPda();
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true);

  const existingVault = await conn.getAccountInfo(vaultPda);
  if (!existingVault) {
    const initTreasuryIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: usdcMint, isSigner: false, isWritable: false },
        { pubkey: payerKp.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: sha256Disc("initialize_treasury"),
    });
    const sig = await sendAndConfirmTransaction(conn, new Transaction().add(initTreasuryIx), [payerKp]);
    console.log(`  treasury initialized: ${sig}`);
  } else {
    console.log(`  treasury already exists at ${vaultPda.toBase58()}`);
    // Create ATA for our new mint if needed
    const existingAta = await conn.getAccountInfo(vaultAta);
    if (!existingAta) {
      const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
      const createAtaIx = createAssociatedTokenAccountInstruction(
        payerKp.publicKey, vaultAta, vaultPda, usdcMint,
      );
      await sendAndConfirmTransaction(conn, new Transaction().add(createAtaIx), [payerKp]);
      console.log("  created vault ATA for new mock mint");
    }
  }

  // Step 5: Initialize subscription on-chain
  log("5", "Creating subscription on-chain");
  const planSeed = Buffer.alloc(8);
  planSeed.writeBigUInt64LE(1n);

  const [subPda] = subscriptionPda(subscriberKp.publicKey, merchantKp.publicKey, planSeed);
  console.log(`  subscription PDA: ${subPda.toBase58()}`);

  // Delegate tokens to subscription PDA
  await approve(
    conn, subscriberKp, subscriberAta.address, subPda, subscriberKp,
    BigInt(AMOUNT) * 100n, // 100 billing cycles
  );
  console.log("  token delegation approved");

  // Initialize subscription
  const initSubData = Buffer.alloc(32);
  sha256Disc("initialize_subscription").copy(initSubData, 0);
  initSubData.writeBigUInt64LE(BigInt(AMOUNT), 8);
  initSubData.writeBigUInt64LE(BigInt(INTERVAL), 16);
  planSeed.copy(initSubData, 24);

  const initSubIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: subPda, isSigner: false, isWritable: true },
      { pubkey: subscriberKp.publicKey, isSigner: true, isWritable: true },
      { pubkey: merchantKp.publicKey, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: initSubData,
  });
  const subSig = await sendAndConfirmTransaction(conn, new Transaction().add(initSubIx), [subscriberKp]);
  console.log(`  subscription created: ${subSig}`);

  // Step 6: Authenticate via API
  log("6", "Authenticating merchant and subscriber via API");
  const merchantToken = await authenticateWallet(merchantKp, "merchant");
  console.log("  merchant JWT obtained");
  const subscriberToken = await authenticateWallet(subscriberKp, "subscriber");
  console.log("  subscriber JWT obtained");

  // Step 7: Merchant creates app + plan
  log("7", "Merchant creates app and plan via API");
  const merchantAuth = { Authorization: `Bearer ${merchantToken}` };

  const appRes = await api("POST", "/merchant/apps", { name: "E2E Test App" }, merchantAuth);
  assert(appRes.json["success"] === true, `create app failed: ${JSON.stringify(appRes.json)}`);
  const appId = (appRes.json["data"] as Record<string, unknown>)["id"] as string;
  console.log(`  app: ${appId}`);

  const planRes = await api("POST", `/merchant/apps/${appId}/plans`, {
    name: "E2E Test Plan",
    description: "5 USDC every 10 seconds for E2E testing",
    amountBaseUnits: AMOUNT.toString(),
    intervalSeconds: INTERVAL,
  }, merchantAuth);
  assert(planRes.json["success"] === true, `create plan failed: ${JSON.stringify(planRes.json)}`);
  const planId = (planRes.json["data"] as Record<string, unknown>)["id"] as string;
  console.log(`  plan: ${planId}`);

  // Step 8: Subscriber registers subscription in DB
  log("8", "Subscriber registers subscription via API");
  const subscriberAuth = { Authorization: `Bearer ${subscriberToken}` };

  const regRes = await api("POST", "/subscriber/subscriptions", {
    planId,
    subscriptionPda: subPda.toBase58(),
  }, subscriberAuth);
  assert(regRes.json["success"] === true, `register sub failed: ${JSON.stringify(regRes.json)}`);
  const subscriptionId = (regRes.json["data"] as Record<string, unknown>)["id"] as string;
  console.log(`  subscription DB id: ${subscriptionId}`);

  // Step 9: Process first payment on-chain (instant — no wait needed)
  // With the fix, last_payment_timestamp = now - interval, so payment is immediately due
  log("9", "Processing first payment on-chain (instant, no interval wait)");
  // Small delay for clock consistency
  await new Promise((r) => setTimeout(r, 2000));

  log("9", "Processing payment on-chain (simulating keeper)");
  const processPaymentIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: subPda, isSigner: false, isWritable: true },
      { pubkey: subscriberKp.publicKey, isSigner: false, isWritable: false },
      { pubkey: merchantKp.publicKey, isSigner: false, isWritable: false },
      { pubkey: subscriberAta.address, isSigner: false, isWritable: true },
      { pubkey: merchantAta.address, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: usdcMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: payerKp.publicKey, isSigner: true, isWritable: false },
    ],
    data: sha256Disc("process_payment"),
  });

  const paymentSig = await sendAndConfirmTransaction(
    conn, new Transaction().add(processPaymentIx), [payerKp],
  );
  console.log(`  payment tx: ${paymentSig}`);

  // Calculate fees
  const gross = BigInt(AMOUNT);
  const percentFee = (gross * 25n) / 10_000n;
  const platformFee = 50_000n + percentFee;
  const net = gross - platformFee;
  console.log(`  gross: ${gross}, fee: ${platformFee}, net: ${net}`);

  // Step 10: Report payment to API
  log("10", "Reporting payment to API (as keeper)");
  const keeperHeaders = { "X-Keeper-Secret": KEEPER_SECRET };
  const reportRes = await api("POST", "/keeper/payment", {
    subscriptionPda: subPda.toBase58(),
    txSignature: paymentSig,
    amountGross: gross.toString(),
    platformFee: platformFee.toString(),
    amountNet: net.toString(),
    confirmedAt: new Date().toISOString(),
  }, keeperHeaders);
  assert(reportRes.json["success"] === true, `payment report failed: ${JSON.stringify(reportRes.json)}`);
  console.log("  payment reported to API");

  // Step 11: Verify state via API
  log("11", "Verifying state via API");
  const subsRes = await api("GET", "/subscriber/subscriptions", undefined, subscriberAuth);
  assert(subsRes.json["success"] === true, "list subs failed");
  const subs = subsRes.json["data"] as Array<Record<string, unknown>>;
  console.log(`  subscriptions response:`, JSON.stringify(subs.map(s => ({ id: s["id"], status: s["status"], isActive: s["isActive"] })), null, 2));
  assert(subs.length >= 1, `Expected >=1 subscription, got ${subs.length}`);
  const subRecord = subs.find((s) => s["id"] === subscriptionId)!;
  assert(subRecord != null, "subscription not found in list");
  const isActive = subRecord["isActive"] ?? subRecord["status"] === "active";
  assert(isActive, `subscription should be active, got status=${subRecord["status"]} isActive=${subRecord["isActive"]}`);
  console.log(`  subscription is active, status=${subRecord["status"]}`);

  const txRes = await api(
    "GET",
    `/subscriber/subscriptions/${subscriptionId}/transactions`,
    undefined,
    subscriberAuth,
  );
  assert(txRes.json["success"] === true, "list txs failed");
  const txs = txRes.json["data"] as Array<Record<string, unknown>>;
  assert(txs.length >= 1, `Expected >=1 transaction, got ${txs.length}`);
  assert(txs[0]!["txSignature"] === paymentSig, "tx signature mismatch");
  console.log(`  transaction verified: ${paymentSig}`);

  // Step 12: Test cancel flow
  log("12", "Testing cancel flow");
  const cancelRes = await api("POST", "/keeper/cancel", {
    subscriptionPda: subPda.toBase58(),
    cancelType: "request",
    confirmedAt: new Date().toISOString(),
  }, keeperHeaders);
  assert(cancelRes.json["success"] === true, `cancel request failed: ${JSON.stringify(cancelRes.json)}`);

  const subAfterCancel = await api(
    "GET", `/subscriber/subscriptions/${subscriptionId}`, undefined, subscriberAuth,
  );
  const cancelData = subAfterCancel.json["data"] as Record<string, unknown>;
  assert(cancelData["cancelRequestedAt"] !== null, "cancelRequestedAt should be set");
  console.log(`  cancel requested at ${cancelData["cancelRequestedAt"]}`);

  const finalizeRes = await api("POST", "/keeper/cancel", {
    subscriptionPda: subPda.toBase58(),
    cancelType: "finalize",
    confirmedAt: new Date().toISOString(),
  }, keeperHeaders);
  assert(finalizeRes.json["success"] === true, `finalize cancel failed: ${JSON.stringify(finalizeRes.json)}`);

  const subFinal = await api(
    "GET", `/subscriber/subscriptions/${subscriptionId}`, undefined, subscriberAuth,
  );
  const finalData = subFinal.json["data"] as Record<string, unknown>;
  console.log(`  final state:`, JSON.stringify({ status: finalData["status"], isActive: finalData["isActive"], cancelRequestedAt: finalData["cancelRequestedAt"] }));
  const isCancelled = finalData["status"] === "cancelled" || finalData["isActive"] === false;
  assert(isCancelled, `subscription should be inactive after finalize, got status=${finalData["status"]}`);
  console.log(`  subscription finalized — status: ${finalData["status"]}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║            ALL E2E TESTS PASSED                         ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log("--- Test Artifacts ---");
  console.log(`  Mock USDC Mint:   ${usdcMint.toBase58()}`);
  console.log(`  Treasury Vault:   ${vaultPda.toBase58()}`);
  console.log(`  Merchant Wallet:  ${merchantKp.publicKey.toBase58()}`);
  console.log(`  Subscriber:       ${subscriberKp.publicKey.toBase58()}`);
  console.log(`  Subscription PDA: ${subPda.toBase58()}`);
  console.log(`  Payment TX:       ${paymentSig}`);
  console.log(`  Gross: ${gross}, Fee: ${platformFee}, Net: ${net}`);
  console.log("\n--- To test keeper auto-processing, update .env: ---");
  console.log(`  USDC_MINT=${usdcMint.toBase58()}`);
  console.log("--- Then restart keeper: bun dev:keeper ---\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("\nE2E FAILED:", err);
  process.exit(1);
});
