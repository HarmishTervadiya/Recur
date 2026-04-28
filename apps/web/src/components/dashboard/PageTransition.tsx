"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Wraps route children in a keyed div so that navigating between
 * pages replays the page-enter animation. The `key={pathname}` forces
 * React to unmount the previous tree and mount the new one, which re-runs
 * the CSS animation on the wrapper element. Animations are auto-disabled
 * for users who prefer reduced motion via the `motion-safe:` Tailwind
 * variant.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="motion-safe:animate-page-enter">
      {children}
    </div>
  );
}
