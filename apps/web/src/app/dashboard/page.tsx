"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api-client";

interface MerchantProfile {
  id: string;
  walletAddress: string;
  name: string | null;
  email: string | null;
  businessName: string | null;
  apps: { id: string; name: string; isActive: boolean; _count: { plans: number } }[];
}

export default function DashboardOverview() {
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<MerchantProfile>("/merchant/me")
      .then((res) => {
        if (res.success && res.data) setMerchant(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-recur-border rounded-[14px] h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-recur-border rounded-[14px] h-[120px]" />
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
        <div className="dark-card">
          <div className="stat-value">{totalApps}</div>
          <div className="stat-label">Total Apps</div>
        </div>
        <div className="dark-card">
          <div className="stat-value">{activeApps}</div>
          <div className="stat-label">Active Apps</div>
        </div>
        <div className="dark-card">
          <div className="stat-value">{totalPlans}</div>
          <div className="stat-label">Total Plans</div>
        </div>
      </div>

      <div className="dark-card">
        <h2 className="text-[15px] font-bold text-recur-text-heading mb-4">
          Quick Actions
        </h2>
        <div className="flex gap-3 flex-wrap">
          <a href="/dashboard/apps" className="btn-primary text-[13px] px-4 py-2">
            Manage Apps
          </a>
          <a href="/dashboard/settings" className="btn-secondary text-[13px] px-4 py-2">
            Edit Profile
          </a>
        </div>
      </div>
    </div>
  );
}
