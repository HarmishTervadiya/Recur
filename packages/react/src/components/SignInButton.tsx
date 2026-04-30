/**
 * `<SignInButton>` — runs the nonce -> sign -> verify flow against the Recur API.
 *
 * Renders nothing while authenticated; renders a sign-out button if `showSignOut`.
 */

"use client";

import type { CSSProperties, ReactNode } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { ErrorMessage } from "./ErrorMessage.js";
import * as styles from "../internal/styles.js";

export interface SignInButtonProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** When true, render a sign-out button while authenticated. */
  showSignOut?: boolean;
}

export function SignInButton({ className, style, children, showSignOut }: SignInButtonProps) {
  const { isAuthenticated, isAuthenticating, signIn, signOut, error } = useAuth();

  if (isAuthenticated) {
    if (!showSignOut) return null;
    return (
      <button
        type="button"
        onClick={signOut}
        className={className ?? "recur-signout-button"}
        style={{ ...styles.buttonSecondary, ...style }}
      >
        Sign out
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={isAuthenticating}
        aria-busy={isAuthenticating}
        className={className ?? "recur-signin-button"}
        style={{
          ...styles.button,
          ...(isAuthenticating ? styles.buttonDisabled : null),
          ...style,
        }}
      >
        {isAuthenticating ? "Signing in…" : (children ?? "Sign in with Solana")}
      </button>
      <ErrorMessage error={error} />
    </>
  );
}
