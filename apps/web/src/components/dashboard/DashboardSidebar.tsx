"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RecurLogoIcon } from "../icons/RecurLogoIcon";
import { useAuth } from "../providers/AuthProvider";
import { ThemeToggle } from "../ui/ThemeToggle";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: "grid" },
  { label: "Apps", href: "/dashboard/apps", icon: "box" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
];

function NavIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "grid":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "box":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "settings":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

interface DashboardSidebarProps {
  onNavigate?: () => void;
}

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { walletAddress, signOut } = useAuth();

  return (
    <aside className="h-screen w-[240px] bg-recur-surface border-r border-recur-border flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-recur-border">
        <div className="flex items-center gap-2">
          <RecurLogoIcon size={24} />
          <span className="text-[15px] font-bold text-recur-text-heading">Recur</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-recur-purple-tint text-recur-light border border-recur-border-light"
                    : "text-recur-text-muted hover:text-recur-text-heading hover:bg-recur-card border border-transparent"
                }`}
              >
                <NavIcon icon={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Wallet info */}
      <div className="px-3 py-4 border-t border-recur-border">
        {walletAddress && (
          <div className="px-3 mb-3">
            <div className="text-[10px] text-recur-text-dim uppercase tracking-wider mb-1">
              Wallet
            </div>
            <div className="text-[11px] font-mono text-recur-text-muted">
              {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] text-recur-text-muted hover:text-recur-error hover:bg-recur-error/5 transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M5 1H3a2 2 0 00-2 2v8a2 2 0 002 2h2M9 10l3-3-3-3M5 7h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
