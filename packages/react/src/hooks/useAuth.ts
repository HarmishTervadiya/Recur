/**
 * Subscriber auth state + `signIn` / `signOut` actions.
 *
 * Uses the wallet from `@solana/wallet-adapter-react` (mounted by either
 * the merchant's existing provider or `<RecurProvider>`'s fallback).
 */

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { RecurWallet, RecurError } from "@recur/sdk";
import { useRecur } from "./useRecur.js";
import { useAsyncAction } from "../internal/useAsyncAction.js";

export interface UseAuthResult {
  walletAddress: string | null;
  jwt: string | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  isAuthInitializing: boolean;
  error: RecurError | null;
  signIn: () => Promise<void>;
  signOut: () => void;
}

export function useAuth(): UseAuthResult {
  const { authManager, session, setSession, isAuthInitializing } = useRecur();
  const { publicKey, signMessage, signTransaction, disconnect } = useWallet();

  const action = useAsyncAction(async () => {
    if (!publicKey || !signMessage || !signTransaction) {
      throw new Error("Wallet not connected");
    }
    const wallet: RecurWallet = {
      publicKey,
      signMessage,
      signTransaction: signTransaction as RecurWallet["signTransaction"],
    };
    const next = await authManager.signIn(wallet);
    authManager.save(next);
    setSession(next);
  });

  const signOut = useCallback(() => {
    if (session) authManager.clear(session.walletAddress);
    setSession(null);
    void disconnect();
  }, [session, authManager, setSession, disconnect]);

  return {
    walletAddress: publicKey?.toBase58() ?? null,
    jwt: session?.accessToken ?? null,
    isAuthenticated: !!session,
    isAuthenticating: action.isLoading,
    isAuthInitializing,
    error: action.error,
    signIn: async () => {
      await action.run();
    },
    signOut,
  };
}
