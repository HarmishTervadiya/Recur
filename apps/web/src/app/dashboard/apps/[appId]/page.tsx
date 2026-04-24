"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiClient, parseFieldErrors } from "../../../../lib/api-client";
import { useToast } from "../../../../components/ui/ToastProvider";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  amountBaseUnits: string;
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
}

interface Transaction {
  id: string;
  amountGross: string;
  platformFee: string;
  amountNet: string;
  status: string;
  txSignature: string | null;
  fromWallet: string | null;
  toWallet: string | null;
  createdAt: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  isActive: boolean;
  createdAt: string;
}

const INTERVAL_OPTIONS = [
  { label: "Weekly", seconds: 604800 },
  { label: "Monthly", seconds: 2592000 },
  { label: "Quarterly", seconds: 7776000 },
  { label: "Yearly", seconds: 31536000 },
];

type Tab = "plans" | "transactions" | "webhooks";

function formatAmount(baseUnits: string | number): string {
  return `$${(Number(baseUnits) / 1_000_000).toFixed(2)}`;
}

function formatInterval(seconds: number): string {
  const match = INTERVAL_OPTIONS.find((o) => o.seconds === seconds);
  if (match) return match.label;
  const days = Math.round(seconds / 86400);
  return `${days}d`;
}

function truncateWallet(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function AppDetailPage() {
  const params = useParams();
  const appId = params.appId as string;

  const [app, setApp] = useState<AppDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("plans");
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);

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

  // Webhook state
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const { toast } = useToast();

  // Validation errors
  const [planNameError, setPlanNameError] = useState("");
  const [planAmountError, setPlanAmountError] = useState("");
  const [editNameError, setEditNameError] = useState("");
  const [webhookUrlError, setWebhookUrlError] = useState("");

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

  const fetchTransactions = useCallback(async (page = 1) => {
    const res = await apiClient<Transaction[]>(
      `/merchant/apps/${appId}/transactions?page=${page}&limit=20`,
    );
    if (res.success && res.data) {
      setTransactions(res.data);
      setTxPage(page);
      if (res.pagination) setTxTotal(res.pagination.totalPages);
    }
  }, [appId]);

  const fetchWebhooks = useCallback(async () => {
    const res = await apiClient<WebhookEndpoint[]>(
      `/merchant/apps/${appId}/webhooks`,
    );
    if (res.success && res.data) setWebhooks(res.data);
  }, [appId]);

  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  useEffect(() => {
    if (activeTab === "transactions") fetchTransactions();
    if (activeTab === "webhooks") fetchWebhooks();
  }, [activeTab, fetchTransactions, fetchWebhooks]);

  const handleCreatePlan = async () => {
    setPlanNameError("");
    setPlanAmountError("");
    const amountUsd = parseFloat(planAmount);
    let valid = true;
    if (!planName.trim()) { setPlanNameError("Plan name is required"); valid = false; }
    if (!planAmount || isNaN(amountUsd) || amountUsd < 1) { setPlanAmountError("Amount must be at least $1.00"); valid = false; }
    if (!valid) return;
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
      setPlanName(""); setPlanDesc(""); setPlanAmount("");
      setPlanNameError(""); setPlanAmountError("");
      setShowCreatePlan(false);
      toast("success", "Plan created successfully");
      fetchApp();
    } else {
      const { fieldErrors, fallbackMessage } = parseFieldErrors(res, ["name", "amountBaseUnits", "intervalSeconds", "description"]);
      if (fieldErrors.name) setPlanNameError(fieldErrors.name);
      if (fieldErrors.amountBaseUnits) setPlanAmountError(fieldErrors.amountBaseUnits);
      if (fallbackMessage) toast("error", fallbackMessage);
      else if (!fieldErrors.name && !fieldErrors.amountBaseUnits) toast("error", res.error?.message ?? "Failed to create plan");
    }
    setCreatingPlan(false);
  };

  const handleEditApp = async () => {
    setEditNameError("");
    if (!editName.trim()) { setEditNameError("App name is required"); return; }
    setSaving(true);
    const res = await apiClient<AppDetail>(`/merchant/apps/${appId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || undefined }),
    });
    if (res.success && res.data) { setApp(res.data); setShowEditApp(false); toast("success", "App updated"); }
    else {
      const { fieldErrors, fallbackMessage } = parseFieldErrors(res, ["name", "description"]);
      if (fieldErrors.name) setEditNameError(fieldErrors.name);
      if (fallbackMessage) toast("error", fallbackMessage);
      else if (!fieldErrors.name) toast("error", res.error?.message ?? "Failed to update app");
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

  const handleCreateWebhook = async () => {
    setWebhookUrlError("");
    if (!webhookUrl.trim()) { setWebhookUrlError("Endpoint URL is required"); return; }
    try { new URL(webhookUrl.trim()); } catch { setWebhookUrlError("Must be a valid URL (e.g. https://...)"); return; }
    setCreatingWebhook(true);
    const res = await apiClient<{ id: string; url: string; secret: string }>(
      `/merchant/apps/${appId}/webhooks`,
      { method: "POST", body: JSON.stringify({ url: webhookUrl.trim() }) },
    );
    if (res.success && res.data) {
      setWebhookSecret(res.data.secret);
      setWebhookUrl("");
      setWebhookUrlError("");
      toast("success", "Webhook endpoint created");
      fetchWebhooks();
    } else {
      const { fieldErrors, fallbackMessage } = parseFieldErrors(res, ["url"]);
      if (fieldErrors.url) setWebhookUrlError(fieldErrors.url);
      if (fallbackMessage) toast("error", fallbackMessage);
      else if (!fieldErrors.url) toast("error", res.error?.message ?? "Failed to create webhook");
    }
    setCreatingWebhook(false);
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    await apiClient(`/merchant/apps/${appId}/webhooks/${webhookId}`, { method: "DELETE" });
    toast("success", "Webhook removed");
    fetchWebhooks();
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
        <Link href="/dashboard/apps" className="btn-secondary text-[13px] px-4 py-2">Back to Apps</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/apps" className="text-[12px] text-recur-text-dim hover:text-recur-light transition-colors">Apps</Link>
            <span className="text-[12px] text-recur-text-dim">/</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-bold text-recur-text-heading">{app.name}</h1>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${app.isActive ? "text-recur-success bg-recur-success/10 border border-recur-success/20" : "text-recur-text-dim bg-recur-card border border-recur-border"}`}>
              {app.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          {app.description && <p className="text-[13px] text-recur-text-muted mt-1">{app.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEditApp(true)} className="btn-secondary text-[12px] px-3 py-1.5">Edit</button>
          <button onClick={handleToggleActive} className="btn-secondary text-[12px] px-3 py-1.5">
            {app.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-recur-border">
        {(["plans", "transactions", "webhooks"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[13px] font-medium px-4 py-2.5 border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "text-recur-light border-recur-primary"
                : "text-recur-text-muted border-transparent hover:text-recur-text-heading"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Plans Tab */}
      {activeTab === "plans" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-recur-text-heading">{plans.length} Plans</h2>
            <button onClick={() => setShowCreatePlan(true)} className="btn-primary text-[12px] px-3 py-1.5">Create Plan</button>
          </div>
          {plans.length === 0 ? (
            <div className="dark-card flex flex-col items-center justify-center py-12 text-center">
              <p className="text-recur-text-muted text-[13px] mb-4">No plans yet.</p>
              <button onClick={() => setShowCreatePlan(true)} className="btn-primary text-[13px] px-4 py-2">Create First Plan</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {plans.map((plan) => (
                <div key={plan.id} className="dark-card">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-[14px] font-bold text-recur-text-heading">{plan.name}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${plan.isActive ? "text-recur-success bg-recur-success/10 border border-recur-success/20" : "text-recur-text-dim bg-recur-card border border-recur-border"}`}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-[22px] font-[900] font-mono text-recur-text-heading">{formatAmount(plan.amountBaseUnits)}</span>
                    <span className="text-[12px] text-recur-text-muted">/{formatInterval(plan.intervalSeconds).toLowerCase()}</span>
                  </div>
                  {plan.description && <p className="text-[12px] text-recur-text-muted mb-2">{plan.description}</p>}
                  <div className="text-[10px] font-mono text-recur-text-dim">Seed: {plan.planSeed}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div>
          <h2 className="text-[15px] font-bold text-recur-text-heading mb-4">Transactions</h2>
          {transactions.length === 0 ? (
            <div className="dark-card text-center py-12">
              <p className="text-recur-text-muted text-[13px]">No transactions yet.</p>
            </div>
          ) : (
            <>
              <div className="bg-recur-surface border border-recur-border rounded-[14px] overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-recur-border">
                      <th className="text-left text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider px-4 py-3">From</th>
                      <th className="text-left text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider px-4 py-3">Amount</th>
                      <th className="text-left text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider px-4 py-3">Fee</th>
                      <th className="text-left text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider px-4 py-3">Net</th>
                      <th className="text-left text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider px-4 py-3">Status</th>
                      <th className="text-left text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider px-4 py-3">Tx</th>
                      <th className="text-left text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, i) => (
                      <tr key={tx.id} className={i < transactions.length - 1 ? "border-b border-recur-card" : ""}>
                        <td className="px-4 py-3 text-[11px] font-mono text-recur-text-body">{tx.fromWallet ? truncateWallet(tx.fromWallet) : "—"}</td>
                        <td className="px-4 py-3 text-[12px] font-mono text-recur-text-heading">{formatAmount(tx.amountGross)}</td>
                        <td className="px-4 py-3 text-[12px] font-mono text-recur-text-muted">{formatAmount(tx.platformFee)}</td>
                        <td className="px-4 py-3 text-[12px] font-mono text-recur-success font-semibold">{formatAmount(tx.amountNet)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            tx.status === "success"
                              ? "text-recur-success bg-recur-success/10"
                              : "text-recur-error bg-recur-error/10"
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {tx.txSignature ? (
                            <a
                              href={`https://explorer.solana.com/tx/${tx.txSignature}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-mono text-recur-light hover:text-recur-glow transition-colors"
                            >
                              {tx.txSignature.slice(0, 8)}...
                            </a>
                          ) : (
                            <span className="text-[11px] text-recur-text-dim">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-recur-text-muted">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {txTotal > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => fetchTransactions(txPage - 1)}
                    disabled={txPage <= 1}
                    className="btn-secondary text-[11px] px-3 py-1 disabled:opacity-30"
                  >
                    Prev
                  </button>
                  <span className="text-[11px] text-recur-text-muted">
                    Page {txPage} of {txTotal}
                  </span>
                  <button
                    onClick={() => fetchTransactions(txPage + 1)}
                    disabled={txPage >= txTotal}
                    className="btn-secondary text-[11px] px-3 py-1 disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === "webhooks" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-recur-text-heading">Webhooks</h2>
            <button onClick={() => { setShowCreateWebhook(true); setWebhookSecret(null); }} className="btn-primary text-[12px] px-3 py-1.5">
              Add Endpoint
            </button>
          </div>

          {webhookSecret && (
            <div className="dark-card border-recur-warning/30 mb-4">
              <p className="text-[12px] font-semibold text-recur-warning mb-2">
                Webhook signing secret (shown once — copy it now):
              </p>
              <code className="block text-[11px] font-mono text-recur-text-heading bg-recur-base px-3 py-2 rounded-[8px] break-all">
                {webhookSecret}
              </code>
            </div>
          )}

          {webhooks.length === 0 && !showCreateWebhook ? (
            <div className="dark-card text-center py-12">
              <p className="text-recur-text-muted text-[13px] mb-4">No webhook endpoints configured.</p>
              <button onClick={() => setShowCreateWebhook(true)} className="btn-primary text-[13px] px-4 py-2">
                Add First Endpoint
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div key={wh.id} className="dark-card flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-mono text-recur-text-heading">{wh.url}</div>
                    <div className="text-[10px] text-recur-text-dim mt-1">
                      Added {new Date(wh.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteWebhook(wh.id)}
                    className="text-[11px] text-recur-text-dim hover:text-recur-error transition-colors px-3 py-1"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreatePlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="dark-card-elevated w-full max-w-md mx-4">
            <h2 className="text-[18px] font-bold text-recur-text-heading mb-4">Create Plan</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">Plan Name</label>
                <input type="text" value={planName} onChange={(e) => { setPlanName(e.target.value); if (planNameError) setPlanNameError(""); }} placeholder="Premium Monthly"
                  className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none transition-colors ${planNameError ? "border-recur-error" : "border-recur-border focus:border-recur-primary"}`} />
                {planNameError && <p className="text-[11px] text-recur-error mt-1">{planNameError}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">Amount (USDC)</label>
                <input type="number" value={planAmount} onChange={(e) => { setPlanAmount(e.target.value); if (planAmountError) setPlanAmountError(""); }} placeholder="5.00" min="1" step="0.01"
                  className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none transition-colors font-mono ${planAmountError ? "border-recur-error" : "border-recur-border focus:border-recur-primary"}`} />
                {planAmountError && <p className="text-[11px] text-recur-error mt-1">{planAmountError}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">Billing Interval</label>
                <div className="grid grid-cols-4 gap-2">
                  {INTERVAL_OPTIONS.map((opt) => (
                    <button key={opt.seconds} onClick={() => setPlanInterval(opt.seconds)}
                      className={`text-[11px] font-semibold py-2 rounded-[10px] border transition-colors ${planInterval === opt.seconds ? "text-recur-light bg-recur-purple-tint border-recur-border-light" : "text-recur-text-dim border-recur-border hover:border-recur-border-light"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">Description (optional)</label>
                <input type="text" value={planDesc} onChange={(e) => setPlanDesc(e.target.value)} placeholder="Access to premium features"
                  className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none focus:border-recur-primary transition-colors" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleCreatePlan} disabled={creatingPlan || !planName.trim() || !planAmount} className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50">
                {creatingPlan ? "Creating..." : "Create Plan"}
              </button>
              <button onClick={() => setShowCreatePlan(false)} className="btn-secondary text-[13px] px-5 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit App Modal */}
      {showEditApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="dark-card-elevated w-full max-w-md mx-4">
            <h2 className="text-[18px] font-bold text-recur-text-heading mb-4">Edit App</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">App Name</label>
                <input type="text" value={editName} onChange={(e) => { setEditName(e.target.value); if (editNameError) setEditNameError(""); }}
                  className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading focus:outline-none transition-colors ${editNameError ? "border-recur-error" : "border-recur-border focus:border-recur-primary"}`} />
                {editNameError && <p className="text-[11px] text-recur-error mt-1">{editNameError}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">Description</label>
                <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading focus:outline-none focus:border-recur-primary transition-colors" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleEditApp} disabled={saving || !editName.trim()} className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setShowEditApp(false)} className="btn-secondary text-[13px] px-5 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Webhook Modal */}
      {showCreateWebhook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="dark-card-elevated w-full max-w-md mx-4">
            <h2 className="text-[18px] font-bold text-recur-text-heading mb-4">Add Webhook Endpoint</h2>
            <div>
              <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">Endpoint URL</label>
              <input type="url" value={webhookUrl} onChange={(e) => { setWebhookUrl(e.target.value); if (webhookUrlError) setWebhookUrlError(""); }} placeholder="https://your-api.com/webhooks/recur"
                className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none transition-colors font-mono ${webhookUrlError ? "border-recur-error" : "border-recur-border focus:border-recur-primary"}`} />
              {webhookUrlError && <p className="text-[11px] text-recur-error mt-1">{webhookUrlError}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleCreateWebhook} disabled={creatingWebhook || !webhookUrl.trim()} className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50">
                {creatingWebhook ? "Creating..." : "Create"}
              </button>
              <button onClick={() => setShowCreateWebhook(false)} className="btn-secondary text-[13px] px-5 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
