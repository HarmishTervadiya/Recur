"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "./api-client";

export type MerchantTier = "free" | "pro";
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "expired";

export interface ProStatus {
  tier: MerchantTier;
  subscriptionStatus: SubscriptionStatus | null;
  gracePeriodExpiresAt: string | null;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextPaymentDue: string;
    subscriptionPda: string;
    platformPlan: {
      id: string;
      name: string;
      priceBaseUnits: string;
      feeBps: number;
    };
  } | null;
  proPlanId: string | null;
  proPriceBaseUnits: number;
}

export function useTier() {
  const [data, setData] = useState<ProStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await apiClient<ProStatus>("/merchant/me/pro");
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error?.message ?? "Failed to fetch tier status");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isPro =
    data?.tier === "pro" &&
    (data.subscriptionStatus === "active" ||
      (data.subscriptionStatus === "past_due" &&
        data.gracePeriodExpiresAt &&
        new Date(data.gracePeriodExpiresAt) > new Date()));

  return {
    tier: data?.tier ?? "free",
    subscriptionStatus: data?.subscriptionStatus ?? null,
    gracePeriodExpiresAt: data?.gracePeriodExpiresAt
      ? new Date(data.gracePeriodExpiresAt)
      : null,
    subscription: data?.subscription ?? null,
    proPlanId: data?.proPlanId ?? null,
    proPriceBaseUnits: data?.proPriceBaseUnits ?? 49_000_000,
    isPro: Boolean(isPro),
    isLoading,
    error,
    refresh,
  };
}
