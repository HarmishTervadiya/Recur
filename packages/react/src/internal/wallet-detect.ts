/**
 * Detects whether the host app already mounts `@solana/wallet-adapter-react`.
 * `<RecurProvider>` reads this to decide whether to mount its own
 * `<WalletProvider>` fallback or reuse the merchant's existing one.
 */

import { useContext } from "react";
import { WalletContext } from "@solana/wallet-adapter-react";

export function useHasWalletAdapter(): boolean {
  const ctx = useContext(WalletContext);
  return ctx !== null && ctx !== undefined;
}
