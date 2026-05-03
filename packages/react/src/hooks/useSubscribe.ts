/**
 * Subscribe to a plan via the L3 `client.subscribe()` helper.
 * Fetches the plan, then delegates build/sign/send/register to the SDK.
 */

import { unwrap, type PlanInfo, type SubscriptionInfo, type RecurError } from "@recur/sdk";
import { useRecur } from "./useRecur.js";
import { useAuth } from "./useAuth.js";
import { useAsyncAction } from "../internal/useAsyncAction.js";
import { useConnectedWallet } from "../internal/useConnectedWallet.js";

export interface SubscribeArgs {
  planId: string;
  appId: string;
  /** Override default delegation horizon (cycles). Defaults to 12. */
  delegationCycles?: number;
}

export interface UseSubscribeResult {
  subscribe: (args: SubscribeArgs) => Promise<SubscriptionInfo>;
  data: SubscriptionInfo | null;
  isLoading: boolean;
  error: RecurError | null;
  reset: () => void;
}

export function useSubscribe(): UseSubscribeResult {
  const { client } = useRecur();
  const { ensureAuthenticated } = useAuth();
  const getWallet = useConnectedWallet();

  const action = useAsyncAction(async (args: SubscribeArgs): Promise<SubscriptionInfo> => {
    const wallet = getWallet();
    console.log("[useSubscribe] Starting subscribe flow", { appId: args.appId, planId: args.planId, wallet: wallet.publicKey.toBase58() });
    const token = await ensureAuthenticated();

    const plan = unwrap<PlanInfo>(await client.getPlan(args.appId, args.planId));
    console.log("[useSubscribe] Plan fetched:", { id: plan.id, name: plan.name, amount: plan.amountBaseUnits, active: plan.isActive });
    if (!plan.isActive) throw new Error("PLAN_INACTIVE");
    const merchantWallet = plan.app?.merchant.walletAddress;
    if (!merchantWallet) throw new Error("Plan missing merchant wallet");

    const { subscription } = await client.subscribe(
      wallet,
      {
        planId: plan.id,
        appId: args.appId,
        merchantWallet,
        planSeed: plan.planSeed,
        amount: Number(plan.amountBaseUnits),
        intervalSeconds: plan.intervalSeconds,
        delegationCycles: args.delegationCycles,
      },
      token,
    );
    console.log("[useSubscribe] Subscribe complete:", { subId: subscription.id, pda: subscription.subscriptionPda });
    return subscription;
  });

  return {
    subscribe: action.run,
    data: action.data,
    isLoading: action.isLoading,
    error: action.error,
    reset: action.reset,
  };
}
