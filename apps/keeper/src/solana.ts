import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { env } from "@recur/config";
import bs58 from "bs58";

function loadKeypair(): Keypair {
  const raw = env.KEEPER_KEYPAIR;
  if (!raw) throw new Error("KEEPER_KEYPAIR env var is required");

  try {
    const decoded = bs58.decode(raw);
    return Keypair.fromSecretKey(decoded);
  } catch {
    const json = JSON.parse(raw);
    return Keypair.fromSecretKey(Uint8Array.from(json));
  }
}

export const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
export const keeperKeypair = loadKeypair();
export const keeperWallet = new Wallet(keeperKeypair);
export const provider = new AnchorProvider(connection, keeperWallet, {
  commitment: "confirmed",
});
