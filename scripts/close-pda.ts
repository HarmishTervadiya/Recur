/**
 * Close stale subscription PDA via finalize_cancel (permissionless).
 * Usage: bun run scripts/close-pda.ts
 */
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("5HFL1agQqg6wHeLEsLuJVKdLZbMzAC2rGRQkEWk8smLk");
const RPC = "https://api.devnet.solana.com";

// Subscription PDA to close
const SUBSCRIPTION_PDA = new PublicKey("DPujvgyaQCJWHTyk9g2WMbrBnTBWbw2TWour3SwodcFb");

// Subscriber + merchant from the plan data
const SUBSCRIBER = new PublicKey("E29sddHjza76obnzVgLudsqxcsB7EfFT6Gbimx2SDETR");
const MERCHANT = new PublicKey("9uUYYvkEjEQTd7T5VgqEFkiWgFnTsRfiDqVEdwz5BEDS");

// Fee payer (deploy key)
const keypairData = JSON.parse(fs.readFileSync("C:\\Users\\harmi\\deploy-key.json", "utf-8"));
const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

function ixDiscriminator(name: string): Buffer {
  const hash = createHash("sha256").update(`global:${name}`).digest();
  return Buffer.from(hash.subarray(0, 8));
}

async function main() {
  const connection = new Connection(RPC, "confirmed");

  const ixData = Buffer.alloc(8);
  ixDiscriminator("finalize_cancel").copy(ixData, 0);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: SUBSCRIPTION_PDA, isSigner: false, isWritable: true },
      { pubkey: SUBSCRIBER, isSigner: false, isWritable: true },
      { pubkey: MERCHANT, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = payer.publicKey;

  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log("Finalize cancel TX:", sig);
  console.log("PDA closed successfully");
}

main().catch(console.error);
