"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, parseFieldErrors } from "../../../../../lib/api-client";
import { useToast } from "../../../../../components/ui/ToastProvider";
import { Modal } from "../../../../../components/ui/Modal";
import type { WebhookEndpoint } from "./utils";

interface WebhooksTabProps {
  appId: string;
}

export function WebhooksTab({ appId }: WebhooksTabProps) {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchWebhooks = useCallback(
    async (signal?: AbortSignal) => {
      const res = await apiClient<WebhookEndpoint[]>(
        `/merchant/apps/${appId}/webhooks`,
      );
      if (signal?.aborted) return;
      if (res.success && res.data) setWebhooks(res.data);
    },
    [appId],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchWebhooks(controller.signal);
    return () => controller.abort();
  }, [fetchWebhooks]);

  const close = useCallback(() => {
    setShowCreate(false);
    setUrlError("");
  }, []);

  const handleCreate = useCallback(async () => {
    setUrlError("");
    if (!url.trim()) {
      setUrlError("Endpoint URL is required");
      return;
    }
    try {
      new URL(url.trim());
    } catch {
      setUrlError("Must be a valid URL (e.g. https://...)");
      return;
    }
    setCreating(true);
    const res = await apiClient<{ id: string; url: string; secret: string }>(
      `/merchant/apps/${appId}/webhooks`,
      { method: "POST", body: JSON.stringify({ url: url.trim() }) },
    );
    if (res.success && res.data) {
      setSecret(res.data.secret);
      setUrl("");
      setShowCreate(false);
      setCopied(false);
      toast("success", "Webhook endpoint created");
      fetchWebhooks();
    } else {
      const { fieldErrors, fallbackMessage } = parseFieldErrors(res, ["url"]);
      if (fieldErrors.url) setUrlError(fieldErrors.url);
      if (fallbackMessage) toast("error", fallbackMessage);
      else if (!fieldErrors.url)
        toast("error", res.error?.message ?? "Failed to create webhook");
    }
    setCreating(false);
  }, [appId, url, fetchWebhooks, toast]);

  const handleDelete = useCallback(
    async (webhookId: string) => {
      await apiClient(`/merchant/apps/${appId}/webhooks/${webhookId}`, {
        method: "DELETE",
      });
      toast("success", "Webhook removed");
      fetchWebhooks();
    },
    [appId, fetchWebhooks, toast],
  );

  const copySecret = useCallback(async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("error", "Could not copy to clipboard");
    }
  }, [secret, toast]);

  return (
    <div
      key="tab-webhooks"
      id="tabpanel-webhooks"
      role="tabpanel"
      aria-labelledby="tab-webhooks"
      className="motion-safe:animate-fade-in"
    >
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-[15px] font-bold text-recur-text-heading">
          Webhook Endpoint
        </h2>
        {webhooks.length === 0 && (
          <button
            onClick={() => {
              setShowCreate(true);
              setSecret(null);
            }}
            className="btn-primary text-[12px] px-3 py-1.5"
          >
            Add Endpoint
          </button>
        )}
      </div>

      {webhooks.length > 0 && (
        <p className="text-[11px] text-recur-text-dim mb-3">
          One webhook endpoint per app. Remove the existing one to set a
          different URL.
        </p>
      )}

      {secret && (
        <div className="dark-card border-recur-warning/30 mb-4 motion-safe:animate-page-enter">
          <p className="text-[12px] font-semibold text-recur-warning mb-2">
            Webhook signing secret (shown once — copy it now):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono text-recur-text-heading bg-recur-base px-3 py-2 rounded-[8px] break-all">
              {secret}
            </code>
            <button
              onClick={copySecret}
              className="btn-secondary text-[11px] px-3 py-1.5 shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {webhooks.length === 0 && !showCreate ? (
        <div className="dark-card text-center py-12">
          <p className="text-recur-text-muted text-[13px] mb-4">
            No webhook endpoint configured.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-[13px] px-4 py-2"
          >
            Add Endpoint
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="dark-card flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-mono text-recur-text-heading break-all">
                  {wh.url}
                </div>
                <div className="text-[10px] text-recur-text-dim mt-1">
                  Added {new Date(wh.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => handleDelete(wh.id)}
                className="text-[11px] text-recur-text-dim hover:text-recur-error motion-safe:transition-colors px-3 py-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-error rounded"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={close}
        onSubmit={handleCreate}
        title="Add Webhook Endpoint"
        initialFocusRef={urlRef}
      >
        <div>
          <label
            htmlFor="webhook-url"
            className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5"
          >
            Endpoint URL
          </label>
          <input
            id="webhook-url"
            ref={urlRef}
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) setUrlError("");
            }}
            placeholder="https://your-api.com/webhooks/recur"
            aria-invalid={Boolean(urlError)}
            aria-describedby={urlError ? "webhook-url-error" : undefined}
            className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none motion-safe:transition-colors font-mono ${
              urlError
                ? "border-recur-error"
                : "border-recur-border focus:border-recur-primary"
            }`}
          />
          {urlError && (
            <p
              id="webhook-url-error"
              className="text-[11px] text-recur-error mt-1"
            >
              {urlError}
            </p>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleCreate}
            disabled={creating || !url.trim()}
            className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating…" : "Create"}
          </button>
          <button
            onClick={close}
            className="btn-secondary text-[13px] px-5 py-2"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
