"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient, parseFieldErrors } from "../../../lib/api-client";
import { useToast } from "../../../components/ui/ToastProvider";

interface App {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { plans: number };
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

  const fetchApps = useCallback(async () => {
    const res = await apiClient<App[]>("/merchant/apps");
    if (res.success && res.data) setApps(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleCreate = async () => {
    setNameError("");
    setDescError("");
    if (!createName.trim()) {
      setNameError("App name is required");
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
      setNameError("");
      setDescError("");
      setShowCreate(false);
      toast("success", "App created successfully");
      fetchApps();
    } else {
      const { fieldErrors, fallbackMessage } = parseFieldErrors(res, ["name", "description"]);
      if (fieldErrors.name) setNameError(fieldErrors.name);
      if (fieldErrors.description) setDescError(fieldErrors.description);
      if (fallbackMessage) toast("error", fallbackMessage);
      else if (!fieldErrors.name && !fieldErrors.description) toast("error", res.error?.message ?? "Failed to create app");
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-recur-border rounded-[14px] h-8 w-32" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-recur-border rounded-[14px] h-[100px]" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[26px] font-bold text-recur-text-heading mb-1">
            Apps
          </h1>
          <p className="text-[13px] text-recur-text-muted">
            Manage your applications and their billing plans.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary text-[13px] px-4 py-2"
        >
          Create App
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="dark-card-elevated w-full max-w-md mx-4">
            <h2 className="text-[18px] font-bold text-recur-text-heading mb-4">
              Create App
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">
                  App Name
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => { setCreateName(e.target.value); if (nameError) setNameError(""); }}
                  placeholder="My SaaS Product"
                  className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none transition-colors ${nameError ? "border-recur-error focus:border-recur-error" : "border-recur-border focus:border-recur-primary"}`}
                />
                {nameError && (
                  <p className="text-[11px] text-recur-error mt-1">{nameError}</p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={createDesc}
                  onChange={(e) => { setCreateDesc(e.target.value); if (descError) setDescError(""); }}
                  placeholder="Brief description"
                  className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none transition-colors ${descError ? "border-recur-error focus:border-recur-error" : "border-recur-border focus:border-recur-primary"}`}
                />
                {descError && (
                  <p className="text-[11px] text-recur-error mt-1">{descError}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreate}
                disabled={creating || !createName.trim()}
                className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="btn-secondary text-[13px] px-5 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apps list */}
      {apps.length === 0 ? (
        <div className="dark-card flex flex-col items-center justify-center py-16 text-center">
          <p className="text-recur-text-muted text-[13px] mb-4">
            No apps yet. Create your first app to start accepting payments.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-[13px] px-4 py-2"
          >
            Create Your First App
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/dashboard/apps/${app.id}`}
              className="dark-card hover:border-recur-border-light transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-[15px] font-bold text-recur-text-heading">
                  {app.name}
                </h3>
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
                <p className="text-[12px] text-recur-text-muted mb-3">
                  {app.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-[11px] text-recur-text-dim">
                <span>{app._count?.plans ?? 0} plans</span>
                <span>
                  Created {new Date(app.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
