"use client";

interface UpgradeUpsellProps {
  feature?: string;
  compact?: boolean;
}

/**
 * CTA component shown in place of Pro-gated features for free-tier merchants.
 */
export function UpgradeUpsell({
  feature,
  compact = false,
}: UpgradeUpsellProps) {
  if (compact) {
    return (
      <a
        href="/dashboard/settings#recur-pro"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-recur-primary hover:underline"
      >
        <LockIcon />
        Upgrade to Pro
      </a>
    );
  }

  return (
    <div className="relative overflow-hidden border border-recur-border rounded-[14px] bg-recur-surface p-6">
      {/* Gradient accent */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-recur-primary via-recur-light to-recur-primary" />

      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-recur-primary/10 shrink-0">
          <LockIcon className="w-5 h-5 text-recur-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-recur-text-heading mb-1">
            Unlock{feature ? ` ${feature}` : " Pro Features"}
          </h3>
          <p className="text-[13px] text-recur-text-muted mb-4 leading-relaxed">
            Upgrade to Recur Pro for advanced analytics, CSV exports, and
            priority support. $49/mo USDC, cancel anytime.
          </p>

          <a
            href="/dashboard/settings#recur-pro"
            className="btn-primary inline-flex items-center gap-2 text-[13px] px-5 py-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 12l2.5-4L7 10l4.5-8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Upgrade to Pro
          </a>
        </div>
      </div>
    </div>
  );
}

function LockIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
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
  );
}
