/**
 * nuke-all-pdas.ts — Force-cancel ALL subscription PDAs on-chain.
 * For cancel-requested ones, calls finalize_cancel. For active ones, calls force_cancel.
 * Already-closed PDAs are skipped.
 */
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import crypto from "crypto";

const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx");
const conn = new Connection(RPC_URL, "confirmed");

function disc(name: string): Buffer {
  return Buffer.from(crypto.createHash("sha256").update(`global:${name}`).digest()).subarray(0, 8);
}

const FORCE_CANCEL_DISC = disc("force_cancel");
const FINALIZE_CANCEL_DISC = disc("finalize_cancel");

function loadKeeper(): Keypair {
  const raw = process.env.KEEPER_KEYPAIR;
  if (!raw) throw new Error("KEEPER_KEYPAIR not set");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

async function main() {
  const keeper = loadKeeper();
  console.log(`Keeper: ${keeper.publicKey.toBase58()}`);

  // Get all program accounts of subscription size (121 bytes)
  const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: 121 }],
  });

  console.log(`Found ${accounts.length} subscription PDA(s) on-chain\n`);

  for (const { pubkey, account } of accounts) {
    const d = account.data;
    const subscriber = new PublicKey(d.subarray(8, 40));
    const merchant = new PublicKey(d.subarray(40, 72));
    const cancelReq = d.readBigUInt64LE(8 + 104);

    console.log(`PDA: ${pubkey.toBase58()}`);
    console.log(`  subscriber: ${subscriber.toBase58()}`);
    console.log(`  merchant: ${merchant.toBase58()}`);
    console.log(`  cancelReq: ${cancelReq}`);

    let ix: TransactionInstruction;

    if (cancelReq > 0n) {
      // Already cancel-requested — try finalize_cancel first
      console.log(`  -> finalize_cancel`);
      ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey, isSigner: false, isWritable: true },
          { pubkey: subscriber, isSigner: false, isWritable: true },
          { pubkey: merchant, isSigner: false, isWritable: false },
        ],
        data: FINALIZE_CANCEL_DISC,
      });
    } else {
      // Active — force_cancel
      console.log(`  -> force_cancel`);
      ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey, isSigner: false, isWritable: true },
          { pubkey: subscriber, isSigner: false, isWritable: true },
          { pubkey: merchant, isSigner: false, isWritable: false },
          { pubkey: keeper.publicKey, isSigner: true, isWritable: false },
        ],
        data: FORCE_CANCEL_DISC,
      });
    }

    try {
      const tx = new Transaction().add(ix);
      const sig = await sendAndConfirmTransaction(conn, tx, [keeper], { commitment: "confirmed" });
      console.log(`  Done: ${sig}\n`);
    } catch (err: any) {
      console.log(`  Failed: ${err.message?.slice(0, 100)}\n`);
    }
  }

  // Verify
  const remaining = await conn.getProgramAccounts(PROGRAM_ID, { filters: [{ dataSize: 121 }] });
  console.log(`Remaining PDAs: ${remaining.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
