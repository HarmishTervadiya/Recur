export { RecurProvider, RecurContext } from "./provider/RecurProvider.js";
export type { RecurProviderProps, RecurContextValue } from "./provider/RecurProvider.js";

export { AuthManager } from "./provider/AuthManager.js";
export type { AuthSession, AuthManagerOptions } from "./provider/AuthManager.js";

export { useRecur } from "./hooks/useRecur.js";
export { useAuth } from "./hooks/useAuth.js";
export { useSubscribe } from "./hooks/useSubscribe.js";
export { useMySubscriptions } from "./hooks/useMySubscriptions.js";
export { useCancelSubscription } from "./hooks/useCancelSubscription.js";
export { useReapprove } from "./hooks/useReapprove.js";
export { usePlan, usePlans } from "./hooks/usePlans.js";

export type { UseAuthResult } from "./hooks/useAuth.js";
export type { SubscribeArgs, UseSubscribeResult } from "./hooks/useSubscribe.js";
export type { UseMySubscriptionsOptions } from "./hooks/useMySubscriptions.js";
export type { CancelMode, UseCancelSubscriptionResult } from "./hooks/useCancelSubscription.js";
export type { ReapproveArgs, UseReapproveResult } from "./hooks/useReapprove.js";

export {
  RecurError,
  WalletRejectedError,
  InsufficientFundsError,
  DelegationExhaustedError,
  PlanInactiveError,
  SubscriptionAlreadyExistsError,
  NetworkError,
  AuthError,
} from "@recur/sdk";

export type {
  RecurWallet,
  Cluster,
  PlanInfo,
  SubscriptionInfo,
} from "@recur/sdk";
