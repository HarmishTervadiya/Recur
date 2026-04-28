"use client";

import { useCallback, useRef, useState } from "react";
import { apiClient, parseFieldErrors } from "../../../../../lib/api-client";
import { useToast } from "../../../../../components/ui/ToastProvider";
import { Modal } from "../../../../../components/ui/Modal";
import {
  formatAmount,
  formatInterval,
  INTERVAL_OPTIONS,
  type Plan,
} from "./utils";

interface PlansTabProps {
  appId: string;
  plans: Plan[];
  onRefresh: () => void;
}

export function PlansTab({ appId, plans, onRefresh }: PlansTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [planInterval, setPlanInterval] = useState(2592000);
  const [creating, setCreating] = useState(false);
  const [planNameError, setPlanNameError] = useState("");
  const [planAmountError, setPlanAmountError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const close = useCallback(() => {
    setShowCreate(false);
    setPlanNameError("");
    setPlanAmountError("");
  }, []);

  const handleCreate = useCallback(async () => {
    setPlanNameError("");
    setPlanAmountError("");
    const amountUsd = parseFloat(planAmount);
    let valid = true;
    if (!planName.trim()) {
      setPlanNameError("Plan name is required");
      valid = false;
    }
    if (!planAmount || isNaN(amountUsd) || amountUsd < 1) {
      setPlanAmountError("Amount must be at least $1.00");
      valid = false;
    }
    if (!valid) return;
    setCreating(true);
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
      setShowCreate(false);
      toast("success", "Plan created successfully");
      onRefresh();
    } else {
      const { fieldErrors, fallbackMessage } = parseFieldErrors(res, [
        "name",
        "amountBaseUnits",
        "intervalSeconds",
        "description",
      ]);
      if (fieldErrors.name) setPlanNameError(fieldErrors.name);
      if (fieldErrors.amountBaseUnits)
        setPlanAmountError(fieldErrors.amountBaseUnits);
      if (fallbackMessage) toast("error", fallbackMessage);
      else if (!fieldErrors.name && !fieldErrors.amountBaseUnits)
        toast("error", res.error?.message ?? "Failed to create plan");
    }
    setCreating(false);
  }, [appId, planAmount, planName, planDesc, planInterval, onRefresh, toast]);

  return (
    <div
      key="tab-plans"
      id="tabpanel-plans"
      role="tabpanel"
      aria-labelledby="tab-plans"
      className="motion-safe:animate-fade-in"
    >
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-[15px] font-bold text-recur-text-heading">
          {plans.length} {plans.length === 1 ? "Plan" : "Plans"}
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary text-[12px] px-3 py-1.5"
        >
          Create Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="dark-card flex flex-col items-center justify-center py-12 text-center">
          <p className="text-recur-text-muted text-[13px] mb-4">
            No plans yet.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-[13px] px-4 py-2"
          >
            Create First Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plans.map((plan, idx) => (
            <div
              key={plan.id}
              className="dark-card motion-safe:animate-page-enter"
              style={{ animationDelay: `${Math.min(idx, 6) * 40}ms` }}
            >
              <div className="flex items-start justify-between mb-2 gap-3">
                <h3 className="text-[14px] font-bold text-recur-text-heading truncate min-w-0">
                  {plan.name}
                </h3>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
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
                <p className="text-[12px] text-recur-text-muted mb-2 line-clamp-2">
                  {plan.description}
                </p>
              )}
              <div className="text-[10px] font-mono text-recur-text-dim truncate">
                Seed: {plan.planSeed}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={close}
        onSubmit={handleCreate}
        title="Create Plan"
        initialFocusRef={nameRef}
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="plan-name"
              className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5"
            >
              Plan Name
            </label>
            <input
              id="plan-name"
              ref={nameRef}
              type="text"
              value={planName}
              onChange={(e) => {
                setPlanName(e.target.value);
                if (planNameError) setPlanNameError("");
              }}
              placeholder="Premium Monthly"
              aria-invalid={Boolean(planNameError)}
              aria-describedby={planNameError ? "plan-name-error" : undefined}
              className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none motion-safe:transition-colors ${
                planNameError
                  ? "border-recur-error"
                  : "border-recur-border focus:border-recur-primary"
              }`}
            />
            {planNameError && (
              <p
                id="plan-name-error"
                className="text-[11px] text-recur-error mt-1"
              >
                {planNameError}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="plan-amount"
              className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5"
            >
              Amount (USDC)
            </label>
            <input
              id="plan-amount"
              type="number"
              value={planAmount}
              onChange={(e) => {
                setPlanAmount(e.target.value);
                if (planAmountError) setPlanAmountError("");
              }}
              placeholder="5.00"
              min="1"
              step="0.01"
              aria-invalid={Boolean(planAmountError)}
              aria-describedby={planAmountError ? "plan-amount-error" : undefined}
              className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none motion-safe:transition-colors font-mono ${
                planAmountError
                  ? "border-recur-error"
                  : "border-recur-border focus:border-recur-primary"
              }`}
            />
            {planAmountError && (
              <p
                id="plan-amount-error"
                className="text-[11px] text-recur-error mt-1"
              >
                {planAmountError}
              </p>
            )}
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5">
              Billing Interval
            </span>
            <div
              role="radiogroup"
              aria-label="Billing interval"
              className="grid grid-cols-4 gap-2"
            >
              {INTERVAL_OPTIONS.map((opt) => {
                const selected = planInterval === opt.seconds;
                return (
                  <button
                    key={opt.seconds}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPlanInterval(opt.seconds)}
                    className={`text-[11px] font-semibold py-2 rounded-[10px] border motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary ${
                      selected
                        ? "text-recur-light bg-recur-purple-tint border-recur-border-light"
                        : "text-recur-text-dim border-recur-border hover:border-recur-border-light"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label
              htmlFor="plan-desc"
              className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5"
            >
              Description (optional)
            </label>
            <input
              id="plan-desc"
              type="text"
              value={planDesc}
              onChange={(e) => setPlanDesc(e.target.value)}
              placeholder="Access to premium features"
              className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading placeholder:text-recur-text-dim focus:outline-none focus:border-recur-primary motion-safe:transition-colors"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleCreate}
            disabled={creating || !planName.trim() || !planAmount}
            className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating…" : "Create Plan"}
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
