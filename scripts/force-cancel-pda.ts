/**
 * Force-cancel a specific on-chain PDA using the keeper wallet.
 * Usage: bun run scripts/force-cancel-pda.ts
 */
import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { readFileSync } from "fs";

const connection = new Connection("https://devnet.helius-rpc.com/?api-key=6e39e37f-a078-4ca2-b36d-6bb311409f2a");
const keeperKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync("C:\\Users\\harmi\\deploy-key.json", "utf-8")))
);

const PROGRAM_ID = new PublicKey("5HFL1agQqg6wHeLEsLuJVKdLZbMzAC2rGRQkEWk8smLk");
const FORCE_CANCEL_DISC = Buffer.from([175, 185, 230, 97, 169, 116, 227, 2]);

// PDA to close
const PDA = new PublicKey("CjcGLTWrmAe4eqi6Mq5fFmqgswf6rZuV3npW3h5gJ5bW");

async function main() {
  const info = await connection.getAccountInfo(PDA);
  if (!info) { console.log("PDA not found on-chain"); return; }

  // Parse the subscription PDA data to get subscriber and merchant
  // Layout: 8 (disc) + 32 (subscriber) + 32 (merchant) + ...
  const data = info.data;
  const subscriber = new PublicKey(data.subarray(8, 40));
  const merchant = new PublicKey(data.subarray(40, 72));

  console.log("Subscriber:", subscriber.toBase58());
  console.log("Merchant:", merchant.toBase58());
  console.log("Keeper:", keeperKeypair.publicKey.toBase58());

  const ix = {
    programId: PROGRAM_ID,
    keys: [
      { pubkey: PDA, isSigner: false, isWritable: true },
      { pubkey: subscriber, isSigner: false, isWritable: true },
      { pubkey: merchant, isSigner: false, isWritable: false },
      { pubkey: keeperKeypair.publicKey, isSigner: true, isWritable: false },
    ],
    data: FORCE_CANCEL_DISC,
  };

  const tx = new Transaction().add(ix);
  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [keeperKeypair], { commitment: "confirmed" });
    console.log("Force cancel success! Sig:", sig);
  } catch (err: any) {
    console.error("Force cancel failed:", err.message);
    if (err.logs) console.error("Logs:", err.logs);
  }
}

main();
