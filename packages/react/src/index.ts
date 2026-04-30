export { RecurProvider, RecurContext } from "./provider/RecurProvider.js";
export type { RecurProviderProps, RecurContextValue } from "./provider/RecurProvider.js";

export { AuthManager } from "./provider/AuthManager.js";
export type { AuthSession, AuthManagerOptions } from "./provider/AuthManager.js";

export { useRecur } from "./hooks/useRecur.js";
export { useAuth } from "./hooks/useAuth.js";
export type { UseAuthResult } from "./hooks/useAuth.js";

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

export type { RecurWallet, Cluster } from "@recur/sdk";
