"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiClient, parseFieldErrors } from "../../../lib/api-client";
import { useToast } from "../../../components/ui/ToastProvider";
import { Modal } from "../../../components/ui/Modal";

interface App {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { plans: number };
  plans?: { id: string }[];
}

function getPlanCount(app: App): number {
  return app._count?.plans ?? app.plans?.length ?? 0;
}

export default function AppsListPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState("");
  const [descError, setDescError] = useState("");
  const { toast } = useToast();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const fetchApps = useCallback(async (signal?: AbortSignal) => {
    const res = await apiClient<App[]>("/merchant/apps");
    if (signal?.aborted) return;
    if (res.success && res.data) setApps(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchApps(controller.signal);
    return () => controller.abort();
  }, [fetchApps]);

  const closeCreate = useCallback(() => {
    setShowCreate(false);
    setNameError("");
    setDescError("");
  }, []);

  const handleCreate = useCallback(async () => {
    setNameError("");
    setDescError("");
    if (!createName.trim()) {
      setNameError("App name is required");
      nameInputRef.current?.focus();
      return;
    }
    if (createName.trim().length > 100) {
      setNameError("App name must be 100 characters or less");
      return;
    }
    setCreating(true);
    const res = await apiClient<App>("/merchant/apps", {
      method: "POST",
      body: JSON.stringify({
        name: createName.trim(),
        description: createDesc.trim() || undefined,
      }),
    });
    if (res.success) {
      setCreateName("");
      setCreateDesc("");
      setShowCreate(false);
      toast("success", "App created successfully");
      fetchApps();
    } else {
      const { fieldErrors, fallbackMessage } = parseFieldErrors(res, [
        "name",
        "description",
      ]);
      if (fieldErrors.name) setNameError(fieldErrors.name);
      if (fieldErrors.description) setDescError(fieldErrors.description);
      if (fallbackMessage) toast("error", fallbackMessage);
      else if (!fieldErrors.name && !fieldErrors.description)
        toast("error", res.error?.message ?? "Failed to create app");
    }
    setCreating(false);
  }, [createName, createDesc, fetchApps, toast]);

  if (loading) {
    return (
      <div
        className="space-y-4"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading apps…</span>
        <div
          className="motion-safe:animate-pulse bg-recur-border rounded-[14px] h-8 w-32"
          aria-hidden="true"
        />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="motion-safe:animate-pulse bg-recur-border rounded-[14px] h-[100px]"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold text-recur-text-heading mb-1">
            Apps
          </h1>
          <p className="text-[13px] text-recur-text-muted">
            Manage your applications and their billing plans.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary text-[13px] px-4 py-2 shrink-0"
        >
          Create App
        </button>
      </div>

      <Modal
        open={showCreate}
        onClose={closeCreate}
        onSubmit={handleCreate}
        title="Create App"
        initialFocusRef={nameInputRef}
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="app-name"
              className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5"
            >
              App Name
            </label>
            <input
              id="app-name"
              ref={nameInputRef}
              type="text"
              value={createName}
              onChange={(e) => {
                setCreateName(e.target.value);
                if (nameError) setNameError("");
              }}
              placeholder="My SaaS Product"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "app-name-error" : undefined}
              className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none motion-safe:transition-colors ${
                nameError
                  ? "border-recur-error focus:border-recur-error"
                  : "border-recur-border focus:border-recur-primary"
              }`}
            />
            {nameError && (
              <p id="app-name-error" className="text-[11px] text-recur-error mt-1">
                {nameError}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="app-desc"
              className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5"
            >
              Description (optional)
            </label>
            <input
              id="app-desc"
              type="text"
              value={createDesc}
              onChange={(e) => {
                setCreateDesc(e.target.value);
                if (descError) setDescError("");
              }}
              placeholder="Brief description"
              aria-invalid={Boolean(descError)}
              aria-describedby={descError ? "app-desc-error" : undefined}
              className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none motion-safe:transition-colors ${
                descError
                  ? "border-recur-error focus:border-recur-error"
                  : "border-recur-border focus:border-recur-primary"
              }`}
            />
            {descError && (
              <p id="app-desc-error" className="text-[11px] text-recur-error mt-1">
                {descError}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleCreate}
            disabled={creating || !createName.trim()}
            className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating…" : "Create"}
          </button>
          <button
            onClick={closeCreate}
            className="btn-secondary text-[13px] px-5 py-2"
          >
            Cancel
          </button>
        </div>
      </Modal>

      {apps.length === 0 ? (
        <div className="dark-card flex flex-col items-center justify-center py-16 text-center">
          <div
            className="w-12 h-12 rounded-full bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-4 text-recur-light"
            aria-hidden="true"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="11.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="2.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="11.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <h2 className="text-[15px] font-bold text-recur-text-heading mb-1">
            No apps yet
          </h2>
          <p className="text-recur-text-muted text-[13px] mb-5 max-w-sm">
            Create your first app to start accepting recurring payments.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-[13px] px-4 py-2"
          >
            Create your first app
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apps.map((app, idx) => {
            const planCount = getPlanCount(app);
            return (
              <Link
                key={app.id}
                href={`/dashboard/apps/${app.id}`}
                className="dark-card hover:border-recur-border-light motion-safe:transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary focus-visible:ring-offset-2 focus-visible:ring-offset-recur-base motion-safe:animate-page-enter"
                style={{ animationDelay: `${Math.min(idx, 6) * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-3 gap-3">
                  <h3 className="text-[15px] font-bold text-recur-text-heading truncate min-w-0">
                    {app.name}
                  </h3>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      app.isActive
                        ? "text-recur-success bg-recur-success/10 border border-recur-success/20"
                        : "text-recur-text-dim bg-recur-card border border-recur-border"
                    }`}
                  >
                    {app.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                {app.description && (
                  <p className="text-[12px] text-recur-text-muted mb-3 line-clamp-2">
                    {app.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-[11px] text-recur-text-dim">
                  <span>
                    {planCount} {planCount === 1 ? "plan" : "plans"}
                  </span>
                  <span>
                    Created {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
