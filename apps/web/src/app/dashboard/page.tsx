"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "../../lib/api-client";

interface MerchantApp {
  id: string;
  name: string;
  isActive: boolean;
  _count: { plans: number };
}

interface MerchantProfile {
  id: string;
  walletAddress: string;
  name: string | null;
  email: string | null;
  businessName: string | null;
  apps: MerchantApp[];
}

function AppsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ActiveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlansIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5.5 3L9.5 7L5.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface StatCardProps {
  href: string;
  icon: React.ReactNode;
  value: number;
  label: string;
  accentColor: string;
}

function StatCard({ href, icon, value, label, accentColor }: StatCardProps) {
  return (
    <Link
      href={href}
      className="dark-card group relative overflow-hidden hover:border-recur-border-light transition-all duration-200 cursor-pointer"
    >
      {/* Accent glow */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="stat-value">{value}</div>
          <div className="stat-label mt-1">{label}</div>
        </div>
        <div className={`p-2 rounded-[10px] bg-recur-card text-recur-text-muted group-hover:text-recur-light transition-colors duration-200`}>
          {icon}
        </div>
      </div>
      <div className="flex items-center gap-1 mt-4 text-[11px] text-recur-text-dim group-hover:text-recur-text-muted transition-colors duration-200">
        <span>View details</span>
        <ArrowRightIcon />
      </div>
    </Link>
  );
}

export default function DashboardOverview() {
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiClient<MerchantProfile>("/merchant/me")
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) setMerchant(res.data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="space-y-6"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading dashboard…</span>
        <div className="motion-safe:animate-pulse bg-recur-border/50 rounded-[14px] h-8 w-48" aria-hidden="true" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="motion-safe:animate-pulse bg-recur-border/30 rounded-[14px] h-[140px]" />
          ))}
        </div>
      </div>
    );
  }

  const totalApps = merchant?.apps?.length ?? 0;
  const activeApps = merchant?.apps?.filter((a) => a.isActive).length ?? 0;
  const totalPlans = merchant?.apps?.reduce((sum, a) => sum + (a._count?.plans ?? 0), 0) ?? 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[26px] font-bold text-recur-text-heading mb-1">
          Dashboard
        </h1>
        <p className="text-[13px] text-recur-text-muted">
          Welcome back{merchant?.businessName ? `, ${merchant.businessName}` : ""}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          href="/dashboard/apps"
          icon={<AppsIcon />}
          value={totalApps}
          label="Total Apps"
          accentColor="#7C3AED"
        />
        <StatCard
          href="/dashboard/apps"
          icon={<ActiveIcon />}
          value={activeApps}
          label="Active Apps"
          accentColor="#34D399"
        />
        <StatCard
          href="/dashboard/apps"
          icon={<PlansIcon />}
          value={totalPlans}
          label="Total Plans"
          accentColor="#A78BFA"
        />
      </div>

      {/* Recent apps */}
      {merchant?.apps && merchant.apps.length > 0 && (
        <div className="dark-card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-recur-text-heading">
              Recent Apps
            </h2>
            <Link
              href="/dashboard/apps"
              className="text-[12px] text-recur-text-muted hover:text-recur-light transition-colors duration-200 flex items-center gap-1"
            >
              View all <ArrowRightIcon />
            </Link>
          </div>
          <div className="space-y-2">
            {merchant.apps.slice(0, 3).map((app) => (
              <Link
                key={app.id}
                href={`/dashboard/apps/${app.id}`}
                className="flex items-center justify-between py-3 px-4 bg-recur-base border border-recur-border rounded-[10px] hover:border-recur-border-light transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${app.isActive ? "bg-recur-success" : "bg-recur-text-dim"}`} />
                  <span className="text-[13px] font-medium text-recur-text-heading">{app.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-recur-text-muted">
                    {app._count.plans} {app._count.plans === 1 ? "plan" : "plans"}
                  </span>
                  <span className="text-recur-text-dim group-hover:text-recur-text-muted transition-colors duration-200">
                    <ArrowRightIcon />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Profile completion prompt — only if profile is incomplete */}
      {merchant && (!merchant.name || !merchant.email || !merchant.businessName) && (
        <div className="dark-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-recur-warning/10">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="text-recur-warning">
                <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 5.5v4M9 12.5v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-medium text-recur-text-heading">Complete your profile</p>
              <p className="text-[11px] text-recur-text-muted">
                Add your {!merchant.name ? "name" : !merchant.email ? "email" : "business name"} to build trust with subscribers.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/settings"
            className="btn-secondary text-[12px] px-3 py-1.5 shrink-0"
          >
            Complete
          </Link>
        </div>
      )}
    </div>
  );
}
