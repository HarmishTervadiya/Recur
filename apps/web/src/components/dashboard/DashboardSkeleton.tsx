import { RecurLogoIcon } from "../icons/RecurLogoIcon";

/**
 * Static loading skeleton for the dashboard shell.
 * Server component — no client JS needed.
 */
export function DashboardSkeleton() {
  return (
    <div
      className="min-h-screen bg-recur-base flex"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading dashboard…</span>

      {/* Sidebar skeleton — desktop only */}
      <div
        className="hidden lg:block fixed left-0 top-0 h-screen w-[240px] bg-recur-surface border-r border-recur-border"
        aria-hidden="true"
      >
        <div className="px-5 py-5 border-b border-recur-border">
          <div className="flex items-center gap-2">
            <RecurLogoIcon size={24} />
            <span className="text-[15px] font-bold text-recur-text-heading">
              Recur
            </span>
          </div>
        </div>
        <div className="p-3 space-y-2 mt-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="motion-safe:animate-pulse bg-recur-border/50 rounded-[10px] h-10 w-full"
            />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div
        className="flex-1 ml-0 lg:ml-[240px] min-h-screen pt-14 lg:pt-0"
        aria-hidden="true"
      >
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="motion-safe:animate-pulse bg-recur-border/50 rounded-[14px] h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="motion-safe:animate-pulse bg-recur-border/30 rounded-[14px] h-[120px]"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
