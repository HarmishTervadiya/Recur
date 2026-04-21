/**
 * demo-show.ts — The script you run LIVE on camera during recording.
 *
 * Creates a fully isolated demo each time:
 *   - Fresh merchant wallet (0 USDC)
 *   - Fresh subscriber wallet (100 USDC)
 *   - Fresh app + plan in DB
 *   - Subscription on-chain + in DB
 *   - Waits for Keeper to fire, shows BEFORE/AFTER
 *
 * The treasury is shared (accumulates across runs), but we display
 * the DELTA, not the absolute balance, so it always shows cleanly.
 *
 * Prerequisites:
 *   - solana-test-validator running
 *   - bun run apps/api/src/index.ts running
 *   - bun run apps/keeper/src/index.ts running
 *   - bun run demo:seed run once this session (sets USDC_MINT + mint authority)
 *
 * Usage:
 *   bun run demo:show
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
import fs from "fs";
import path from "path";

const RPC_URL = "http://127.0.0.1:8899";
const API_URL = "http://localhost:3001";
const PROGRAM_ID = new PublicKey("Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj");

const DEFAULT_PLAN_SEED = Buffer.alloc(8);
DEFAULT_PLAN_SEED.writeBigUInt64LE(BigInt(1));

const AMOUNT = 10_000_000n;  // $10.00 USDC
const INTERVAL = 15;          // 15 seconds
const conn = new Connection(RPC_URL, "confirmed");

// ─── helpers ────────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env");
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  const result: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    result[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim();
  }
  return result;
}

function requireEnv(env: Record<string, string>, key: string): string {
  const val = env[key];
  if (!val) {
    console.error(`\n[demo-show] ERROR: ${key} not found in .env — run \`bun run demo:seed\` first.\n`);
    process.exit(1);
  }
  return val;
}

async function airdrop(pubkey: PublicKey, sol = 5) {
  const sig = await conn.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const latest = await conn.getLatestBlockhash("finalized");
  await conn.confirmTransaction({
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    signature: sig,
  });
}

async function send(tx: Transaction, signers: Keypair[]): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = signers[0]!.publicKey;
  return sendAndConfirmTransaction(conn, tx, signers, {
    commitment: "confirmed",
    maxRetries: 5,
  });
}

async function apiCall(
  method: string,
  p: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${p}`, opts);
  return (await res.json()) as Record<string, unknown>;
}

function sha256Disc(name: string): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  );
}

async function authenticateWallet(kp: Keypair, role: "merchant" | "subscriber"): Promise<string> {
  const wallet = kp.publicKey.toBase58();
  const r1 = await apiCall("POST", "/auth/nonce", { walletAddress: wallet, role });
  const d1 = r1["data"] as Record<string, unknown>;
  const message = d1["message"] as string;
  const nonce = d1["nonce"] as string;
  const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
  const r2 = await apiCall("POST", "/auth/verify", {
    walletAddress: wallet, role, nonce, signature: bs58.encode(sig),
  });
  return ((r2["data"] as Record<string, unknown>)["token"] as string);
}

async function getUSDCBalance(ata: PublicKey): Promise<number> {
  try {
    const info = await conn.getTokenAccountBalance(ata);
    return Number(info.value.uiAmount ?? 0);
  } catch {
    return 0;
  }
}

function printBalanceTable(label: string, sub: number, mer: number, tres: number) {
  const w = 48;
  const line = "─".repeat(w);
  console.log(`\n┌${line}┐`);
  console.log(`│  ${label.padEnd(w - 2)}│`);
  console.log(`├${line}┤`);
  console.log(`│  Subscriber   ${sub.toFixed(2).padStart(10)} USDC                  │`);
  console.log(`│  Merchant     ${mer.toFixed(2).padStart(10)} USDC                  │`);
  console.log(`│  Treasury     ${tres.toFixed(2).padStart(10)} USDC                  │`);
  console.log(`└${line}┘\n`);
}

function upsertEnvFile(content: string, key: string, value: string): string {
  const re = new RegExp(`^${key}=.*`, "m");
  return re.test(content)
    ? content.replace(re, `${key}=${value}`)
    : content + `\n${key}=${value}`;
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  const envVars = loadEnv();

  const usdcMintStr = requireEnv(envVars, "USDC_MINT");
  if (usdcMintStr === "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU") {
    console.error("\n[demo-show] ERROR: USDC_MINT is still the devnet default — run `bun run demo:seed` first.\n");
    process.exit(1);
  }
  const usdcMint = new PublicKey(usdcMintStr);

  const mintAuthority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(requireEnv(envVars, "MINT_AUTHORITY_SECRET"))),
  );

  // Treasury vault ATA (shared, but we track delta)
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_vault")], PROGRAM_ID,
  );
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true);

  // ── 0.5. Deactivate all previous subscriptions so only ours gets processed
  console.log("\n[demo-show] Deactivating previous subscriptions...");
  const { execSync } = await import("child_process");
  try {
    execSync(
      `docker exec recur-postgres psql -U postgres -d recur -c "UPDATE subscriptions SET is_active = false WHERE is_active = true"`,
      { stdio: "pipe" },
    );
  } catch {
    console.error("[demo-show] WARNING: Could not deactivate old subs — treasury delta may be off.");
  }

  // ── 1. Create FRESH merchant + subscriber ──────────────────────────────
  console.log("[demo-show] Creating fresh wallets...");
  const merchantKp = Keypair.generate();
  const subscriberKp = Keypair.generate();

  await airdrop(merchantKp.publicKey, 5);
  await airdrop(subscriberKp.publicKey, 5);

  // Create token accounts for both
  const subscriberAta = await getOrCreateAssociatedTokenAccount(
    conn, subscriberKp, usdcMint, subscriberKp.publicKey,
  );
  const merchantAta = await getOrCreateAssociatedTokenAccount(
    conn, merchantKp, usdcMint, merchantKp.publicKey,
  );

  // Mint exactly 100 USDC to subscriber
  await mintTo(conn, mintAuthority, usdcMint, subscriberAta.address, mintAuthority, 100_000_000);

  // ── 2. Register merchant + app + plan in DB ────────────────────────────
  console.log("[demo-show] Registering merchant and plan...");
  const merchantToken = await authenticateWallet(merchantKp, "merchant");
  const mAuth = { Authorization: `Bearer ${merchantToken}` };

  const appRes = await apiCall("POST", "/merchant/apps", { name: "Demo App" }, mAuth);
  const appId = ((appRes["data"] as Record<string, unknown>)["id"] as string);

  const planRes = await apiCall("POST", `/merchant/apps/${appId}/plans`, {
    name: "Pro Monthly ($10)",
    description: "$10.00 subscription",
    amountBaseUnits: AMOUNT.toString(),
    intervalSeconds: INTERVAL,
  }, mAuth);
  const planId = ((planRes["data"] as Record<string, unknown>)["id"] as string);

  // ── 3. Persist ATAs to .env for watch-balances ─────────────────────────
  const envPath = path.resolve(process.cwd(), ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = upsertEnvFile(envContent, "WATCH_SUBSCRIBER_ATA", subscriberAta.address.toBase58());
  envContent = upsertEnvFile(envContent, "DEMO_MERCHANT_ATA", merchantAta.address.toBase58());
  fs.writeFileSync(envPath, envContent);

  // ── 4. Snapshot treasury BEFORE (we show delta, not absolute) ──────────
  const treasuryBefore = await getUSDCBalance(vaultAta);

  // ── 5. Show BEFORE balances ────────────────────────────────────────────
  printBalanceTable(
    "BEFORE — subscription not yet processed",
    100.0,   // subscriber always starts at exactly 100
    0.0,     // fresh merchant always 0
    0.0,     // treasury delta starts at 0
  );

  // ── 6. Init subscription on-chain ──────────────────────────────────────
  console.log("[demo-show] Initializing subscription on-chain...");
  const [subPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("subscription"), subscriberKp.publicKey.toBuffer(), merchantKp.publicKey.toBuffer(), DEFAULT_PLAN_SEED],
    PROGRAM_ID,
  );

  await approve(conn, subscriberKp, subscriberAta.address, subPda, subscriberKp, 100_000_000);

  const amtBuf = Buffer.alloc(8);
  amtBuf.writeBigUInt64LE(AMOUNT);
  const intBuf = Buffer.alloc(8);
  intBuf.writeBigUInt64LE(BigInt(INTERVAL));

  const initIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: subPda, isSigner: false, isWritable: true },
      { pubkey: subscriberKp.publicKey, isSigner: true, isWritable: true },
      { pubkey: merchantKp.publicKey, isSigner: false, isWritable: false },
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([sha256Disc("initialize_subscription"), amtBuf, intBuf, DEFAULT_PLAN_SEED]),
  });
  await send(new Transaction().add(initIx), [subscriberKp]);
  console.log(`[demo-show] Subscription PDA: ${subPda.toBase58()}`);

  // ── 7. Register subscription in DB ─────────────────────────────────────
  const subToken = await authenticateWallet(subscriberKp, "subscriber");
  const regRes = await apiCall("POST", "/subscriber/subscriptions", {
    planId,
    subscriptionPda: subPda.toBase58(),
  }, { Authorization: `Bearer ${subToken}` });

  if (regRes["success"] !== true) {
    console.error("[demo-show] DB registration failed:", JSON.stringify(regRes));
    process.exit(1);
  }
  console.log(`[demo-show] Registered. Keeper fires every ${INTERVAL}s.`);
  console.log(`[demo-show] Watching payments live — Ctrl+C to stop.\n`);

  // ── 8. Persistent payment loop ─────────────────────────────────────────
  let paymentCount = 0;
  let lastSubBal = 100.0;

  // Print header once
  const hdrLine = "─".repeat(62);
  console.log(`┌${hdrLine}┐`);
  console.log(`│  #   Subscriber     Merchant      Treasury     Recur Fee     │`);
  console.log(`│      (USDC)        (USDC)        (delta)      (this tx)     │`);
  console.log(`├${hdrLine}┤`);

  // Show initial state as row 0
  console.log(`│  0   ${(100.0).toFixed(2).padStart(10)}   ${(0.0).toFixed(2).padStart(10)}   ${(0.0).toFixed(2).padStart(10)}       —            │`);

  // Poll forever until subscriber runs out or Ctrl+C
  while (true) {
    await new Promise((r) => setTimeout(r, 2000));

    const [subNow, merNow, tresNow] = await Promise.all([
      getUSDCBalance(subscriberAta.address),
      getUSDCBalance(merchantAta.address),
      getUSDCBalance(vaultAta),
    ]);

    const tresDelta = tresNow - treasuryBefore;

    // Detect new payment: subscriber balance dropped by ~$10
    if (subNow < lastSubBal - 0.01) {
      paymentCount++;
      const thisFee = (tresNow - treasuryBefore) - (paymentCount - 1) * 0.075;

      console.log(
        `│  ${String(paymentCount).padStart(1)}   ${subNow.toFixed(2).padStart(10)}   ${merNow.toFixed(2).padStart(10)}   ${tresDelta.toFixed(2).padStart(10)}   ${thisFee.toFixed(3).padStart(8)}       │`,
      );

      lastSubBal = subNow;

      // Subscriber drained — show summary and stay alive
      if (subNow < 10.0) {
        console.log(`└${hdrLine}┘`);
        console.log(`\n  ${paymentCount} payments processed. Subscriber drained.`);
        console.log(`  Total charged:   $${(100.0 - subNow).toFixed(2)}`);
        console.log(`  Total to merchant: $${merNow.toFixed(2)}`);
        console.log(`  Total Recur fees:  $${tresDelta.toFixed(2)}  ($0.05 flat + 0.25% per tx)`);
        console.log(`\n  Subscriber signed once. The Keeper did the rest.\n`);
        // Keep process alive so terminal doesn't close
        await new Promise(() => {});
      }
    }
  }
}

main().catch((err) => {
  console.error("\n[demo-show] FAILED:", err.message ?? err);
  process.exit(1);
});
