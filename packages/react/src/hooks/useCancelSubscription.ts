/**
 * Cancel a subscription via the L3 `client.cancel()` helper.
 *
 * Modes:
 *   - "request" (default): on-chain `request_cancel`; subscription remains
 *     active until the paid period elapses, preserving prepaid time.
 *   - "instant": on-chain `subscriber_cancel`; closes immediately, subscriber
 *     forfeits any prepaid time.
 */

import type { RecurError, SubscriptionInfo } from "@recur/sdk";
import { useRecur } from "./useRecur.js";
import { useAsyncAction } from "../internal/useAsyncAction.js";
import { useConnectedWallet } from "../internal/useConnectedWallet.js";

export type CancelMode = "request" | "instant";

export interface UseCancelSubscriptionResult {
  cancel: (subscription: SubscriptionInfo, mode?: CancelMode) => Promise<string>;
  isLoading: boolean;
  error: RecurError | null;
  reset: () => void;
}

export function useCancelSubscription(): UseCancelSubscriptionResult {
  const { client } = useRecur();
  const getWallet = useConnectedWallet();

  const action = useAsyncAction(
    async (subscription: SubscriptionInfo, mode: CancelMode = "request"): Promise<string> => {
      const wallet = getWallet();
      const merchantWallet = subscription.plan?.app?.merchant?.walletAddress;
      const planSeed = subscription.plan?.planSeed;
      if (!merchantWallet || !planSeed) {
        throw new Error("Subscription missing plan/merchant context");
      }
      const { signature } = await client.cancel(wallet, { merchantWallet, planSeed, mode });
      return signature;
    },
  );

  return {
    cancel: action.run,
    isLoading: action.isLoading,
    error: action.error,
    reset: action.reset,
  };
}
