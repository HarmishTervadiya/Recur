"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { PageTransition } from "./PageTransition";
import { RecurLogoIcon } from "../icons/RecurLogoIcon";

interface DashboardShellProps {
  children: ReactNode;
}

/**
 * Authenticated dashboard shell — handles auth gate, mobile menu state,
 * ESC-to-close, and focus return. All client-side concerns are isolated here
 * so the route layout itself stays a Server Component.
 */
export function DashboardShell({ children }: DashboardShellProps) {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const sidebarId = useId();

  // Redirect unauthenticated users to landing
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  // ESC closes mobile menu and returns focus to trigger
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  if (isAuthLoading || !isAuthenticated) {
    return <DashboardSkeleton />;
  }

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-recur-base flex">
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-recur-surface border-b border-recur-border flex items-center justify-between px-4 lg:hidden z-50">
        <div className="flex items-center gap-2">
          <RecurLogoIcon size={20} />
          <span className="text-[14px] font-bold text-recur-text-heading">
            Recur
          </span>
        </div>
        <button
          ref={menuButtonRef}
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="p-2 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-recur-text-muted hover:text-recur-text-heading transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-purple focus-visible:ring-offset-2 focus-visible:ring-offset-recur-surface rounded-md"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls={sidebarId}
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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden motion-safe:animate-fade-in"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — always visible on lg, slide-in on mobile */}
      <div
        id={sidebarId}
        className={`fixed left-0 top-0 h-screen z-50 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <DashboardSidebar onNavigate={closeMobileMenu} />
      </div>

      <main className="flex-1 ml-0 lg:ml-[240px] min-h-screen pt-14 lg:pt-0">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}
