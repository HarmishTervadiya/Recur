/**
 * `<RecurProvider>` — top-level context provider for `@recur/react`.
 *
 * Responsibilities:
 *   1. Instantiate a single `RecurClient` for L3/L4 SDK calls
 *   2. Wrap children in `@solana/wallet-adapter-react`'s
 *      `<ConnectionProvider>` + `<WalletProvider>` *only* if the host app
 *      hasn't already mounted them (auto-detect via `WalletContext`).
 *   3. Manage subscriber JWT auth (nonce -> sign -> verify) and expose
 *      it via `useAuth()`.
 */

"use client";

import {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import type { Adapter } from "@solana/wallet-adapter-base";
import { RecurClient, getClusterDefaults, type Cluster } from "@recur/sdk";
import { AuthManager, type AuthSession } from "./AuthManager.js";
import { useHasWalletAdapter } from "../internal/wallet-detect.js";

export interface RecurContextValue {
  client: RecurClient;
  apiBaseUrl: string;
  cluster: Cluster;
  rpcUrl: string;
  authManager: AuthManager;
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  isAuthInitializing: boolean;
}

export const RecurContext = createContext<RecurContextValue | null>(null);

export interface RecurProviderProps {
  children: ReactNode;
  /** Recur API base URL, e.g. `https://api.recur.so` or `http://localhost:3001`. */
  apiBaseUrl: string;
  /** Solana cluster — drives default RPC URL, program ID, USDC mint. */
  cluster: Cluster;
  /** Optional RPC URL override; defaults to the cluster's public endpoint. */
  rpcUrl?: string;
  /** Optional wallet adapters to mount when no host `<WalletProvider>` is present. */
  wallets?: Adapter[];
  /** Disable Recur's auth flow entirely; merchant supplies JWT externally. */
  disableAuth?: boolean;
  /** Skip mounting `<WalletProvider>` even if no host context is detected. */
  disableWallet?: boolean;
}

export function RecurProvider({
  children,
  apiBaseUrl,
  cluster,
  rpcUrl,
  wallets,
  disableAuth,
  disableWallet,
}: RecurProviderProps) {
  const defaults = getClusterDefaults(cluster);
  const effectiveRpc = rpcUrl ?? defaults.rpcUrl;
  const hasHostWallet = useHasWalletAdapter();
  const shouldMountWallet = !hasHostWallet && !disableWallet;

  const inner = (
    <RecurContextProvider
      apiBaseUrl={apiBaseUrl}
      cluster={cluster}
      rpcUrl={effectiveRpc}
      disableAuth={disableAuth}
    >
      {children}
    </RecurContextProvider>
  );

  if (!shouldMountWallet) return inner;

  return (
    <ConnectionProvider endpoint={effectiveRpc}>
      <SolanaWalletProvider wallets={wallets ?? []} autoConnect>
        {inner}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

interface InnerProps {
  children: ReactNode;
  apiBaseUrl: string;
  cluster: Cluster;
  rpcUrl: string;
  disableAuth?: boolean;
}

function RecurContextProvider({
  children,
  apiBaseUrl,
  cluster,
  rpcUrl,
  disableAuth,
}: InnerProps) {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const client = useMemo(() => {
    const defaults = getClusterDefaults(cluster);
    return new RecurClient({
      rpcUrl,
      apiBaseUrl,
      programId: defaults.programId,
      usdcMint: defaults.usdcMint,
    });
  }, [apiBaseUrl, cluster, rpcUrl]);

  const authManager = useMemo(
    () => new AuthManager({ apiBaseUrl, role: "subscriber" }),
    [apiBaseUrl],
  );

  const [session, setSession] = useState<AuthSession | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const lastWalletRef = useRef<string | null>(null);

  useEffect(() => {
    if (disableAuth) {
      setIsAuthInitializing(false);
      return;
    }

    if (!walletAddress) {
      if (lastWalletRef.current) {
        authManager.clear(lastWalletRef.current);
        setSession(null);
        lastWalletRef.current = null;
      }
      setIsAuthInitializing(false);
      return;
    }

    if (lastWalletRef.current !== walletAddress) {
      const cached = authManager.load(walletAddress);
      setSession(cached);
      lastWalletRef.current = walletAddress;
    }
    setIsAuthInitializing(false);
  }, [walletAddress, authManager, disableAuth]);

  const value = useMemo<RecurContextValue>(
    () => ({
      client,
      apiBaseUrl,
      cluster,
      rpcUrl,
      authManager,
      session,
      setSession,
      isAuthInitializing,
    }),
    [client, apiBaseUrl, cluster, rpcUrl, authManager, session, isAuthInitializing],
  );

  return <RecurContext.Provider value={value}>{children}</RecurContext.Provider>;
}
