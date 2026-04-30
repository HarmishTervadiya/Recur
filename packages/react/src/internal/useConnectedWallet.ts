/**
 * Returns a `RecurWallet` derived from `@solana/wallet-adapter-react`,
 * throwing if the wallet isn't connected. Centralizes the `publicKey + sign*`
 * null-check that every action hook would otherwise duplicate.
 */

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { RecurWallet } from "@recur/sdk";

export function useConnectedWallet(): () => RecurWallet {
  const { publicKey, signTransaction, signMessage } = useWallet();
  return useCallback(() => {
    if (!publicKey || !signTransaction || !signMessage) {
      throw new Error("Wallet not connected");
    }
    return {
      publicKey,
      signTransaction: signTransaction as RecurWallet["signTransaction"],
      signMessage,
    };
  }, [publicKey, signTransaction, signMessage]);
}
