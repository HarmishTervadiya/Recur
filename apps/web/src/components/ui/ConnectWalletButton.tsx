"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "../providers/AuthProvider";

export function ConnectWalletButton() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { isAuthenticated, isSigningIn, signIn, signOut, walletAddress } =
    useAuth();

  if (isAuthenticated && walletAddress) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-[11px] font-mono text-recur-text-muted">
          {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
        </span>
        <button
          onClick={signOut}
          className="btn-secondary text-[12px] px-3 py-1.5"
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (connected && !isAuthenticated) {
    return (
      <button
        onClick={signIn}
        disabled={isSigningIn}
        className="btn-primary text-[12px] px-4 py-2 disabled:opacity-50"
      >
        {isSigningIn ? "Signing..." : "Sign In"}
      </button>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      className="btn-primary text-[12px] px-4 py-2"
    >
      Connect Wallet
    </button>
  );
}
