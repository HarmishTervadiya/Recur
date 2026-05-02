"use client";

import { useTier } from "../../lib/use-tier";

interface TierGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children only if the merchant has Pro tier.
 * Shows the fallback (default: UpgradeUpsell) when the merchant is on the free tier.
 */
export function TierGate({ children, fallback }: TierGateProps) {
  const { isPro, isLoading } = useTier();

  if (isLoading) {
    return (
      <div
        className="motion-safe:animate-pulse bg-recur-border rounded-[10px] h-10 w-full"
        aria-hidden="true"
      />
    );
  }

  if (!isPro) {
    return <>{fallback ?? <DefaultUpgradeMessage />}</>;
  }

  return <>{children}</>;
}

function DefaultUpgradeMessage() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-recur-surface border border-recur-border rounded-[10px] text-[13px] text-recur-text-muted">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="shrink-0 text-recur-primary"
      >
        <rect
          x="3"
          y="7"
          width="10"
          height="8"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M5 7V5a3 3 0 016 0v2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span>
        This feature requires{" "}
        <a
          href="/dashboard/settings#recur-pro"
          className="text-recur-primary font-medium hover:underline"
        >
          Recur Pro
        </a>
      </span>
    </div>
  );
}
