/**
 * `<ConnectButton>` — minimal wallet connect/disconnect toggle.
 *
 * Merchants who want a richer wallet selection modal should keep using
 * `@solana/wallet-adapter-react-ui`'s `<WalletMultiButton>` instead.
 * This component exists so merchants can ship a single `@recur/react`
 * dependency and still have a working connect UI for testing.
 */

"use client";

import type { CSSProperties, ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import * as styles from "../internal/styles.js";

export interface ConnectButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function ConnectButton({ className, style, children }: ConnectButtonProps) {
  const { connected, connecting, connect, disconnect, publicKey, wallet, wallets, select } = useWallet();

  const onConnect = async () => {
    if (!wallet && wallets.length > 0) {
      const first = wallets[0];
      if (first) select(first.adapter.name);
    }
    try {
      await connect();
    } catch {
      // surfaced via wallet-adapter events; intentionally swallow here
    }
  };

  if (connected) {
    return (
      <button
        type="button"
        onClick={() => void disconnect()}
        className={className ?? "recur-connect-button"}
        style={{ ...styles.buttonSecondary, ...style }}
      >
        {publicKey?.toBase58().slice(0, 4)}…{publicKey?.toBase58().slice(-4)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onConnect}
      disabled={connecting}
      aria-busy={connecting}
      className={className ?? "recur-connect-button"}
      style={{ ...styles.button, ...(connecting ? styles.buttonDisabled : null), ...style }}
    >
      {connecting ? "Connecting…" : (children ?? "Connect wallet")}
    </button>
  );
}
