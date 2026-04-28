"use client";

import type { Tab } from "./utils";

interface AppTabsProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: Tab[] = ["plans", "transactions", "webhooks"];

export function AppTabs({ active, onChange }: AppTabsProps) {
  return (
    <div
      className="flex gap-1 mb-6 border-b border-recur-border"
      role="tablist"
      aria-label="App sections"
    >
      {TABS.map((tab) => {
        const isActive = active === tab;
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab}`}
            id={`tab-${tab}`}
            onClick={() => onChange(tab)}
            className={`text-[13px] font-medium px-4 py-2.5 border-b-2 motion-safe:transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary focus-visible:ring-offset-2 focus-visible:ring-offset-recur-base rounded-t ${
              isActive
                ? "text-recur-light border-recur-primary"
                : "text-recur-text-muted border-transparent hover:text-recur-text-heading"
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
