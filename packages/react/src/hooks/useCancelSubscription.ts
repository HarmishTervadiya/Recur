/**
 * Cancel a subscription.
 *
 * Modes:
 *   - "request" (default): on-chain `request_cancel`; subscription remains
 *     active until the paid period elapses, preserving prepaid time.
 *   - "instant": on-chain `subscriber_cancel`; closes immediately, subscriber
 *     forfeits any prepaid time.
 */

import { signAndSend, type RecurError, type SubscriptionInfo } from "@recur/sdk";
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
      const plan = subscription.plan;
      if (!plan?.app?.merchant?.walletAddress) {
        throw new Error("Subscription missing plan/merchant context");
      }
      const merchantWallet = plan.app.merchant.walletAddress;

      const { instructions } =
        mode === "instant"
          ? client.buildSubscriberCancelTransaction(wallet.publicKey, {
              merchantWallet,
              planSeed: plan.planSeed,
            })
          : client.buildCancelTransaction(wallet.publicKey, {
              subscriptionPda: subscription.subscriptionPda,
              subscriberWallet: wallet.publicKey.toBase58(),
              merchantWallet,
              planSeed: plan.planSeed,
            });

      return signAndSend(client.connection, wallet, instructions);
    },
  );

  return {
    cancel: action.run,
    isLoading: action.isLoading,
    error: action.error,
    reset: action.reset,
  };
}
