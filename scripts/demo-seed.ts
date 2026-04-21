/**
 * demo-seed.ts — Recording setup for Week 2 demo
 *
 * Creates:
 *   - Fresh USDC mint
 *   - Treasury vault on-chain
 *   - Merchant wallet + app + plan ($10 / 15s interval)
 *   - Subscriber wallet funded with 100 USDC, subscription initialised on-chain
 *   - Everything registered in DB
 *   - All credentials saved to .env (no copy-paste needed)
 *
 * Usage:
 *   bun run demo:seed
 *
 * Then start: validator → API → keeper → demo:watch
 * Then on camera: bun run demo:show
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
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import nacl from "tweetnacl";
import bs58 from "bs58";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const RPC_URL = "http://127.0.0.1:8899";
const API_URL = "http://localhost:3001";
const PROGRAM_ID = new PublicKey("Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj");

const AMOUNT = 10_000_000;   // $10.00 USDC (6 decimals)
const INTERVAL = 15;          // 15 seconds — keeper polls every 15s

const conn = new Connection(RPC_URL, "confirmed");

// ─── helpers ────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[demo-seed] ${msg}`);
}

async function assertProgramDeployed() {
  const info = await conn.getAccountInfo(PROGRAM_ID);
  if (!info || !info.executable) {
    throw new Error(
      `Program ${PROGRAM_ID.toBase58()} not deployed on ${RPC_URL}.\n` +
      `Start validator:\n` +
      `  solana-test-validator --reset --bpf-program ${PROGRAM_ID.toBase58()} contracts/target/deploy/recur.so`,
    );
  }
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

/**
 * Send a transaction with a freshly fetched blockhash right before signing.
 * This prevents TransactionExpiredBlockheightExceeded errors that happen when
 * a blockhash is fetched early and expires before the tx is submitted.
 */
async function send(
  tx: Transaction,
  signers: Keypair[],
): Promise<string> {
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
  const payload = (await res.json()) as Record<string, unknown>;
  if (payload["success"] !== true) {
    const err = payload["error"] as Record<string, unknown> | null;
    const code = (err?.["code"] as string) ?? "UNKNOWN";
    const message = (err?.["message"] as string) ?? "Request failed";
    throw new Error(`API ${method} ${p} [${res.status}] ${code}: ${message}`);
  }
  return payload;
}

function sha256Disc(name: string): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  );
}

const DEFAULT_PLAN_SEED = Buffer.alloc(8);
DEFAULT_PLAN_SEED.writeBigUInt64LE(BigInt(1));

function subscriptionPda(subscriber: PublicKey, merchant: PublicKey, planSeed: Buffer): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("subscription"), subscriber.toBuffer(), merchant.toBuffer(), planSeed],
    PROGRAM_ID,
  );
  return pda;
}

function treasuryVaultPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_vault")],
    PROGRAM_ID,
  );
  return pda;
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

async function getTokenBalance(ata: PublicKey): Promise<number> {
  try {
    const info = await conn.getTokenAccountBalance(ata);
    return Number(info.value.uiAmount ?? 0);
  } catch {
    return 0;
  }
}

