"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "../../../../lib/api-client";
import { useToast } from "../../../../components/ui/ToastProvider";
import { AppHeader } from "./_components/AppHeader";
import { AppTabs } from "./_components/AppTabs";
import { PlansTab } from "./_components/PlansTab";
import { TransactionsTab } from "./_components/TransactionsTab";
import { WebhooksTab } from "./_components/WebhooksTab";
import { EditAppModal } from "./_components/EditAppModal";
import type { AppDetail, Plan, Tab } from "./_components/utils";

export default function AppDetailPage() {
  const params = useParams();
  const appId = params.appId as string;

  const [app, setApp] = useState<AppDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("plans");
  const [showEditApp, setShowEditApp] = useState(false);
  const { toast } = useToast();

  const fetchApp = useCallback(
    async (signal?: AbortSignal) => {
      const [appRes, plansRes] = await Promise.all([
        apiClient<AppDetail>(`/merchant/apps/${appId}`),
        apiClient<Plan[]>(`/merchant/apps/${appId}/plans`),
      ]);
      if (signal?.aborted) return;
      if (appRes.success && appRes.data) setApp(appRes.data);
      if (plansRes.success && plansRes.data) setPlans(plansRes.data);
      setLoading(false);
    },
    [appId],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchApp(controller.signal);
    return () => controller.abort();
  }, [fetchApp]);

  const handleToggleActive = useCallback(async () => {
    if (!app) return;
    const res = await apiClient<AppDetail>(`/merchant/apps/${appId}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !app.isActive }),
    });
    if (res.success && res.data) {
      setApp(res.data);
      toast(
        "success",
        res.data.isActive ? "App activated" : "App deactivated",
      );
    } else {
      toast("error", res.error?.message ?? "Failed to toggle app");
    }
  }, [app, appId, toast]);

  if (loading) {
    return (
      <div
        className="space-y-4"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading app details…</span>
        <div
          className="motion-safe:animate-pulse bg-recur-border rounded-[14px] h-8 w-48"
          aria-hidden="true"
        />
        <div
          className="motion-safe:animate-pulse bg-recur-border rounded-[14px] h-[200px]"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="dark-card text-center py-16">
        <p className="text-recur-text-muted text-[13px] mb-4">App not found.</p>
        <Link
          href="/dashboard/apps"
          className="btn-secondary text-[13px] px-4 py-2"
        >
          Back to Apps
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AppHeader
        app={app}
        onEdit={() => setShowEditApp(true)}
        onToggleActive={handleToggleActive}
      />

      <AppTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "plans" && (
        <PlansTab appId={appId} plans={plans} onRefresh={fetchApp} />
      )}
      {activeTab === "transactions" && <TransactionsTab appId={appId} />}
      {activeTab === "webhooks" && <WebhooksTab appId={appId} />}

      <EditAppModal
        open={showEditApp}
        app={app}
        onClose={() => setShowEditApp(false)}
        onSaved={(updated) => setApp(updated)}
      />
    </div>
  );
}
