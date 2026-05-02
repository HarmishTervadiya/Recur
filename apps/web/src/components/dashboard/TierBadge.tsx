"use client";

import { useTier } from "../../lib/use-tier";

/**
 * Small badge displaying the merchant's current tier in the sidebar.
 * "PRO" is accent-colored; "FREE" is muted.
 */
export function TierBadge() {
  const { tier, isLoading, subscriptionStatus } = useTier();

  if (isLoading) {
    return (
      <div
        className="motion-safe:animate-pulse bg-recur-border rounded-[6px] h-5 w-10"
        aria-hidden="true"
      />
    );
  }

  if (tier === "pro") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-recur-primary/15 text-recur-primary border border-recur-primary/20"
        title={
          subscriptionStatus === "past_due"
            ? "Payment past due — grace period active"
            : "Recur Pro active"
        }
      >
        {subscriptionStatus === "past_due" && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-recur-warning"
            aria-hidden="true"
          />
        )}
        Pro
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-semibold uppercase tracking-wider bg-recur-card text-recur-text-dim border border-recur-border">
      Free
    </span>
  );
}
