"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "../../../../lib/api-client";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  amountBaseUnits: number;
  intervalSeconds: number;
  isActive: boolean;
  planSeed: string;
  createdAt: string;
}

interface AppDetail {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  plans?: Plan[];
}

const INTERVAL_OPTIONS = [
  { label: "Weekly", seconds: 604800 },
  { label: "Monthly", seconds: 2592000 },
  { label: "Quarterly", seconds: 7776000 },
  { label: "Yearly", seconds: 31536000 },
];

function formatAmount(baseUnits: number): string {
  return `$${(baseUnits / 1_000_000).toFixed(2)}`;
}

function formatInterval(seconds: number): string {
  const match = INTERVAL_OPTIONS.find((o) => o.seconds === seconds);
  if (match) return match.label;
  const days = Math.round(seconds / 86400);
  return `${days}d`;
}

export default function AppDetailPage() {
  const params = useParams();
  const router = useRouter();
  const appId = params.appId as string;

  const [app, setApp] = useState<AppDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Create plan state
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [planInterval, setPlanInterval] = useState(2592000);
  const [creatingPlan, setCreatingPlan] = useState(false);

  // Edit app state
  const [showEditApp, setShowEditApp] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchApp = useCallback(async () => {
    const [appRes, plansRes] = await Promise.all([
      apiClient<AppDetail>(`/merchant/apps/${appId}`),
      apiClient<Plan[]>(`/merchant/apps/${appId}/plans`),
    ]);
    if (appRes.success && appRes.data) {
      setApp(appRes.data);
      setEditName(appRes.data.name);
      setEditDesc(appRes.data.description || "");
    }
    if (plansRes.success && plansRes.data) setPlans(plansRes.data);
    setLoading(false);
  }, [appId]);

  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  const handleCreatePlan = async () => {
    const amountUsd = parseFloat(planAmount);
    if (!planName.trim() || isNaN(amountUsd) || amountUsd < 1) return;

    setCreatingPlan(true);
    const res = await apiClient<Plan>(`/merchant/apps/${appId}/plans`, {
      method: "POST",
      body: JSON.stringify({
        name: planName.trim(),
        description: planDesc.trim() || undefined,
        amountBaseUnits: Math.round(amountUsd * 1_000_000),
        intervalSeconds: planInterval,
      }),
    });
    if (res.success) {
      setPlanName("");
      setPlanDesc("");
      setPlanAmount("");
      setShowCreatePlan(false);
      fetchApp();
    }
    setCreatingPlan(false);
  };

  const handleEditApp = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    const res = await apiClient<AppDetail>(`/merchant/apps/${appId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      }),
    });
    if (res.success && res.data) {
      setApp(res.data);
      setShowEditApp(false);
    }
    setSaving(false);
  };

  const handleToggleActive = async () => {
    if (!app) return;
    const res = await apiClient<AppDetail>(`/merchant/apps/${appId}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !app.isActive }),
    });
    if (res.success && res.data) setApp(res.data);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-recur-border rounded-[14px] h-8 w-48" />
        <div className="animate-pulse bg-recur-border rounded-[14px] h-[200px]" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="dark-card text-center py-16">
        <p className="text-recur-text-muted text-[13px] mb-4">App not found.</p>
        <Link href="/dashboard/apps" className="btn-secondary text-[13px] px-4 py-2">
          Back to Apps
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/apps"
              className="text-[12px] text-recur-text-dim hover:text-recur-light transition-colors"
            >
              Apps
            </Link>
            <span className="text-[12px] text-recur-text-dim">/</span>
          </div>
          <div className="flex items-center gap-3">
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditApp(true)}
            className="btn-secondary text-[12px] px-3 py-1.5"
          >
            Edit
          </button>
          <button
            onClick={handleToggleActive}
            className="btn-secondary text-[12px] px-3 py-1.5"
          >
            {app.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      </div>

      {/* Plans section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-bold text-recur-text-heading">
            Plans
          </h2>
          <button
            onClick={() => setShowCreatePlan(true)}
            className="btn-primary text-[12px] px-3 py-1.5"
          >
            Create Plan
          </button>
        </div>

        {plans.length === 0 ? (
          <div className="dark-card flex flex-col items-center justify-center py-12 text-center">
            <p className="text-recur-text-muted text-[13px] mb-4">
              No plans yet. Create a billing plan for this app.
            </p>
            <button
              onClick={() => setShowCreatePlan(true)}
              className="btn-primary text-[13px] px-4 py-2"
            >
              Create First Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="dark-card"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-[14px] font-bold text-recur-text-heading">
                    {plan.name}
                  </h3>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      plan.isActive
                        ? "text-recur-success bg-recur-success/10 border border-recur-success/20"
                        : "text-recur-text-dim bg-recur-card border border-recur-border"
                    }`}
                  >
                    {plan.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-[22px] font-[900] font-mono text-recur-text-heading">
                    {formatAmount(plan.amountBaseUnits)}
                  </span>
                  <span className="text-[12px] text-recur-text-muted">
                    /{formatInterval(plan.intervalSeconds).toLowerCase()}
                  </span>
                </div>
                {plan.description && (
                  <p className="text-[12px] text-recur-text-muted mb-2">
                    {plan.description}
                  </p>
                )}
                <div className="text-[10px] font-mono text-recur-text-dim">
                  Seed: {plan.planSeed}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Plan Modal */}
      {showCreatePlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="dark-card-elevated w-full max-w-md mx-4">
            <h2 className="text-[18px] font-bold text-recur-text-heading mb-4">
              Create Plan
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">
                  Plan Name
                </label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Premium Monthly"
                  className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none focus:border-recur-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">
                  Amount (USDC)
                </label>
                <input
                  type="number"
                  value={planAmount}
                  onChange={(e) => setPlanAmount(e.target.value)}
                  placeholder="5.00"
                  min="1"
                  step="0.01"
                  className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none focus:border-recur-primary transition-colors font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">
                  Billing Interval
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {INTERVAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.seconds}
                      onClick={() => setPlanInterval(opt.seconds)}
                      className={`text-[11px] font-semibold py-2 rounded-[10px] border transition-colors ${
                        planInterval === opt.seconds
                          ? "text-recur-light bg-recur-purple-tint border-recur-border-light"
                          : "text-recur-text-dim border-recur-border hover:border-recur-border-light"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  placeholder="Access to premium features"
                  className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none focus:border-recur-primary transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreatePlan}
                disabled={creatingPlan || !planName.trim() || !planAmount}
                className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50"
              >
                {creatingPlan ? "Creating..." : "Create Plan"}
              </button>
              <button
                onClick={() => setShowCreatePlan(false)}
                className="btn-secondary text-[13px] px-5 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit App Modal */}
      {showEditApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="dark-card-elevated w-full max-w-md mx-4">
            <h2 className="text-[18px] font-bold text-recur-text-heading mb-4">
              Edit App
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">
                  App Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading focus:outline-none focus:border-recur-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading focus:outline-none focus:border-recur-primary transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleEditApp}
                disabled={saving || !editName.trim()}
                className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setShowEditApp(false)}
                className="btn-secondary text-[13px] px-5 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
