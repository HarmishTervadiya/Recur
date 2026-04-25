/**
 * fund-usdc.ts — Create a mock USDC mint and fund a target wallet on devnet.
 *
 * Usage:
 *   bun run scripts/fund-usdc.ts <wallet-address> [amount-usdc]
 *
 * What it does:
 *   1. Creates a new SPL token mint (6 decimals) — keeper is mint authority
 *   2. Creates an ATA for the target wallet
 *   3. Mints <amount> USDC (default 1000) into the ATA
 *   4. Prints the new mint address
 *   5. Patches E:\Recur\.env and D:\harmis-cloud\client\.env to use the new mint
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = "https://api.devnet.solana.com";
const conn = new Connection(RPC_URL, "confirmed");

// ── Load keeper keypair from .env ────────────────────────────────────────────

function loadKeeper(): Keypair {
  const raw = process.env.KEEPER_KEYPAIR;
  if (!raw) throw new Error("KEEPER_KEYPAIR not set in .env");
  const arr = JSON.parse(raw) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

// ── Patch a .env file: replace or append a key=value line ───────────────────

function patchEnv(filePath: string, key: string, value: string) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  [warn] .env not found at ${filePath} — skipping patch`);
    return;
  }
  let content = fs.readFileSync(filePath, "utf8");
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}\n`;
  }
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  patched ${filePath}  →  ${key}=${value}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const targetArg = process.argv[2];
  if (!targetArg) {
    console.error("Usage: bun run scripts/fund-usdc.ts <wallet-address> [amount-usdc]");
    process.exit(1);
  }

  const targetWallet = new PublicKey(targetArg);
  const amountUsdc   = Number(process.argv[3] ?? "1000");
  const amountUnits  = BigInt(Math.round(amountUsdc * 1_000_000));

  // Load payer / mint authority
  const keeper = loadKeeper();
  console.log(`\nPayer (keeper):  ${keeper.publicKey.toBase58()}`);
  console.log(`Target wallet:   ${targetWallet.toBase58()}`);
  console.log(`Amount:          ${amountUsdc} USDC\n`);

  // Ensure keeper has SOL
  const bal = await conn.getBalance(keeper.publicKey);
  console.log(`Keeper SOL balance: ${(bal / LAMPORTS_PER_SOL).toFixed(4)}`);
  if (bal < 0.05 * LAMPORTS_PER_SOL) {
    throw new Error("Keeper balance too low — fund with: solana airdrop 2 --url devnet");
  }

  // Step 1: Create mock USDC mint
  console.log("\n[1] Creating mock USDC mint (6 decimals)...");
  const mint = await createMint(
    conn,
    keeper,           // payer
    keeper.publicKey, // mint authority
    null,             // freeze authority
    6,
  );
  console.log(`    Mint: ${mint.toBase58()}`);

  // Step 2: Create ATA for target wallet (payer = keeper)
  console.log("\n[2] Creating ATA for target wallet...");
  const targetAta = await getOrCreateAssociatedTokenAccount(
    conn,
    keeper,
    mint,
    targetWallet,
  );
  console.log(`    ATA: ${targetAta.address.toBase58()}`);

  // Also create an ATA for the keeper itself (useful for testing)
  console.log("\n[3] Creating ATA for keeper...");
  const keeperAta = await getOrCreateAssociatedTokenAccount(
    conn,
    keeper,
    mint,
    keeper.publicKey,
  );
  console.log(`    Keeper ATA: ${keeperAta.address.toBase58()}`);

  // Step 3: Mint to target
  console.log(`\n[4] Minting ${amountUsdc} USDC to target wallet...`);
  const mintSig = await mintTo(
    conn,
    keeper,
    mint,
    targetAta.address,
    keeper, // mint authority
    amountUnits,
  );
  console.log(`    Tx: ${mintSig}`);

  // Mint some to keeper too (useful for payment processing tests)
  console.log(`\n[5] Minting 10000 USDC to keeper wallet...`);
  const keeperMintSig = await mintTo(
    conn,
    keeper,
    mint,
    keeperAta.address,
    keeper,
    10_000n * 1_000_000n,
  );
  console.log(`    Tx: ${keeperMintSig}`);

  // Step 4: Patch .env files
  console.log("\n[6] Patching .env files...");
  const mintStr = mint.toBase58();

  patchEnv("E:\\Recur\\.env",                    "USDC_MINT",      mintStr);
  patchEnv("E:\\Recur\\.env",                    "NEXT_PUBLIC_USDC_MINT", mintStr);
  patchEnv("D:\\harmis-cloud\\client\\.env",     "VITE_USDC_MINT", mintStr);

  // Print summary
  console.log("\n─────────────────────────────────────────────────────");
  console.log("Done!");
  console.log(`  Mock USDC mint:   ${mintStr}`);
  console.log(`  Target ATA:       ${targetAta.address.toBase58()}`);
  console.log(`  Target balance:   ${amountUsdc} USDC`);
  console.log(`  Keeper ATA:       ${keeperAta.address.toBase58()}`);
  console.log(`  Keeper balance:   10000 USDC`);
  console.log("\nRestart the Recur API and Harmis Cloud dev server to pick up the new USDC_MINT.");
  console.log("─────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\nError:", err.message ?? err);
  process.exit(1);
});
