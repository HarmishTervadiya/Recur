"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../../../lib/api-client";
import { useToast } from "../../../components/ui/ToastProvider";

interface MerchantProfile {
  id: string;
  walletAddress: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  businessName: string | null;
  businessUrl: string | null;
  logoUrl: string | null;
}

interface ApiKey {
  id: string;
  prefix: string;
  label: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessUrl, setBusinessUrl] = useState("");

  // API keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const { toast } = useToast();

  const fetchProfile = useCallback(async () => {
    const res = await apiClient<MerchantProfile>("/merchant/me");
    if (res.success && res.data) {
      setMerchant(res.data);
      setName(res.data.name || "");
      setEmail(res.data.email || "");
      setPhone(res.data.phone || "");
      setBusinessName(res.data.businessName || "");
      setBusinessUrl(res.data.businessUrl || "");
    }
    setLoading(false);
  }, []);

  const fetchApiKeys = useCallback(async () => {
    const res = await apiClient<ApiKey[]>("/merchant/api-keys");
    if (res.success && res.data) setApiKeys(res.data);
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchApiKeys();
  }, [fetchProfile, fetchApiKeys]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const res = await apiClient<MerchantProfile>("/merchant/me", {
      method: "PATCH",
      body: JSON.stringify({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        businessName: businessName.trim() || undefined,
        businessUrl: businessUrl.trim() || undefined,
      }),
    });
    if (res.success && res.data) { setMerchant(res.data); toast("success", "Profile saved"); }
    else { toast("error", res.error?.message ?? "Failed to save profile"); }
    setSaving(false);
  };

  const handleCreateApiKey = async () => {
    setCreatingKey(true);
    setNewKeySecret(null);
    const res = await apiClient<{ id: string; key: string }>("/merchant/api-keys", {
      method: "POST",
    });
    if (res.success && res.data) {
      setNewKeySecret(res.data.key);
      toast("success", "API key created — copy it now");
      fetchApiKeys();
    } else {
      toast("error", res.error?.message ?? "Failed to create API key");
    }
    setCreatingKey(false);
  };

  const handleRevokeKey = async (keyId: string) => {
    await apiClient(`/merchant/api-keys/${keyId}`, { method: "DELETE" });
    toast("success", "API key revoked");
    fetchApiKeys();
  };

  const handleCopyKey = () => {
    if (newKeySecret) {
      navigator.clipboard.writeText(newKeySecret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-recur-border rounded-[14px] h-8 w-32" />
        <div className="animate-pulse bg-recur-border rounded-[14px] h-[300px]" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[26px] font-bold text-recur-text-heading mb-1">Settings</h1>
        <p className="text-[13px] text-recur-text-muted">Manage your merchant profile and API keys.</p>
      </div>

      {/* Profile Section */}
      <div className="dark-card mb-8">
        <h2 className="text-[18px] font-bold text-recur-text-heading mb-6">Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
              className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none focus:border-recur-primary transition-colors" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none focus:border-recur-primary transition-colors" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000"
              className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none focus:border-recur-primary transition-colors" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">Business Name</label>
            <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Inc."
              className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none focus:border-recur-primary transition-colors" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">Business URL</label>
            <input type="url" value={businessUrl} onChange={(e) => setBusinessUrl(e.target.value)} placeholder="https://your-business.com"
              className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none focus:border-recur-primary transition-colors font-mono" />
          </div>
        </div>
        <div className="mt-6">
          <button onClick={handleSaveProfile} disabled={saving} className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50">
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      {/* API Keys Section */}
      <div className="dark-card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold text-recur-text-heading">API Keys</h2>
          <button onClick={handleCreateApiKey} disabled={creatingKey} className="btn-primary text-[12px] px-3 py-1.5 disabled:opacity-50">
            {creatingKey ? "Creating..." : "Create Key"}
          </button>
        </div>

        {newKeySecret && (
          <div className="dark-card-elevated border-recur-warning/30 mb-4">
            <p className="text-[12px] font-semibold text-recur-warning mb-2">
              API key created (shown once — copy it now):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono text-recur-text-heading bg-recur-base px-3 py-2 rounded-[8px] break-all">
                {newKeySecret}
              </code>
              <button onClick={handleCopyKey} className="btn-secondary text-[11px] px-3 py-1.5 shrink-0">
                {copiedKey ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {apiKeys.length === 0 ? (
          <p className="text-[13px] text-recur-text-muted">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between py-3 px-4 bg-recur-base border border-recur-border rounded-[10px]">
                <div>
                  <span className="text-[12px] font-mono text-recur-text-heading">{key.prefix}...</span>
                  <span className="text-[10px] text-recur-text-dim ml-3">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button onClick={() => handleRevokeKey(key.id)} className="text-[11px] text-recur-text-dim hover:text-recur-error transition-colors">
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