function upsertEnv(content: string, key: string, value: string): string {
  const re = new RegExp(`^${key}=.*`, "m");
  return re.test(content)
    ? content.replace(re, `${key}=${value}`)
    : content + `\n${key}=${value}`;
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  log("=== Recur Demo Seed — Week 2 Recording ===");
  await assertProgramDeployed();

  // ── 1. Keypairs ────────────────────────────────────────────────────────
  let keeperKp: Keypair;
  try {
    const keeperBytes = JSON.parse(
      fs.readFileSync(
        path.join(process.env["USERPROFILE"] || process.env["HOME"] || "~", ".config/solana/id.json"),
        "utf-8",
      ),
    );
    keeperKp = Keypair.fromSecretKey(Uint8Array.from(keeperBytes));
    log(`Keeper: ${keeperKp.publicKey.toBase58()}`);
  } catch {
    log("Default keypair not found — generating keeper keypair");
    keeperKp = Keypair.generate();
    await airdrop(keeperKp.publicKey, 10);
  }

  const mintAuthority = Keypair.generate();
  const merchantKp = Keypair.generate();
  const subscriberKp = Keypair.generate();

  // ── 2. Airdrops ────────────────────────────────────────────────────────
  log("Airdropping SOL...");
  await airdrop(mintAuthority.publicKey, 10);
  await airdrop(merchantKp.publicKey, 5);
  await airdrop(subscriberKp.publicKey, 5);

  // ── 3. USDC mint ───────────────────────────────────────────────────────
  log("Creating USDC mint...");
  const usdcMint = await createMint(conn, mintAuthority, mintAuthority.publicKey, null, 6);
  log(`USDC Mint: ${usdcMint.toBase58()}`);

  // ── 4. Treasury vault ──────────────────────────────────────────────────
  const vaultPda = treasuryVaultPda();
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true);
  const existingVault = await conn.getAccountInfo(vaultPda);

  if (!existingVault) {
    log("Initializing treasury vault...");
    const ix = new TransactionInstruction({
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
      data: sha256Disc("initialize_treasury"),
    });
    await send(new Transaction().add(ix), [mintAuthority]);
    log("Treasury vault initialized");
  } else {
    log("Treasury vault exists — creating ATA for new mint");
    const ataInfo = await conn.getAccountInfo(vaultAta);
    if (!ataInfo) {
      const ix = createAssociatedTokenAccountInstruction(
        mintAuthority.publicKey, vaultAta, vaultPda, usdcMint,
      );
      await send(new Transaction().add(ix), [mintAuthority]);
    }
    log("Treasury ATA ready");
  }

  // ── 5. Token accounts ─────────────────────────────────────────────────
  log("Creating token accounts...");
  const subscriberAta = await getOrCreateAssociatedTokenAccount(
    conn, subscriberKp, usdcMint, subscriberKp.publicKey,
  );
  const merchantAta = await getOrCreateAssociatedTokenAccount(
    conn, merchantKp, usdcMint, merchantKp.publicKey,
  );

  // ── 6. Fund subscriber with exactly 100 USDC ──────────────────────────
  await mintTo(conn, mintAuthority, usdcMint, subscriberAta.address, mintAuthority, 100_000_000);
  log("Subscriber funded: 100 USDC");

  // ── 7. Initialize subscription on-chain ───────────────────────────────
  log("Initializing subscription on-chain...");
  const pda = subscriptionPda(subscriberKp.publicKey, merchantKp.publicKey, DEFAULT_PLAN_SEED);

  await approve(conn, subscriberKp, subscriberAta.address, pda, subscriberKp, 100_000_000);

  const amtBuf = Buffer.alloc(8);
  amtBuf.writeBigUInt64LE(BigInt(AMOUNT));
  const intBuf = Buffer.alloc(8);
  intBuf.writeBigUInt64LE(BigInt(INTERVAL));

  const initIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: subscriberKp.publicKey, isSigner: true, isWritable: true },
      { pubkey: merchantKp.publicKey, isSigner: false, isWritable: false },
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([sha256Disc("initialize_subscription"), amtBuf, intBuf, DEFAULT_PLAN_SEED]),
  });
  const subSig = await send(new Transaction().add(initIx), [subscriberKp]);
  log(`Subscription PDA: ${pda.toBase58()} | tx: ${subSig}`);

  // ── 8. Register merchant + plan in DB ─────────────────────────────────
  log("Authenticating merchant...");
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
  log(`Plan created: ${planId}`);

  // ── 9. Register subscriber + subscription in DB ───────────────────────
  log("Authenticating subscriber...");
  const subToken = await authenticateWallet(subscriberKp, "subscriber");
  const regRes = await apiCall("POST", "/subscriber/subscriptions", {
    planId,
    subscriptionPda: pda.toBase58(),
  }, { Authorization: `Bearer ${subToken}` });
  const subDbId = ((regRes["data"] as Record<string, unknown>)["id"] as string);
  log(`Subscription registered in DB: ${subDbId}`);

  // ── 10. Save all credentials to .env ──────────────────────────────────
  const envPath = path.resolve(process.cwd(), ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");

  envContent = upsertEnv(envContent, "USDC_MINT", usdcMint.toBase58());
  envContent = upsertEnv(envContent, "MINT_AUTHORITY_SECRET", JSON.stringify(Array.from(mintAuthority.secretKey)));
  envContent = upsertEnv(envContent, "DEMO_MERCHANT_SECRET", JSON.stringify(Array.from(merchantKp.secretKey)));
  envContent = upsertEnv(envContent, "DEMO_PLAN_ID", planId);
  envContent = upsertEnv(envContent, "DEMO_MERCHANT_ATA", merchantAta.address.toBase58());
  envContent = upsertEnv(envContent, "DEMO_TREASURY_ATA", vaultAta.toBase58());

  fs.writeFileSync(envPath, envContent);
  log(".env updated with all demo credentials");

  // ── 11. Verify starting balances ──────────────────────────────────────
  const subBal = await getTokenBalance(subscriberAta.address);
  const merBal = await getTokenBalance(merchantAta.address);
  const tresBal = await getTokenBalance(vaultAta);

  console.log("\n" + "=".repeat(60));
  console.log("  DEMO SEED COMPLETE");
  console.log("=".repeat(60));
  console.log(`\n  Subscriber:  ${subBal} USDC  ← should be 100`);
  console.log(`  Merchant:    ${merBal} USDC  ← should be 0`);
  console.log(`  Treasury:    ${tresBal} USDC  ← should be 0`);
  console.log(`\n  Plan:        $10.00 every ${INTERVAL}s`);
  console.log(`  Fee split:   $9.925 merchant / $0.075 treasury`);
  console.log(`               ($0.05 flat + 0.25% = $0.075)`);
  console.log("\n" + "=".repeat(60));
  console.log("  ALL CREDENTIALS SAVED TO .env AUTOMATICALLY");
  console.log("=".repeat(60));
  console.log(`\n  .env updated with:`);
  console.log(`    USDC_MINT, MINT_AUTHORITY_SECRET, DEMO_MERCHANT_SECRET`);
  console.log(`    DEMO_PLAN_ID, DEMO_MERCHANT_ATA, DEMO_TREASURY_ATA`);
  console.log("\n" + "=".repeat(60));
  console.log("  NEXT — start keeper then on camera run:");
  console.log("=".repeat(60));
  console.log(`\n    bun run demo:show\n`);
}

main().catch((err) => {
  console.error("Demo seed failed:", err.message ?? err);
  process.exit(1);
});
