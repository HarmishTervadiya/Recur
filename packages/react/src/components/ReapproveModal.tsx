/**
 * `<ReapproveModal>` — shown when a subscription's delegation is exhausted.
 *
 * Merchants can override the entire UI via the `renderReapproveModal` prop on
 * `<RecurProvider>`. The default renders a centered modal asking the user to
 * confirm a fresh SPL approve.
 */

"use client";

import { useEffect } from "react";
import type { SubscriptionInfo } from "@recur/sdk";
import { useReapprove } from "../hooks/useReapprove.js";
import { ErrorMessage } from "./ErrorMessage.js";
import * as styles from "../internal/styles.js";

export interface ReapproveModalProps {
  subscription: SubscriptionInfo | null;
  onClose: () => void;
  onSuccess?: (signature: string) => void;
  /** Cycles to re-approve. Defaults to 12. */
  cycles?: number;
}

export function ReapproveModal({ subscription, onClose, onSuccess, cycles }: ReapproveModalProps) {
  const { reapprove, isLoading, error, reset } = useReapprove();

  useEffect(() => {
    if (!subscription) reset();
  }, [subscription, reset]);

  useEffect(() => {
    if (!subscription) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [subscription, onClose]);

  if (!subscription) return null;

  const onConfirm = async () => {
    try {
      const sig = await reapprove({ subscription, cycles });
      onSuccess?.(sig);
      onClose();
    } catch {
      // error surfaced via state below
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recur-reapprove-title"
      style={styles.modalBackdrop}
      onClick={onClose}
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 id="recur-reapprove-title" style={{ margin: "0 0 8px 0", fontSize: "18px" }}>
          Re-approve subscription
        </h2>
        <p style={{ margin: "0 0 16px 0", fontSize: "14px", lineHeight: 1.5 }}>
          Your subscription delegation has run out. Approve {cycles ?? 12} more billing cycles
          to keep the subscription active. You can revoke this approval any time.
        </p>
        {error && <ErrorMessage error={error} />}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
          <button type="button" onClick={onClose} style={styles.buttonSecondary}>
            Not now
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            aria-busy={isLoading}
            style={{ ...styles.button, ...(isLoading ? styles.buttonDisabled : null) }}
          >
            {isLoading ? "Confirm in wallet…" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
