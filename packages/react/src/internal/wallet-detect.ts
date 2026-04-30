/**
 * Detects whether the host app already mounts `@solana/wallet-adapter-react`.
 * `<RecurProvider>` reads this to decide whether to mount its own
 * `<WalletProvider>` fallback or reuse the merchant's existing one.
 *
 * `WalletContext` from `@solana/wallet-adapter-react` ships with a non-null
 * `DEFAULT_CONTEXT` whose getters log a "missing provider" error. We can't
 * compare references to that internal value, but we can detect it: a real
 * `WalletProvider` always supplies `select` as a stable function bound to its
 * internal state. The default's `select` just logs an error and returns void.
 * We sniff this by checking whether `connect`/`disconnect` are bound — when
 * the default object is returned, calling them rejects with an error, but
 * crucially the default's `wallets` getter is defined as a property descriptor
 * that returns the same EMPTY_ARRAY singleton. We test that instead, since a
 * real `WalletProvider` always sets `wallets` as an own data property on the
 * context value object.
 */

import { useContext } from "react";
import { WalletContext } from "@solana/wallet-adapter-react";

export function useHasWalletAdapter(): boolean {
  const ctx = useContext(WalletContext);
  if (!ctx) return false;
  // The default context defines `wallets`/`wallet`/`publicKey` via
  // Object.defineProperty getters that log warnings. A real WalletProvider
  // sets them as plain enumerable own properties on a fresh object each render.
  const descriptor = Object.getOwnPropertyDescriptor(ctx, "wallets");
  if (descriptor && typeof descriptor.get === "function") return false;
  return true;
}
