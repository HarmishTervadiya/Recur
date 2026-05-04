"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiClient } from "../../../lib/api-client";
import { useToast } from "../../../components/ui/ToastProvider";
import { Modal } from "../../../components/ui/Modal";

interface ApiKey {
  id: string;
  prefix: string;
  label: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokingKey, setRevokingKey] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);
  const { toast } = useToast();
  const revokeBtnRef = useRef<HTMLButtonElement>(null);

  const fetchApiKeys = useCallback(async (signal?: AbortSignal) => {
    const res = await apiClient<ApiKey[]>("/merchant/api-keys");
    if (signal?.aborted) return;
    if (res.success && res.data) setApiKeys(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchApiKeys(controller.signal);
    return () => controller.abort();
  }, [fetchApiKeys]);

  const handleCreateApiKey = useCallback(async () => {
    setCreatingKey(true);
    setNewKeySecret(null);
    const res = await apiClient<{ id: string; key: string }>(
      "/merchant/api-keys",
      { method: "POST" },
    );
    if (res.success && res.data) {
      setNewKeySecret(res.data.key);
      toast("success", "API key created — copy it now");
      fetchApiKeys();
    } else {
      toast("error", res.error?.message ?? "Failed to create API key");
    }
    setCreatingKey(false);
  }, [fetchApiKeys, toast]);

  const handleConfirmRevoke = useCallback(async () => {
    if (!revokingKey) return;
    setRevoking(true);
    const res = await apiClient(`/merchant/api-keys/${revokingKey.id}`, {
      method: "DELETE",
    });
    if (res.success) {
      toast("success", "API key revoked");
      setRevokingKey(null);
      fetchApiKeys();
    } else {
      toast("error", res.error?.message ?? "Failed to revoke API key");
    }
    setRevoking(false);
  }, [revokingKey, fetchApiKeys, toast]);

  const handleCopyKey = useCallback(async () => {
    if (!newKeySecret) return;
    try {
      await navigator.clipboard.writeText(newKeySecret);
      setCopiedKey(true);
      toast("success", "Copied to clipboard");
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      toast("error", "Could not copy to clipboard");
    }
  }, [newKeySecret, toast]);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading API keys…</span>
        <div className="motion-safe:animate-pulse bg-recur-border/50 rounded-[14px] h-8 w-32" aria-hidden="true" />
        <div className="dark-card space-y-3" aria-hidden="true">
          <div className="flex justify-between items-center">
            <div className="motion-safe:animate-pulse bg-recur-border/50 rounded-[8px] h-5 w-24" />
            <div className="motion-safe:animate-pulse bg-recur-border/50 rounded-[8px] h-8 w-28" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="motion-safe:animate-pulse bg-recur-border/30 rounded-[10px] h-[56px]" />
          ))}
        </div>
        <div className="motion-safe:animate-pulse bg-recur-border/30 rounded-[14px] h-[120px]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[26px] font-bold text-recur-text-heading mb-1">
          API Keys
        </h1>
        <p className="text-[13px] text-recur-text-muted">
          Manage server-side API keys for programmatic access to the Recur API.
        </p>
      </div>

      {/* Create Key + Secret Display */}
      <section className="dark-card mb-6 motion-safe:animate-page-enter">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h2 className="text-[15px] font-bold text-recur-text-heading">
              Your Keys
            </h2>
            <p className="text-[11px] text-recur-text-dim mt-0.5">
              Keys are shown once on creation. Store them securely.
            </p>
          </div>
          <button
            onClick={handleCreateApiKey}
            disabled={creatingKey}
            className="btn-primary text-[12px] px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingKey ? "Creating…" : "Create New Key"}
          </button>
        </div>

        {newKeySecret && (
          <div
            className="dark-card-elevated border-recur-warning/30 mb-4 motion-safe:animate-page-enter"
            role="region"
            aria-label="New API key"
          >
            <p className="text-[12px] font-semibold text-recur-warning mb-2">
              API key created (shown once — copy it now):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono text-recur-text-heading bg-recur-base px-3 py-2 rounded-[8px] break-all">
                {newKeySecret}
              </code>
              <button
                onClick={handleCopyKey}
                className="btn-secondary text-[11px] px-3 py-1.5 shrink-0"
              >
                {copiedKey ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {apiKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-3 text-recur-light">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="5.5" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 8l5-5M11 3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[13px] text-recur-text-muted mb-1">No API keys yet</p>
            <p className="text-[11px] text-recur-text-dim">
              Create a key to start using the Recur API programmatically.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {apiKeys.map((key) => (
              <li
                key={key.id}
                className="flex items-center justify-between py-3 px-4 bg-recur-base border border-recur-border rounded-[10px] gap-3"
              >
                <div className="min-w-0">
                  <span className="text-[12px] font-mono text-recur-text-heading">
                    {key.prefix}…
                  </span>
                  <div className="text-[10px] text-recur-text-dim mt-0.5">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && (
                      <>
                        {" · Last used "}
                        {new Date(key.lastUsedAt).toLocaleDateString()}
                      </>
                    )}
                    {!key.lastUsedAt && " · Never used"}
                  </div>
                </div>
                <button
                  onClick={() => setRevokingKey(key)}
                  className="text-[11px] text-recur-text-dim hover:text-recur-error motion-safe:transition-colors px-3 py-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-error rounded"
                  aria-label={`Revoke API key ${key.prefix}`}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Usage Info */}
      <section className="dark-card motion-safe:animate-page-enter" style={{ animationDelay: "60ms" }}>
        <h2 className="text-[15px] font-bold text-recur-text-heading mb-3">
          Usage
        </h2>
        <div className="space-y-3 text-[12px] text-recur-text-muted">
          <div className="flex items-start gap-3 px-3 py-2.5 bg-recur-base rounded-[8px] border border-recur-border">
            <code className="text-recur-light text-[11px] font-mono shrink-0">Authorization</code>
            <span>
              Pass your key in the <code className="text-recur-text-heading">Authorization: Bearer sk_...</code> header for all merchant API endpoints.
            </span>
          </div>
          <div className="flex items-start gap-3 px-3 py-2.5 bg-recur-base rounded-[8px] border border-recur-border">
            <code className="text-recur-light text-[11px] font-mono shrink-0">Scope</code>
            <span>
              API keys grant full access to your merchant account — create plans, list subscriptions, view transactions, and manage webhooks.
            </span>
          </div>
          <div className="flex items-start gap-3 px-3 py-2.5 bg-recur-base rounded-[8px] border border-recur-border">
            <code className="text-recur-light text-[11px] font-mono shrink-0">Security</code>
            <span>
              Never expose API keys in client-side code. Use them only in server-to-server communication.
            </span>
          </div>
        </div>
      </section>

      {/* Revoke Modal */}
      <Modal
        open={Boolean(revokingKey)}
        onClose={() => !revoking && setRevokingKey(null)}
        title="Revoke API Key?"
        initialFocusRef={revokeBtnRef}
        description={
          revokingKey
            ? `This will permanently revoke the API key starting with "${revokingKey.prefix}". Any service using this key will stop working immediately.`
            : undefined
        }
      >
        <div className="flex gap-3 mt-2">
          <button
            ref={revokeBtnRef}
            onClick={handleConfirmRevoke}
            disabled={revoking}
            className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed bg-recur-error border-recur-error text-white hover:brightness-110"
          >
            {revoking ? "Revoking…" : "Revoke Key"}
          </button>
          <button
            onClick={() => setRevokingKey(null)}
            disabled={revoking}
            className="btn-secondary text-[13px] px-5 py-2"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
