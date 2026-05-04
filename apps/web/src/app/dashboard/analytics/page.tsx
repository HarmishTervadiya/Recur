"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../../../lib/api-client";

interface AnalyticsData {
  totalRevenue: string;
  activeSubscriptions: number;
  totalSubscribers: number;
  mrr: string;
  revenueByDay: { date: string; amount: string }[];
  subscriptionsByStatus: {
    active: number;
    cancelled: number;
    past_due: number;
    expired: number;
  };
  topPlans: {
    id: string;
    name: string;
    price: string;
    interval: string;
    activeCount: number;
  }[];
}

function formatUsdc(baseUnits: string): string {
  const num = Number(BigInt(baseUnits || "0")) / 1e6;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatCard({
  label,
  value,
  prefix,
}: {
  label: string;
  value: string | number;
  prefix?: string;
}) {
  return (
    <div className="dark-card flex flex-col gap-1">
      <span className="text-[11px] text-recur-text-dim uppercase tracking-wide">
        {label}
      </span>
      <span className="text-[22px] font-bold text-recur-text-heading">
        {prefix}
        {value}
      </span>
    </div>
  );
}

function MiniBarChart({ data }: { data: { date: string; amount: string }[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[120px] text-[12px] text-recur-text-dim">
        No revenue data yet
      </div>
    );
  }

  const values = data.map((d) => Number(BigInt(d.amount)) / 1e6);
  const max = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-[3px] h-[120px]" aria-label="Revenue chart">
      {data.map((d, i) => {
        const height = Math.max((values[i] / max) * 100, 2);
        return (
          <div
            key={d.date}
            className="flex-1 min-w-[4px] rounded-t-[3px] bg-recur-light/70 hover:bg-recur-light motion-safe:transition-colors"
            style={{ height: `${height}%` }}
            title={`${d.date}: $${values[i].toFixed(2)}`}
          />
        );
      })}
    </div>
  );
}

function StatusDonut({
  data,
}: {
  data: { active: number; cancelled: number; past_due: number; expired: number };
}) {
  const total = data.active + data.cancelled + data.past_due + data.expired;
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[120px] text-[12px] text-recur-text-dim">
        No subscriptions yet
      </div>
    );
  }

  const segments = [
    { label: "Active", count: data.active, color: "#6ee7b7" },
    { label: "Cancelled", count: data.cancelled, color: "#f87171" },
    { label: "Past Due", count: data.past_due, color: "#fbbf24" },
    { label: "Expired", count: data.expired, color: "#94a3b8" },
  ].filter((s) => s.count > 0);

  let offset = 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-6">
      <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
        {segments.map((seg) => {
          const pct = seg.count / total;
          const dashLen = pct * circumference;
          const dashOffset = -offset * circumference;
          offset += pct;
          return (
            <circle
              key={seg.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="12"
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 50 50)"
            />
          );
        })}
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-[11px]">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: seg.color }}
            />
            <span className="text-recur-text-muted">
              {seg.label}: {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async (signal?: AbortSignal) => {
    const res = await apiClient<AnalyticsData>("/merchant/me/analytics");
    if (signal?.aborted) return;
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAnalytics(controller.signal);
    return () => controller.abort();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading analytics…</span>
        <div className="motion-safe:animate-pulse bg-recur-border/50 rounded-[14px] h-8 w-40" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="motion-safe:animate-pulse bg-recur-border/30 rounded-[14px] h-[80px]" />
          ))}
        </div>
        <div className="motion-safe:animate-pulse bg-recur-border/30 rounded-[14px] h-[200px]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-[13px] text-recur-text-muted">
        Failed to load analytics data.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[26px] font-bold text-recur-text-heading mb-1">
          Analytics
        </h1>
        <p className="text-[13px] text-recur-text-muted">
          Revenue, subscribers, and subscription metrics across all your apps.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 motion-safe:animate-page-enter">
        <StatCard label="Total Revenue" value={formatUsdc(data.totalRevenue)} prefix="$" />
        <StatCard label="MRR" value={formatUsdc(data.mrr)} prefix="$" />
        <StatCard label="Active Subscriptions" value={data.activeSubscriptions} />
        <StatCard label="Total Subscribers" value={data.totalSubscribers} />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Revenue Chart */}
        <section
          className="dark-card motion-safe:animate-page-enter"
          style={{ animationDelay: "60ms" }}
        >
          <h2 className="text-[15px] font-bold text-recur-text-heading mb-4">
            Revenue (Last 30 Days)
          </h2>
          <MiniBarChart data={data.revenueByDay} />
        </section>

        {/* Status Donut */}
        <section
          className="dark-card motion-safe:animate-page-enter"
          style={{ animationDelay: "90ms" }}
        >
          <h2 className="text-[15px] font-bold text-recur-text-heading mb-4">
            Subscription Status
          </h2>
          <StatusDonut data={data.subscriptionsByStatus} />
        </section>
      </div>

      {/* Top Plans Table */}
      <section
        className="dark-card motion-safe:animate-page-enter"
        style={{ animationDelay: "120ms" }}
      >
        <h2 className="text-[15px] font-bold text-recur-text-heading mb-4">
          Top Plans
        </h2>
        {data.topPlans.length === 0 ? (
          <p className="text-[12px] text-recur-text-dim">No plans yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-recur-text-dim border-b border-recur-border">
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Price</th>
                  <th className="pb-2 pr-4 font-medium">Interval</th>
                  <th className="pb-2 font-medium text-right">Active Subs</th>
                </tr>
              </thead>
              <tbody>
                {data.topPlans.map((plan) => (
                  <tr
                    key={plan.id}
                    className="border-b border-recur-border/50 last:border-0"
                  >
                    <td className="py-2.5 pr-4 text-recur-text-heading font-medium">
                      {plan.name}
                    </td>
                    <td className="py-2.5 pr-4 text-recur-text-muted">
                      ${formatUsdc(plan.price)}
                    </td>
                    <td className="py-2.5 pr-4 text-recur-text-muted capitalize">
                      {plan.interval}
                    </td>
                    <td className="py-2.5 text-right text-recur-text-heading">
                      {plan.activeCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
