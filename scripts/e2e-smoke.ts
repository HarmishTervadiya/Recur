/**
 * E2E Smoke Test for Recur Protocol
 *
 * Prerequisites:
 *   1. solana-test-validator running with program deployed (--features testing)
 *   2. PostgreSQL running (docker) with schema pushed
 *   3. API server running: cd apps/api && bun run src/index.ts
 *
 * Usage:
 *   npx tsx scripts/e2e-smoke.ts
 *
 * This script:
 *   1. Creates a USDC mint on localnet
 *   2. Initializes the treasury vault on-chain
 *   3. Creates merchant + subscriber wallets, funds them
 *   4. Authenticates both via the API (nonce → sign → verify → JWT)
 *   5. Merchant creates an app + plan
 *   6. Subscriber initializes subscription on-chain
 *   7. Registers subscription in the DB via the subscriber API
 *   8. Reports a keeper payment via the keeper API endpoint
 *   9. Verifies DB state via API queries
 *  10. Tests cancellation flow
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  approve,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import nacl from "tweetnacl";
import bs58 from "bs58";
import crypto from "crypto";

const RPC_URL = "http://localhost:8899";
const API_URL = "http://localhost:3001";
const KEEPER_SECRET = "localnet-keeper-secret";
const PROGRAM_ID = new PublicKey("3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx");

const AMOUNT = 1_000_000_000; // $1000 USDC (6 decimals)
const INTERVAL = 5; // 5 seconds

const conn = new Connection(RPC_URL, "confirmed");

function log(step: string, msg: string) {
  console.log(`\n[${step}] ${msg}`);
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

async function airdrop(pubkey: PublicKey, sol = 2) {
  const sig = await conn.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const latest = await conn.getLatestBlockhash();
  await conn.confirmTransaction({
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    signature: sig,
  });
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

const DEFAULT_PLAN_SEED = Buffer.alloc(8);
DEFAULT_PLAN_SEED.writeBigUInt64LE(BigInt(1));

function subscriptionPda(subscriber: PublicKey, merchant: PublicKey, planSeed: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("subscription"), subscriber.toBuffer(), merchant.toBuffer(), planSeed],
    PROGRAM_ID,
  );
}

function treasuryVaultPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury_vault")], PROGRAM_ID);
}

function sha256Discriminator(name: string): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  );
}

async function authenticateWallet(
  keypair: Keypair,
  role: "merchant" | "subscriber",
): Promise<string> {
  const walletAddress = keypair.publicKey.toBase58();

  const nonceRes = await api("POST", "/auth/nonce", { walletAddress, role });
  assert(nonceRes.json["success"] === true, `nonce request failed: ${JSON.stringify(nonceRes.json)}`);
  const nonceData = nonceRes.json["data"] as Record<string, unknown>;
  const message = nonceData["message"] as string;
  const nonce = nonceData["nonce"] as string;

  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureB58 = bs58.encode(signature);

  const verifyRes = await api("POST", "/auth/verify", {
    walletAddress,
    role,
    nonce,
    signature: signatureB58,
  });
  assert(verifyRes.json["success"] === true, `verify failed: ${JSON.stringify(verifyRes.json)}`);
  const verifyData = verifyRes.json["data"] as Record<string, unknown>;
  return verifyData["token"] as string;
}

async function main() {
  log("0", "Starting E2E smoke test");

  // Step 1: Create wallets and mint
  log("1", "Creating wallets and USDC mint");
  const mintAuthority = Keypair.generate();
  const merchantKp = Keypair.generate();
  const subscriberKp = Keypair.generate();
  const keeperKp = Keypair.generate();

  await airdrop(mintAuthority.publicKey, 5);
  await airdrop(merchantKp.publicKey, 5);
  await airdrop(subscriberKp.publicKey, 5);
  await airdrop(keeperKp.publicKey, 5);

  const usdcMint = await createMint(conn, mintAuthority, mintAuthority.publicKey, null, 6);
  log("1", `USDC Mint: ${usdcMint.toBase58()}`);

  // Step 2: Initialize treasury vault (skip if already exists)
  log("2", "Initializing treasury vault on-chain");
  const [vaultPda] = treasuryVaultPda();
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true);

  const existingVault = await conn.getAccountInfo(vaultPda);
  if (!existingVault) {
    const initTreasuryDisc = sha256Discriminator("initialize_treasury");
    const initTreasuryIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: usdcMint, isSigner: false, isWritable: false },
        { pubkey: mintAuthority.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      data: initTreasuryDisc,
    });

    const initTx = new Transaction().add(initTreasuryIx);
    const initSig = await sendAndConfirmTransaction(conn, initTx, [mintAuthority]);
    log("2", `Treasury vault initialized: ${initSig}`);
  } else {
    log("2", `Treasury vault already exists at ${vaultPda.toBase58()}`);
    // Create ATA for our new mint if it doesn't exist
    const existingAta = await conn.getAccountInfo(vaultAta);
    if (!existingAta) {
      const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
      const createAtaIx = createAssociatedTokenAccountInstruction(
        mintAuthority.publicKey, vaultAta, vaultPda, usdcMint,
      );
      const ataTx = new Transaction().add(createAtaIx);
      await sendAndConfirmTransaction(conn, ataTx, [mintAuthority]);
      log("2", `Created vault ATA for new mint`);
    }
  }

  // Step 3: Create token accounts and fund subscriber
  log("3", "Creating token accounts and funding subscriber");
  const subscriberAta = await getOrCreateAssociatedTokenAccount(
    conn, subscriberKp, usdcMint, subscriberKp.publicKey,
  );
  const merchantAta = await getOrCreateAssociatedTokenAccount(
    conn, merchantKp, usdcMint, merchantKp.publicKey,
  );

  await mintTo(conn, mintAuthority, usdcMint, subscriberAta.address, mintAuthority, 5_000_000_000);
  log("3", `Subscriber funded with 5000 USDC`);

  // Step 4: Initialize subscription on-chain
  log("4", "Initializing subscription on-chain");
  const [subPda] = subscriptionPda(subscriberKp.publicKey, merchantKp.publicKey, DEFAULT_PLAN_SEED);

  // Delegate to subscription PDA first
  await approve(conn, subscriberKp, subscriberAta.address, subPda, subscriberKp, AMOUNT * 10);

  const initSubDisc = sha256Discriminator("initialize_subscription");
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(BigInt(AMOUNT));
  const intervalBuf = Buffer.alloc(8);
  intervalBuf.writeBigUInt64LE(BigInt(INTERVAL));
  const planSeedArray = Buffer.from(Array.from(DEFAULT_PLAN_SEED));

  const initSubIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: subPda, isSigner: false, isWritable: true },
      { pubkey: subscriberKp.publicKey, isSigner: true, isWritable: true },
      { pubkey: merchantKp.publicKey, isSigner: false, isWritable: false },
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([initSubDisc, amountBuf, intervalBuf, planSeedArray]),
  });

  const subTx = new Transaction().add(initSubIx);
  const subSig = await sendAndConfirmTransaction(conn, subTx, [subscriberKp]);
  log("4", `Subscription PDA: ${subPda.toBase58()} | tx: ${subSig}`);

  // Step 5: Authenticate via API
  log("5", "Authenticating merchant and subscriber via API");
  const merchantToken = await authenticateWallet(merchantKp, "merchant");
  log("5", `Merchant JWT obtained`);
  const subscriberToken = await authenticateWallet(subscriberKp, "subscriber");
  log("5", `Subscriber JWT obtained`);

  // Step 6: Merchant creates app + plan
  log("6", "Merchant creates app and plan");
  const merchantAuth = { Authorization: `Bearer ${merchantToken}` };

  const appRes = await api("POST", "/merchant/apps", { name: "Test App" }, merchantAuth);
  assert(appRes.json["success"] === true, `create app failed: ${JSON.stringify(appRes.json)}`);
  const appData = (appRes.json["data"] as Record<string, unknown>);
  const appId = appData["id"] as string;
  log("6", `App created: ${appId}`);

  const planRes = await api("POST", `/merchant/apps/${appId}/plans`, {
    name: "Pro Monthly",
    description: "Pro subscription plan",
    amountBaseUnits: AMOUNT.toString(),
    intervalSeconds: INTERVAL,
  }, merchantAuth);
  assert(planRes.json["success"] === true, `create plan failed: ${JSON.stringify(planRes.json)}`);
  const planData = (planRes.json["data"] as Record<string, unknown>);
  const planId = planData["id"] as string;
  log("6", `Plan created: ${planId}`);

  // Step 7: Subscriber registers subscription via API
  log("7", "Subscriber registers subscription in DB");
  const subscriberAuth = { Authorization: `Bearer ${subscriberToken}` };

  const regRes = await api("POST", "/subscriber/subscriptions", {
    planId,
    subscriptionPda: subPda.toBase58(),
  }, subscriberAuth);
  assert(regRes.json["success"] === true, `register sub failed: ${JSON.stringify(regRes.json)}`);
  const regData = (regRes.json["data"] as Record<string, unknown>);
  const subscriptionId = regData["id"] as string;
  log("7", `Subscription registered: ${subscriptionId}`);

  // Step 8: Wait for interval then simulate a keeper payment
  log("8", `Waiting ${INTERVAL + 2}s for billing interval to elapse...`);
  await new Promise((r) => setTimeout(r, (INTERVAL + 2) * 1000));

  // Process payment on-chain
  log("8", "Processing payment on-chain (simulating keeper)");
  const processPaymentDisc = sha256Discriminator("process_payment");
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
      { pubkey: keeperKp.publicKey, isSigner: true, isWritable: false },
    ],
    data: processPaymentDisc,
  });

  const paymentTx = new Transaction().add(processPaymentIx);
  const paymentSig = await sendAndConfirmTransaction(conn, paymentTx, [keeperKp]);
  log("8", `Payment tx: ${paymentSig}`);

  // Calculate expected fee
  const grossAmount = BigInt(AMOUNT);
  const percentFee = (grossAmount * 25n) / 10_000n;
  const platformFee = 50_000n + percentFee;
  const netAmount = grossAmount - platformFee;

  // Step 9: Report payment to API (as keeper)
  log("9", "Reporting payment result to API");
  const keeperHeaders = { "X-Keeper-Secret": KEEPER_SECRET };
  const reportRes = await api("POST", "/keeper/payment", {
    subscriptionPda: subPda.toBase58(),
    txSignature: paymentSig,
    amountGross: grossAmount.toString(),
    platformFee: platformFee.toString(),
    amountNet: netAmount.toString(),
    confirmedAt: new Date().toISOString(),
  }, keeperHeaders);
  assert(reportRes.json["success"] === true, `payment report failed: ${JSON.stringify(reportRes.json)}`);
  log("9", `Payment reported successfully`);

  // Step 10: Verify state via API
  log("10", "Verifying state via API queries");

  const subsRes = await api("GET", "/subscriber/subscriptions", undefined, subscriberAuth);
  assert(subsRes.json["success"] === true, `list subs failed`);
  const subs = (subsRes.json["data"] as Array<Record<string, unknown>>);
  assert(subs.length === 1, `Expected 1 subscription, got ${subs.length}`);
  const subRecord = subs[0]!;
  assert(subRecord["isActive"] === true, "Subscription should be active");
  assert(subRecord["lastPaymentAt"] !== null, "lastPaymentAt should be set");
  log("10", `Subscription is active with lastPaymentAt set`);

  const txRes = await api(
    "GET",
    `/subscriber/subscriptions/${subscriptionId}/transactions`,
    undefined,
    subscriberAuth,
  );
  assert(txRes.json["success"] === true, `list txs failed`);
  const txs = (txRes.json["data"] as Array<Record<string, unknown>>);
  assert(txs.length === 1, `Expected 1 transaction, got ${txs.length}`);
  assert(txs[0]!["status"] === "success", "Transaction should be success");
  assert(txs[0]!["txSignature"] === paymentSig, "Transaction signature should match");
  log("10", `Transaction recorded: ${txs[0]!["txSignature"]}`);

  // Step 11: Merchant verifies app transactions
  log("11", "Merchant verifies transactions");
  const merchantTxRes = await api("GET", `/merchant/apps/${appId}/transactions`, undefined, merchantAuth);
  if (merchantTxRes.json["success"] !== true) {
    console.error("Merchant tx response:", JSON.stringify(merchantTxRes.json, null, 2));
  }
  assert(merchantTxRes.json["success"] === true, `merchant tx list failed`);
  const merchantTxs = (merchantTxRes.json["data"] as Array<Record<string, unknown>>);
  assert(merchantTxs.length === 1, `Expected 1 merchant tx, got ${merchantTxs.length}`);
  log("11", `Merchant sees 1 transaction with gross=${merchantTxs[0]!["amountGross"]}, fee=${merchantTxs[0]!["platformFee"]}, net=${merchantTxs[0]!["amountNet"]}`);

  // Step 12: Test cancel flow via keeper API
  log("12", "Testing cancel flow");
  const cancelRes = await api("POST", "/keeper/cancel", {
    subscriptionPda: subPda.toBase58(),
    cancelType: "request",
    confirmedAt: new Date().toISOString(),
  }, keeperHeaders);
  assert(cancelRes.json["success"] === true, `cancel report failed`);

  // Verify cancel state
  const subAfterCancel = await api("GET", `/subscriber/subscriptions/${subscriptionId}`, undefined, subscriberAuth);
  assert(subAfterCancel.json["success"] === true, `get sub failed`);
  const cancelData = subAfterCancel.json["data"] as Record<string, unknown>;
  assert(cancelData["cancelRequestedAt"] !== null, "cancelRequestedAt should be set");
  assert(cancelData["isActive"] === true, "Should still be active (pending cancel)");
  log("12", `Cancel requested at ${cancelData["cancelRequestedAt"]}`);

  // Finalize cancel
  const finalizeCancelRes = await api("POST", "/keeper/cancel", {
    subscriptionPda: subPda.toBase58(),
    cancelType: "finalize",
    confirmedAt: new Date().toISOString(),
  }, keeperHeaders);
  assert(finalizeCancelRes.json["success"] === true, `finalize cancel failed`);

  const subFinal = await api("GET", `/subscriber/subscriptions/${subscriptionId}`, undefined, subscriberAuth);
  const finalData = subFinal.json["data"] as Record<string, unknown>;
  assert(finalData["isActive"] === false, "Subscription should be inactive after finalize");
  log("12", `Subscription finalized — isActive: ${finalData["isActive"]}`);

  // Done
  log("DONE", "All E2E smoke tests passed!");

  console.log("\n--- Summary ---");
  console.log(`  USDC Mint:        ${usdcMint.toBase58()}`);
  console.log(`  Treasury Vault:   ${vaultPda.toBase58()}`);
  console.log(`  Merchant Wallet:  ${merchantKp.publicKey.toBase58()}`);
  console.log(`  Subscriber:       ${subscriberKp.publicKey.toBase58()}`);
  console.log(`  Subscription PDA: ${subPda.toBase58()}`);
  console.log(`  Payment TX:       ${paymentSig}`);
  console.log(`  Gross: ${grossAmount}, Fee: ${platformFee}, Net: ${netAmount}`);
  console.log("--- Done ---\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
