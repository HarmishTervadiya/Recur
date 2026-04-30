/**
 * Subscriber auth state + `signIn` / `signOut` / `ensureAuthenticated` actions.
 *
 * Uses the wallet from `@solana/wallet-adapter-react` (mounted by either
 * the merchant's existing provider or `<RecurProvider>`'s fallback).
 */

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { RecurError } from "@recur/sdk";
import { useRecur } from "./useRecur.js";
import { useAsyncAction } from "../internal/useAsyncAction.js";
import { useConnectedWallet } from "../internal/useConnectedWallet.js";

export interface UseAuthResult {
  walletAddress: string | null;
  jwt: string | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  isAuthInitializing: boolean;
  error: RecurError | null;
  signIn: () => Promise<string>;
  signOut: () => void;
  /** Returns a valid JWT, signing in if necessary. Used by other hooks. */
  ensureAuthenticated: () => Promise<string>;
}

export function useAuth(): UseAuthResult {
  const { authManager, session, setSession, isAuthInitializing } = useRecur();
  const { publicKey, disconnect } = useWallet();
  const getWallet = useConnectedWallet();

  const action = useAsyncAction(async (): Promise<string> => {
    const next = await authManager.signIn(getWallet());
    authManager.save(next);
    setSession(next);
    return next.accessToken;
  });

  const ensureAuthenticated = useCallback(async (): Promise<string> => {
    if (session && session.expiresAt - 60_000 > Date.now()) return session.accessToken;
    if (!publicKey) throw new Error("Wallet not connected");
    const cached = authManager.load(publicKey.toBase58());
    if (cached) {
      setSession(cached);
      return cached.accessToken;
    }
    return action.run();
  }, [session, publicKey, authManager, setSession, action]);

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
    signIn: action.run,
    signOut,
    ensureAuthenticated,
  };
}
