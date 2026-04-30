/**
 * `<ConnectButton>` — renders the standard Solana wallet picker modal.
 *
 * Under the hood this delegates to `<WalletMultiButton>` from
 * `@solana/wallet-adapter-react-ui`, which auto-discovers all
 * wallet-standard wallets (Phantom, Backpack, Solflare, etc.) without
 * merchants needing to configure individual adapters.
 */

"use client";

import type { CSSProperties, ReactNode } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export interface ConnectButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function ConnectButton({ className, style, children }: ConnectButtonProps) {
  return (
    <WalletMultiButton className={className} style={style}>
      {children}
    </WalletMultiButton>
  );
}
