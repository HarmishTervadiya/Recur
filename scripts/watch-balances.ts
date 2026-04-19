/**
 * watch-balances.ts — Live balance display for recording (RIGHT PANE)
 *
 * Re-reads .env every tick so it picks up ATAs written by demo-show.
 *
 * Usage (no args needed):
 *   bun run demo:watch
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import fs from "fs";
import path from "path";

const REFRESH_MS = 2000;
const RPC_URL = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj");

const conn = new Connection(RPC_URL, "confirmed");

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

async function getBalance(ata: string): Promise<string> {
  try {
    const info = await conn.getTokenAccountBalance(new PublicKey(ata));
    const val = Number(info.value.uiAmount ?? 0);
    return val.toFixed(2);
  } catch {
    return "-.--";
  }
}

// Track treasury baseline so we show delta
let treasuryBaseline: number | null = null;

async function getRawBalance(ata: string): Promise<number> {
  try {
    const info = await conn.getTokenAccountBalance(new PublicKey(ata));
    return Number(info.value.uiAmount ?? 0);
  } catch {
    return 0;
  }
}

function clearScreen() {
  process.stdout.write("\x1Bc");
}

async function tick() {
  const env = loadEnv();
  const subAta = env["WATCH_SUBSCRIBER_ATA"];
  const merAta = env["DEMO_MERCHANT_ATA"];
  const usdcMint = env["USDC_MINT"];

  if (!subAta || !merAta || !usdcMint) {
    clearScreen();
    console.log("╔══════════════════════════════════════════╗");
    console.log("║         RECUR — LIVE BALANCES            ║");
    console.log("╠══════════════════════════════════════════╣");
    console.log("║  Waiting for demo:show to start...       ║");
    console.log("╚══════════════════════════════════════════╝");
    return;
  }

  // Derive treasury ATA
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_vault")], PROGRAM_ID,
  );
  const vaultAta = getAssociatedTokenAddressSync(
    new PublicKey(usdcMint), vaultPda, true,
  );

  const sub = await getBalance(subAta);
  const mer = await getBalance(merAta);
  const tresRaw = await getRawBalance(vaultAta.toBase58());

  // Set baseline on first read, show delta
  if (treasuryBaseline === null) {
    treasuryBaseline = tresRaw;
  }
  const tresDelta = (tresRaw - treasuryBaseline).toFixed(2);

  const now = new Date().toLocaleTimeString();

  clearScreen();
  console.log("╔══════════════════════════════════════════╗");
  console.log("║         RECUR — LIVE BALANCES            ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║  Subscriber   ${sub.padStart(10)} USDC           ║`);
  console.log(`║  Merchant     ${mer.padStart(10)} USDC           ║`);
  console.log(`║  Treasury     ${tresDelta.padStart(10)} USDC           ║`);
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║  Plan: $10.00  Fee: $0.05 + 0.25%        ║`);
  console.log(`║  Updated: ${now.padEnd(31)}║`);
  console.log("╚══════════════════════════════════════════╝");
}

tick();
setInterval(tick, REFRESH_MS);
