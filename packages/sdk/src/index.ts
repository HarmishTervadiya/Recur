// @recur/sdk — Recur Protocol SDK
// Non-custodial auto-pay subscriptions on Solana.

// Core client
export { RecurClient } from "./client.js";

// Webhook verification (also exported as "@recur/sdk/webhook")
export { verifyWebhookSignature, parseWebhookPayload } from "./webhook.js";

// Types
export type {
  RecurConfig,
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
  ListOptions,
} from "./types.js";

// Re-export useful helpers from solana-client
export {
  PROGRAM_ID,
  USDC_MINT_DEVNET,
  findSubscriptionPda,
  findTreasuryVaultPda,
  planSeedToBuffer,
  planSeedToArray,
} from "@recur/solana-client";

// Re-export types from @recur/types
export type { EventType, SubscriptionStatus, WebhookPayload } from "@recur/types";
