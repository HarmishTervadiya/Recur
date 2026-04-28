"use client";

import Link from "next/link";
import type { AppDetail } from "./utils";

interface AppHeaderProps {
  app: AppDetail;
  onEdit: () => void;
  onToggleActive: () => void;
}

export function AppHeader({ app, onEdit, onToggleActive }: AppHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/dashboard/apps"
            className="text-[12px] text-recur-text-dim hover:text-recur-light motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary focus-visible:ring-offset-2 focus-visible:ring-offset-recur-base rounded"
          >
            Apps
          </Link>
          <span className="text-[12px] text-recur-text-dim" aria-hidden="true">
            /
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[26px] font-bold text-recur-text-heading">
            {app.name}
          </h1>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              app.isActive
                ? "text-recur-success bg-recur-success/10 border border-recur-success/20"
                : "text-recur-text-dim bg-recur-card border border-recur-border"
            }`}
          >
            {app.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        {app.description && (
          <p className="text-[13px] text-recur-text-muted mt-1">
            {app.description}
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onEdit}
          className="btn-secondary text-[12px] px-3 py-1.5"
        >
          Edit
        </button>
        <button
          onClick={onToggleActive}
          className="btn-secondary text-[12px] px-3 py-1.5"
          aria-label={
            app.isActive ? "Deactivate this app" : "Activate this app"
          }
        >
          {app.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  );
}
