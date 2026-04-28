"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiClient, parseFieldErrors } from "../../../lib/api-client";
import { useToast } from "../../../components/ui/ToastProvider";
import { Modal } from "../../../components/ui/Modal";

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

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  className?: string;
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  className = "",
}: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none motion-safe:transition-colors ${
          type === "url" ? "font-mono" : ""
        } ${
          error
            ? "border-recur-error"
            : "border-recur-border focus:border-recur-primary"
        }`}
      />
      {error && (
        <p id={errorId} className="text-[11px] text-recur-error mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessUrl, setBusinessUrl] = useState("");

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokingKey, setRevokingKey] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [businessUrlError, setBusinessUrlError] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [businessNameError, setBusinessNameError] = useState("");
  const { toast } = useToast();
  const revokeBtnRef = useRef<HTMLButtonElement>(null);

  const fetchProfile = useCallback(async (signal?: AbortSignal) => {
    const res = await apiClient<MerchantProfile>("/merchant/me");
    if (signal?.aborted) return;
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

  const fetchApiKeys = useCallback(async (signal?: AbortSignal) => {
    const res = await apiClient<ApiKey[]>("/merchant/api-keys");
    if (signal?.aborted) return;
    if (res.success && res.data) setApiKeys(res.data);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchProfile(controller.signal);
    fetchApiKeys(controller.signal);
    return () => controller.abort();
  }, [fetchProfile, fetchApiKeys]);

  const handleSaveProfile = useCallback(async () => {
    setEmailError("");
    setBusinessUrlError("");
    setNameError("");
    setPhoneError("");
    setBusinessNameError("");
    let valid = true;
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address");
      valid = false;
    }
    if (businessUrl.trim()) {
      try {
        new URL(businessUrl.trim());
      } catch {
        setBusinessUrlError("Must be a valid URL (e.g. https://...)");
        valid = false;
      }
    }
    if (!valid) return;
    setSaving(true);
    const res = await apiClient<MerchantProfile>("/merchant/me", {
      method: "PATCH",
      body: JSON.stringify({
        name: name.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        businessName: businessName.trim() || null,
        businessUrl: businessUrl.trim() || null,
      }),
    });
    if (res.success && res.data) {
      setMerchant(res.data);
      toast("success", "Profile saved");
    } else {
      const { fieldErrors, fallbackMessage } = parseFieldErrors(res, [
        "name",
        "email",
        "phone",
        "businessName",
        "businessUrl",
      ]);
      if (fieldErrors.name) setNameError(fieldErrors.name);
      if (fieldErrors.email) setEmailError(fieldErrors.email);
      if (fieldErrors.phone) setPhoneError(fieldErrors.phone);
      if (fieldErrors.businessName)
        setBusinessNameError(fieldErrors.businessName);
      if (fieldErrors.businessUrl) setBusinessUrlError(fieldErrors.businessUrl);
      if (fallbackMessage) toast("error", fallbackMessage);
      else if (Object.keys(fieldErrors).length === 0)
        toast("error", res.error?.message ?? "Failed to save profile");
    }
    setSaving(false);
  }, [name, email, phone, businessName, businessUrl, toast]);

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
      <div
        className="space-y-6"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading settings…</span>
        <div
          className="motion-safe:animate-pulse bg-recur-border rounded-[14px] h-8 w-32"
          aria-hidden="true"
        />
        <div
          className="motion-safe:animate-pulse bg-recur-border rounded-[14px] h-[300px]"
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[26px] font-bold text-recur-text-heading mb-1">
          Settings
        </h1>
        <p className="text-[13px] text-recur-text-muted">
          Manage your merchant profile and API keys.
        </p>
      </div>

      {/* Profile Section */}
      <section
        aria-labelledby="profile-heading"
        className="dark-card mb-8 motion-safe:animate-page-enter"
      >
        <h2
          id="profile-heading"
          className="text-[18px] font-bold text-recur-text-heading mb-1"
        >
          Profile
        </h2>
        {merchant?.walletAddress && (
          <p className="text-[11px] text-recur-text-dim font-mono mb-6 break-all">
            Wallet: {merchant.walletAddress}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveProfile();
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Field
            id="profile-name"
            label="Name"
            value={name}
            onChange={(v) => {
              setName(v);
              if (nameError) setNameError("");
            }}
            placeholder="Your name"
            error={nameError}
            autoComplete="name"
          />
          <Field
            id="profile-email"
            label="Email"
            type="email"
            value={email}
            onChange={(v) => {
              setEmail(v);
              if (emailError) setEmailError("");
            }}
            placeholder="you@example.com"
            error={emailError}
            autoComplete="email"
          />
          <Field
            id="profile-phone"
            label="Phone"
            type="tel"
            value={phone}
            onChange={(v) => {
              setPhone(v);
              if (phoneError) setPhoneError("");
            }}
            placeholder="+1 (555) 000-0000"
            error={phoneError}
            autoComplete="tel"
          />
          <Field
            id="profile-business-name"
            label="Business Name"
            value={businessName}
            onChange={(v) => {
              setBusinessName(v);
              if (businessNameError) setBusinessNameError("");
            }}
            placeholder="Acme Inc."
            error={businessNameError}
            autoComplete="organization"
          />
          <Field
            id="profile-business-url"
            label="Business URL"
            type="url"
            value={businessUrl}
            onChange={(v) => {
              setBusinessUrl(v);
              if (businessUrlError) setBusinessUrlError("");
            }}
            placeholder="https://your-business.com"
            error={businessUrlError}
            autoComplete="url"
            className="md:col-span-2"
          />
          <div className="md:col-span-2 mt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </form>
      </section>

      {/* API Keys Section */}
      <section
        aria-labelledby="api-keys-heading"
        className="dark-card motion-safe:animate-page-enter"
        style={{ animationDelay: "60ms" }}
      >
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h2
            id="api-keys-heading"
            className="text-[18px] font-bold text-recur-text-heading"
          >
            API Keys
          </h2>
          <button
            onClick={handleCreateApiKey}
            disabled={creatingKey}
            className="btn-primary text-[12px] px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingKey ? "Creating…" : "Create Key"}
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
          <p className="text-[13px] text-recur-text-muted">No API keys yet.</p>
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
            className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed bg-recur-error/10 border-recur-error/30 text-recur-error hover:bg-recur-error/20"
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
