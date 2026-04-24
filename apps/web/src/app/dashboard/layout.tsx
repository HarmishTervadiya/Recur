"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/providers/AuthProvider";
import { DashboardSidebar } from "../../components/dashboard/DashboardSidebar";
import { RecurLogoIcon } from "../../components/icons/RecurLogoIcon";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-recur-base flex">
      {/* Sidebar skeleton — desktop only */}
      <div className="hidden lg:block fixed left-0 top-0 h-screen w-[240px] bg-recur-surface border-r border-recur-border">
        <div className="px-5 py-5 border-b border-recur-border">
          <div className="flex items-center gap-2">
            <RecurLogoIcon size={24} />
            <span className="text-[15px] font-bold text-recur-text-heading">Recur</span>
          </div>
        </div>
        <div className="p-3 space-y-2 mt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-recur-border/50 rounded-[10px] h-10 w-full" />
          ))}
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex-1 ml-0 lg:ml-[240px] min-h-screen pt-14 lg:pt-0">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="animate-pulse bg-recur-border/50 rounded-[14px] h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-recur-border/30 rounded-[14px] h-[120px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  if (isAuthLoading) {
    return <DashboardSkeleton />;
  }

  if (!isAuthenticated) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-recur-base flex">
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-recur-surface border-b border-recur-border flex items-center justify-between px-4 lg:hidden z-50">
        <div className="flex items-center gap-2">
          <RecurLogoIcon size={20} />
          <span className="text-[14px] font-bold text-recur-text-heading">Recur</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-recur-text-muted hover:text-recur-text-heading transition-colors"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — always visible on lg, slide-in on mobile */}
      <div className={`fixed left-0 top-0 h-screen z-50 transition-transform duration-200 lg:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <DashboardSidebar onNavigate={() => setMobileMenuOpen(false)} />
      </div>

      <main className="flex-1 ml-0 lg:ml-[240px] min-h-screen pt-14 lg:pt-0">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
