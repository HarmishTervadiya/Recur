/**
 * init-treasury-ata.ts — Create the treasury vault's ATA for the current USDC mint.
 *
 * The treasury vault PDA already exists on-chain, but when switching to a new
 * mock USDC mint its ATA doesn't exist yet. This script creates it.
 *
 * Usage:
 *   bun run scripts/init-treasury-ata.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { findTreasuryVaultPda } from "../packages/solana-client/src/index";

const RPC_URL    = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID ?? "3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx");
const USDC_MINT  = new PublicKey(process.env.USDC_MINT!);
const conn       = new Connection(RPC_URL, "confirmed");

function loadKeeper(): Keypair {
  const raw = process.env.KEEPER_KEYPAIR;
  if (!raw) throw new Error("KEEPER_KEYPAIR not set in .env");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

async function main() {
  const keeper = loadKeeper();
  const [treasuryVault] = findTreasuryVaultPda(PROGRAM_ID);

  console.log(`Keeper:          ${keeper.publicKey.toBase58()}`);
  console.log(`Treasury vault:  ${treasuryVault.toBase58()}`);
  console.log(`USDC mint:       ${USDC_MINT.toBase58()}`);

  // Verify the treasury vault PDA exists
  const vaultInfo = await conn.getAccountInfo(treasuryVault);
  if (!vaultInfo) {
    console.error("Treasury vault PDA not found. Run initialize_treasury first.");
    process.exit(1);
  }
  console.log(`Treasury vault exists (owner: ${vaultInfo.owner.toBase58()})`);

  // Create ATA for the treasury vault PDA
  console.log("\nCreating treasury vault ATA for mock USDC mint...");
  const ata = await getOrCreateAssociatedTokenAccount(
    conn,
    keeper,         // payer
    USDC_MINT,
    treasuryVault,
    true,           // allowOwnerOffCurve — PDA is not on the ed25519 curve
  );

  console.log(`Treasury vault ATA: ${ata.address.toBase58()}`);
  console.log("Done!\n");
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
