/**
 * `<ManageSubscriptionsCard>` — drop-in subscriber dashboard.
 *
 * Lists the authenticated subscriber's subscriptions and exposes a cancel
 * action per row. Set `cancelMode="instant"` to use `subscriber_cancel`
 * (closes immediately, forfeits prepaid time) instead of the default
 * `request_cancel` (preserves prepaid time).
 */

"use client";

import { useState, type CSSProperties } from "react";
import type { SubscriptionInfo } from "@recur/sdk";
import { useMySubscriptions } from "../hooks/useMySubscriptions.js";
import { useCancelSubscription, type CancelMode } from "../hooks/useCancelSubscription.js";
import { useAuth } from "../hooks/useAuth.js";
import { ReapproveModal } from "./ReapproveModal.js";
import { ErrorMessage } from "./ErrorMessage.js";
import * as styles from "../internal/styles.js";

export interface ManageSubscriptionsCardProps {
  cancelMode?: CancelMode;
  className?: string;
  style?: CSSProperties;
  /** Hide the embedded reapprove modal (merchant supplies their own). */
  disableReapproveModal?: boolean;
}

export function ManageSubscriptionsCard({
  cancelMode = "request",
  className,
  style,
  disableReapproveModal,
}: ManageSubscriptionsCardProps) {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, error, refetch } = useMySubscriptions();
  const { cancel, isLoading: isCancelling } = useCancelSubscription();
  const [reapproveSub, setReapproveSub] = useState<SubscriptionInfo | null>(null);

  if (!isAuthenticated) {
    return (
      <div className={className ?? "recur-manage-card"} style={{ ...styles.card, ...style }}>
        <p style={{ margin: 0, fontSize: "14px" }}>Sign in to view your subscriptions.</p>
      </div>
    );
  }

  return (
    <div className={className ?? "recur-manage-card"} style={{ ...styles.card, ...style }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>Your subscriptions</h3>
      {isLoading && <p style={{ fontSize: "14px" }}>Loading…</p>}
      {error && <ErrorMessage error={error} />}
      {data && data.length === 0 && (
        <p style={{ margin: 0, fontSize: "14px" }}>No active subscriptions.</p>
      )}
      {data && data.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {data.map((sub) => (
            <SubscriptionRow
              key={sub.id}
              subscription={sub}
              isBusy={isCancelling}
              onCancel={async () => {
                await cancel(sub, cancelMode);
                await refetch();
              }}
              onReapprove={() => setReapproveSub(sub)}
            />
          ))}
        </ul>
      )}

      {!disableReapproveModal && (
        <ReapproveModal
          subscription={reapproveSub}
          onClose={() => setReapproveSub(null)}
          onSuccess={() => void refetch()}
        />
      )}
    </div>
  );
}

interface RowProps {
  subscription: SubscriptionInfo;
  isBusy: boolean;
  onCancel: () => Promise<void> | void;
  onReapprove: () => void;
}

function SubscriptionRow({ subscription, isBusy, onCancel, onReapprove }: RowProps) {
  const plan = subscription.plan;
  const isCancelled = subscription.status !== "active";

  return (
    <li style={styles.row}>
      <div>
        <div style={{ fontWeight: 600, fontSize: "14px" }}>{plan?.name ?? "Subscription"}</div>
        <div style={{ fontSize: "12px", opacity: 0.7 }}>
          Status: {subscription.status}
          {subscription.nextPaymentDue && ` · Next: ${new Date(subscription.nextPaymentDue).toLocaleDateString()}`}
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {!isCancelled && (
          <button
            type="button"
            onClick={onReapprove}
            style={{ ...styles.buttonSecondary, padding: "6px 10px", fontSize: "12px" }}
          >
            Re-approve
          </button>
        )}
        {!isCancelled && (
          <button
            type="button"
            onClick={() => void onCancel()}
            disabled={isBusy}
            aria-busy={isBusy}
            style={{
              ...styles.buttonSecondary,
              padding: "6px 10px",
              fontSize: "12px",
              ...(isBusy ? styles.buttonDisabled : null),
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </li>
  );
}
