/**
 * `<SubscribeButton>` — drop-in subscribe button for a single plan.
 *
 * Wraps `useSubscribe` + `useAuth`. Merchants who want a different look or
 * placement should use `useSubscribe` directly with their own button.
 */

"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { SubscriptionInfo } from "@recur/sdk";
import { useSubscribe } from "../hooks/useSubscribe.js";
import { ErrorMessage } from "./ErrorMessage.js";
import * as styles from "../internal/styles.js";

export interface SubscribeButtonProps {
  appId: string;
  planId: string;
  /** Override default delegation horizon (cycles). Defaults to 12. */
  delegationCycles?: number;
  onSuccess?: (subscription: SubscriptionInfo) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  disabled?: boolean;
}

export function SubscribeButton({
  appId,
  planId,
  delegationCycles,
  onSuccess,
  onError,
  className,
  style,
  children,
  disabled,
}: SubscribeButtonProps) {
  const { subscribe, isLoading, error } = useSubscribe();
  const [errorOpen, setErrorOpen] = useState(true);

  const onClick = async () => {
    setErrorOpen(true);
    try {
      const sub = await subscribe({ appId, planId, delegationCycles });
      onSuccess?.(sub);
    } catch (err) {
      onError?.(err as Error);
    }
  };

  const isDisabled = disabled || isLoading;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={className ?? "recur-subscribe-button"}
        style={{ ...styles.button, ...(isDisabled ? styles.buttonDisabled : null), ...style }}
      >
        {isLoading ? "Confirm in wallet…" : (children ?? "Subscribe")}
      </button>
      {errorOpen && <ErrorMessage error={error} />}
    </>
  );
}
