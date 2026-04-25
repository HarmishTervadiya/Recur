import type { PublicKey, TransactionInstruction, Connection } from "@solana/web3.js";
import type { EventType, SubscriptionStatus } from "@recur/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RecurConfig {
  /** Solana RPC URL. */
  rpcUrl: string;
  /** Recur API base URL (e.g. "https://api.recur.so" or "http://localhost:3001"). */
  apiBaseUrl: string;
  /** Recur program ID. Defaults to the deployed devnet program. */
  programId?: string;
  /** USDC mint address. Defaults to devnet USDC. */
  usdcMint?: string;
  /** API key for merchant-authenticated endpoints. */
  apiKey?: string;
}

// ---------------------------------------------------------------------------
// On-chain account data (deserialized from Subscription PDA)
// ---------------------------------------------------------------------------

export interface OnChainSubscription {
  subscriber: PublicKey;
  merchant: PublicKey;
  planSeed: number[];
  amount: bigint;
  interval: bigint;
  lastPaymentTimestamp: bigint;
  createdAt: bigint;
  cancelRequestedAt: bigint;
  bump: number;
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PlanInfo {
  id: string;
  appId: string;
  name: string;
  description: string | null;
  amountBaseUnits: string;
  intervalSeconds: number;
  planSeed: string;
  isActive: boolean;
  createdAt: string;
  app?: {
    name: string;
    merchant: {
      id: string;
      name: string | null;
      walletAddress: string;
    };
  };
}

export interface SubscriptionInfo {
  id: string;
  subscriptionPda: string;
  status: SubscriptionStatus;
  planId: string;
  subscriberId: string;
  lastPaymentAt: string | null;
  nextPaymentDue: string | null;
  cancelRequestedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  plan?: PlanInfo;
}

export interface TransactionInfo {
  id: string;
  txSignature: string;
  amountGross: string;
  platformFee: string;
  amountNet: string;
  status: string;
  fromWallet: string | null;
  toWallet: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Method options
// ---------------------------------------------------------------------------

export interface SubscribeOptions {
  /** Plan ID (from API). */
  planId: string;
  /** Merchant wallet address. */
  merchantWallet: string;
  /** Plan seed (hex string, 16 chars). */
  planSeed: string;
  /** Amount in base units (e.g. 10_000_000 for $10 USDC). */
  amount: number;
  /** Interval in seconds. */
  intervalSeconds: number;
  /** Number of billing cycles to approve delegation for. Defaults to 12. */
  delegationCycles?: number;
}

export interface CancelOptions {
  /** The subscription PDA address. */
  subscriptionPda: string;
  /** Subscriber wallet public key (for PDA derivation). */
  subscriberWallet: string;
  /** Merchant wallet public key (for PDA derivation). */
  merchantWallet: string;
  /** Plan seed (hex, 16 chars). */
  planSeed: string;
}

export interface ListOptions {
  page?: number;
  limit?: number;
}

export interface CreatePlanOptions {
  appId: string;
  name: string;
  description?: string;
  amountBaseUnits: number;
  intervalSeconds: number;
}

export interface RegisterSubscriptionOptions {
  /** App ID that owns the plan. */
  appId: string;
  /** Plan ID (cuid from API). */
  planId: string;
  /** The on-chain subscription PDA address (base58). */
  subscriptionPda: string;
}

// ---------------------------------------------------------------------------
// Transaction builder result
// ---------------------------------------------------------------------------

export interface SubscribeTransaction {
  /** The computed subscription PDA. */
  subscriptionPda: PublicKey;
  /** All instructions needed: approve delegation + initialize_subscription. */
  instructions: TransactionInstruction[];
  /** The PDA bump seed. */
  bump: number;
}

export interface CancelTransaction {
  /** The request_cancel instruction. */
  instructions: TransactionInstruction[];
}
