/**
 * Seed script for localnet E2E testing.
 *
 * Sets up all on-chain and DB state, then prints env vars for the keeper.
 * After this runs, start the keeper and watch it process payments automatically.
 *
 * Usage:
 *   bun run scripts/seed-localnet.ts
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
import fs from "fs";
import path from "path";

const RPC_URL = "http://localhost:8899";
const API_URL = "http://localhost:3001";
const KEEPER_SECRET = "localnet-keeper-secret";
const PROGRAM_ID = new PublicKey("Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj");

const AMOUNT = 2_000_000; // $2.00 USDC — small so we can see many payments
const INTERVAL = 10; // 10 seconds — keeper runs every 60s, so we'll see batches
const NUM_SUBSCRIPTIONS = 3;

const conn = new Connection(RPC_URL, "confirmed");

function log(msg: string) {
  console.log(`[seed] ${msg}`);
}

async function airdrop(pubkey: PublicKey, sol = 5) {
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
): Promise<Record<string, unknown>> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  return (await res.json()) as Record<string, unknown>;
}

function sha256Disc(name: string): Buffer {
  return Buffer.from(crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8));
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

async function authenticateWallet(kp: Keypair, role: "merchant" | "subscriber"): Promise<string> {
  const wallet = kp.publicKey.toBase58();
  const r1 = await api("POST", "/auth/nonce", { walletAddress: wallet, role });
  const d1 = (r1["data"] as Record<string, unknown>);
  const message = d1["message"] as string;
  const nonce = d1["nonce"] as string;

  const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
  const r2 = await api("POST", "/auth/verify", {
    walletAddress: wallet,
    role,
    nonce,
    signature: bs58.encode(sig),
  });
  return ((r2["data"] as Record<string, unknown>)["token"] as string);
}

async function main() {
  log("=== Recur Localnet Seed ===");

  // 1. Keeper keypair (reuse the default Solana keypair)
  const keeperBytes = JSON.parse(
    fs.readFileSync(path.join(process.env["USERPROFILE"] || process.env["HOME"] || "~", ".config/solana/id.json"), "utf-8"),
  );

  // Check if that path exists, try WSL path via wsl
  let keeperKp: Keypair;
  try {
    keeperKp = Keypair.fromSecretKey(Uint8Array.from(keeperBytes));
  } catch {
    log("Could not load default keypair, generating new one");
    keeperKp = Keypair.generate();
    await airdrop(keeperKp.publicKey, 10);
  }

  log(`Keeper wallet: ${keeperKp.publicKey.toBase58()}`);

  // 2. Create mint authority, merchant, subscribers
  const mintAuthority = Keypair.generate();
  const merchantKp = Keypair.generate();
  const subscribers: Keypair[] = [];
  for (let i = 0; i < NUM_SUBSCRIPTIONS; i++) {
    subscribers.push(Keypair.generate());
  }

  log("Airdropping SOL...");
  await airdrop(mintAuthority.publicKey, 10);
  await airdrop(merchantKp.publicKey, 10);
  for (const s of subscribers) {
    await airdrop(s.publicKey, 5);
  }

  // 3. Create USDC mint
  log("Creating USDC mint...");
  const usdcMint = await createMint(conn, mintAuthority, mintAuthority.publicKey, null, 6);
  log(`USDC Mint: ${usdcMint.toBase58()}`);

  // 4. Treasury vault
  const [vaultPda] = treasuryVaultPda();
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true);

  const existing = await conn.getAccountInfo(vaultPda);
  if (!existing) {
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
    await sendAndConfirmTransaction(conn, new Transaction().add(ix), [mintAuthority]);
    log("Treasury initialized");
  } else {
    log("Treasury vault exists, creating ATA for new mint...");
    const ataInfo = await conn.getAccountInfo(vaultAta);
    if (!ataInfo) {
      const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
      const ix = createAssociatedTokenAccountInstruction(mintAuthority.publicKey, vaultAta, vaultPda, usdcMint);
      await sendAndConfirmTransaction(conn, new Transaction().add(ix), [mintAuthority]);
    }
    log("Treasury ATA ready");
  }

  // 5. Merchant token account
  const merchantAta = await getOrCreateAssociatedTokenAccount(conn, merchantKp, usdcMint, merchantKp.publicKey);

  // 6. Auth merchant via API + create app + plan
  log("Authenticating merchant...");
  const merchantToken = await authenticateWallet(merchantKp, "merchant");
  const mAuth = { Authorization: `Bearer ${merchantToken}` };

  log("Creating app and plan...");
  const appRes = await api("POST", "/merchant/apps", { name: "Demo App" }, mAuth);
  const appId = ((appRes["data"] as Record<string, unknown>)["id"] as string);

  const planRes = await api("POST", `/merchant/apps/${appId}/plans`, {
    name: "Micro Plan ($2/10s)",
    description: `$2.00 every ${INTERVAL}s for testing`,
    amountBaseUnits: AMOUNT.toString(),
    intervalSeconds: INTERVAL,
  }, mAuth);
  const planId = ((planRes["data"] as Record<string, unknown>)["id"] as string);
  log(`App: ${appId} | Plan: ${planId}`);

  // 7. Create subscriptions for each subscriber
  const subPdas: string[] = [];
  for (let i = 0; i < subscribers.length; i++) {
    const sub = subscribers[i]!;
    log(`Setting up subscriber ${i + 1}/${subscribers.length}: ${sub.publicKey.toBase58()}`);

    // Token account + fund
    const subAta = await getOrCreateAssociatedTokenAccount(conn, sub, usdcMint, sub.publicKey);
    await mintTo(conn, mintAuthority, usdcMint, subAta.address, mintAuthority, 100_000_000); // $100 USDC

    // Derive PDA + delegate
    const [pda] = subscriptionPda(sub.publicKey, merchantKp.publicKey, DEFAULT_PLAN_SEED);
    await approve(conn, sub, subAta.address, pda, sub, AMOUNT * 100); // delegate for many payments

    // Init subscription on-chain
    const amtBuf = Buffer.alloc(8);
    amtBuf.writeBigUInt64LE(BigInt(AMOUNT));
    const intBuf = Buffer.alloc(8);
    intBuf.writeBigUInt64LE(BigInt(INTERVAL));

    const initIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: sub.publicKey, isSigner: true, isWritable: true },
        { pubkey: merchantKp.publicKey, isSigner: false, isWritable: false },
        { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([sha256Disc("initialize_subscription"), amtBuf, intBuf, DEFAULT_PLAN_SEED]),
    });
    const sig = await sendAndConfirmTransaction(conn, new Transaction().add(initIx), [sub]);
    log(`  PDA: ${pda.toBase58()} | tx: ${sig}`);

    // Auth subscriber + register in DB
    const subToken = await authenticateWallet(sub, "subscriber");
    const regRes = await api("POST", "/subscriber/subscriptions", {
      planId,
      subscriptionPda: pda.toBase58(),
    }, { Authorization: `Bearer ${subToken}` });
    const subId = ((regRes["data"] as Record<string, unknown>)["id"] as string);
    log(`  DB subscription: ${subId}`);

    subPdas.push(pda.toBase58());
  }

  // 8. Print summary and env vars for keeper
  console.log("\n" + "=".repeat(60));
  console.log("SEED COMPLETE — Ready to run the keeper");
  console.log("=".repeat(60));
  console.log(`\nMerchant:    ${merchantKp.publicKey.toBase58()}`);
  console.log(`USDC Mint:   ${usdcMint.toBase58()}`);
  console.log(`Plan:        $${AMOUNT / 1_000_000} every ${INTERVAL}s`);
  console.log(`Subs:        ${subPdas.length}`);
  subPdas.forEach((p, i) => console.log(`  Sub ${i + 1}: ${p}`));

  console.log(`\n--- Add this to your .env before starting the keeper ---`);
  console.log(`USDC_MINT=${usdcMint.toBase58()}`);

  // Update .env file automatically
  const envPath = path.resolve(process.cwd(), ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  if (envContent.includes("USDC_MINT=")) {
    envContent = envContent.replace(/USDC_MINT=.*/, `USDC_MINT=${usdcMint.toBase58()}`);
  } else {
    envContent += `\nUSDC_MINT=${usdcMint.toBase58()}\n`;
  }
  fs.writeFileSync(envPath, envContent);
  log(`.env updated with USDC_MINT=${usdcMint.toBase58()}`);

  console.log(`\nNow start the keeper:`);
  console.log(`  cd apps/keeper && bun run src/index.ts`);
  console.log(`\nThe keeper will auto-process payments every ~60s.`);
  console.log(`Each subscription costs $${AMOUNT / 1_000_000} with a ${INTERVAL}s interval.`);
  console.log(`Watch the keeper logs for "Payment processed" messages.\n`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
