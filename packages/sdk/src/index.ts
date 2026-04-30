export { RecurClient } from "./client.js";

export { signAndSend } from "./internal/sign-and-send.js";
export { unwrap } from "./internal/http.js";

export { verifyWebhookSignature, parseWebhookPayload } from "./webhook.js";

export {
  RecurError,
  WalletRejectedError,
  InsufficientFundsError,
  DelegationExhaustedError,
  PlanInactiveError,
  SubscriptionAlreadyExistsError,
  NetworkError,
  AuthError,
  mapError,
} from "./errors.js";

export { getClusterDefaults } from "./constants.js";
export type { Cluster, ClusterDefaults } from "./constants.js";

export type {
  RecurConfig,
  RecurWallet,
  OnChainSubscription,
  SubscribeOptions,
  SubscribeTransaction,
  CancelOptions,
  CancelTransaction,
  PlanInfo,
  SubscriptionInfo,
  TransactionInfo,
  ApiResponse,
  PaginationMeta,
  CreatePlanOptions,
  RegisterSubscriptionOptions,
  ListOptions,
} from "./types.js";

export {
  PROGRAM_ID,
  USDC_MINT_DEVNET,
  findSubscriptionPda,
  findTreasuryVaultPda,
  planSeedToBuffer,
  planSeedToArray,
} from "@recur/solana-client";

export type { EventType, SubscriptionStatus, WebhookPayload } from "@recur/types";
