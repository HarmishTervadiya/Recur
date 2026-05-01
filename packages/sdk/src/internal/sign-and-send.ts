/**
 * Internal helper: sign a set of instructions with a `RecurWallet`,
 * send to the cluster, confirm, and return the signature.
 *
 * Single home for the wallet -> tx -> send -> confirm pipeline so that
 * `subscribe`, `cancel`, `reapprove`, etc. share one implementation.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { RecurWallet } from "../types.js";
import { mapError, WalletRejectedError } from "../errors.js";

export async function signAndSend(
  connection: Connection,
  wallet: RecurWallet,
  instructions: TransactionInstruction[],
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash,
    lastValidBlockHeight,
  });
  tx.add(...instructions);

  let signed: Transaction;
  try {
    signed = await wallet.signTransaction(tx);
  } catch (err) {
    throw new WalletRejectedError(err);
  }

  try {
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    return signature;
  } catch (err) {
    const mapped = mapError(err, "Transaction failed");
    // Preserve on-chain logs from SendTransactionError for debugging.
    if (err && typeof err === "object" && "logs" in err) {
      (mapped as unknown as { logs: unknown }).logs = (err as { logs: unknown }).logs;
    }
    throw mapped;
  }
}
