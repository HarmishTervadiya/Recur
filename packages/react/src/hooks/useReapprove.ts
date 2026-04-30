/**
 * Re-approve delegation for an existing subscription via L3
 * `client.reapprove()`. Used when delegation is exhausted or revoked.
 */

import type { RecurError, SubscriptionInfo } from "@recur/sdk";
import { useRecur } from "./useRecur.js";
import { useAsyncAction } from "../internal/useAsyncAction.js";
import { useConnectedWallet } from "../internal/useConnectedWallet.js";

export interface ReapproveArgs {
  subscription: SubscriptionInfo;
  /** Number of cycles to re-approve. Defaults to 12. */
  cycles?: number;
}

export interface UseReapproveResult {
  reapprove: (args: ReapproveArgs) => Promise<string>;
  isLoading: boolean;
  error: RecurError | null;
  reset: () => void;
}

export function useReapprove(): UseReapproveResult {
  const { client } = useRecur();
  const getWallet = useConnectedWallet();

  const action = useAsyncAction(async ({ subscription, cycles }: ReapproveArgs): Promise<string> => {
    const wallet = getWallet();
    const plan = subscription.plan;
    if (!plan?.app?.merchant?.walletAddress) {
      throw new Error("Subscription missing plan/merchant context");
    }
    const { signature } = await client.reapprove(wallet, {
      merchantWallet: plan.app.merchant.walletAddress,
      planSeed: plan.planSeed,
      amount: Number(plan.amountBaseUnits),
      delegationCycles: cycles,
    });
    return signature;
  });

  return {
    reapprove: action.run,
    isLoading: action.isLoading,
    error: action.error,
    reset: action.reset,
  };
}
