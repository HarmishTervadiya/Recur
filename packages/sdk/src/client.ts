import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createApproveInstruction,
} from "@solana/spl-token";
import { BorshCoder, type Idl } from "@coral-xyz/anchor";
import {
  PROGRAM_ID as DEFAULT_PROGRAM_ID,
  USDC_MINT_DEVNET,
  findSubscriptionPda,
  planSeedToBuffer,
  planSeedToArray,
} from "@recur/solana-client";

import type {
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
  CreatePlanOptions,
  RegisterSubscriptionOptions,
  ListOptions,
} from "./types.js";

// ---------------------------------------------------------------------------
// Minimal IDL fragment — just enough for instruction encoding/decoding.
// This avoids depending on a full Anchor IDL JSON file.
// ---------------------------------------------------------------------------

const SUBSCRIPTION_ACCOUNT_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1; // discriminator + fields

// Instruction discriminators (first 8 bytes of sha256("global:<name>"))
import crypto from "crypto";

function ixDiscriminator(name: string): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(`global:${name}`).digest()
  ).subarray(0, 8);
}

const IX_INITIALIZE_SUBSCRIPTION = ixDiscriminator("initialize_subscription");
const IX_REQUEST_CANCEL = ixDiscriminator("request_cancel");
const IX_FINALIZE_CANCEL = ixDiscriminator("finalize_cancel");

// ---------------------------------------------------------------------------
// RecurClient
// ---------------------------------------------------------------------------

export class RecurClient {
  readonly connection: Connection;
  readonly programId: PublicKey;
  readonly usdcMint: PublicKey;
  readonly apiBaseUrl: string;
  private readonly apiKey?: string;

  constructor(config: RecurConfig) {
    this.connection = new Connection(config.rpcUrl, "confirmed");
    this.programId = config.programId
      ? new PublicKey(config.programId)
      : DEFAULT_PROGRAM_ID;
    this.usdcMint = config.usdcMint
      ? new PublicKey(config.usdcMint)
      : USDC_MINT_DEVNET;
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  // =========================================================================
  // On-chain reads
  // =========================================================================

  /**
   * Fetch and deserialize a Subscription PDA account.
   * Returns null if the account doesn't exist.
   */
  async getSubscriptionAccount(
    subscriptionPda: PublicKey,
  ): Promise<OnChainSubscription | null> {
    const info = await this.connection.getAccountInfo(subscriptionPda);
    if (!info || info.data.length < SUBSCRIPTION_ACCOUNT_SIZE) return null;

    const data = info.data;
    let offset = 8; // skip discriminator

    const subscriber = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const merchant = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const planSeed = Array.from(data.subarray(offset, offset + 8));
    offset += 8;
    const amount = data.readBigUInt64LE(offset);
    offset += 8;
    const interval = data.readBigUInt64LE(offset);
    offset += 8;
    const lastPaymentTimestamp = data.readBigUInt64LE(offset);
    offset += 8;
    const createdAt = data.readBigUInt64LE(offset);
    offset += 8;
    const cancelRequestedAt = data.readBigUInt64LE(offset);
    offset += 8;
    const bump = data[offset]!;

    return {
      subscriber,
      merchant,
      planSeed,
      amount,
      interval,
      lastPaymentTimestamp,
      createdAt,
      cancelRequestedAt,
      bump,
    };
  }

  /**
   * Derive the subscription PDA for given parameters.
   */
  deriveSubscriptionPda(
    subscriber: PublicKey,
    merchant: PublicKey,
    planSeedHex: string,
  ): { pda: PublicKey; bump: number } {
    const seedBuf = planSeedToBuffer(planSeedHex);
    const [pda, bump] = findSubscriptionPda(
      subscriber,
      merchant,
      seedBuf,
      this.programId,
    );
    return { pda, bump };
  }

  // =========================================================================
  // Subscriber — transaction builders
  // =========================================================================

  /**
   * Build instructions to create a new subscription on-chain.
   * 
   * Returns the instructions array — the caller (wallet adapter) signs and
   * sends the transaction.
   *
   * Instructions:
   *   1. SPL Token `approve` — delegate subscription PDA to pull funds
   *   2. `initialize_subscription` — create the PDA on-chain
   */
  buildSubscribeTransaction(
    subscriberWallet: PublicKey,
    options: SubscribeOptions,
  ): SubscribeTransaction {
    const merchantPubkey = new PublicKey(options.merchantWallet);
    const seedBuf = planSeedToBuffer(options.planSeed);
    const seedArray = planSeedToArray(options.planSeed);

    const [subscriptionPda, bump] = findSubscriptionPda(
      subscriberWallet,
      merchantPubkey,
      seedBuf,
      this.programId,
    );

    // Subscriber's USDC ATA
    const subscriberAta = getAssociatedTokenAddressSync(
      this.usdcMint,
      subscriberWallet,
    );

    // Delegation: approve the subscription PDA as delegate for N cycles
    const cycles = options.delegationCycles ?? 12;
    const delegationAmount = BigInt(options.amount) * BigInt(cycles);

    const approveIx = createApproveInstruction(
      subscriberAta,
      subscriptionPda,
      subscriberWallet,
      delegationAmount,
    );

    // Build initialize_subscription instruction manually
    // Layout: discriminator(8) + amount(u64 LE) + interval(u64 LE) + plan_seed([u8;8])
    const ixData = Buffer.alloc(8 + 8 + 8 + 8);
    IX_INITIALIZE_SUBSCRIPTION.copy(ixData, 0);
    ixData.writeBigUInt64LE(BigInt(options.amount), 8);
    ixData.writeBigUInt64LE(BigInt(options.intervalSeconds), 16);
    Buffer.from(seedArray).copy(ixData, 24);

    const initIx = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: subscriptionPda, isSigner: false, isWritable: true },
        { pubkey: subscriberWallet, isSigner: true, isWritable: true },
        { pubkey: merchantPubkey, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixData,
    });

    return {
      subscriptionPda,
      instructions: [approveIx, initIx],
      bump,
    };
  }

  /**
   * Build an SPL Token `approve` instruction to re-delegate the subscriber's
   * USDC ATA to an existing subscription PDA. Used when delegation is exhausted
   * or revoked and the subscription is still active on-chain.
   */
  buildReapproveTransaction(
    subscriberWallet: PublicKey,
    options: {
      merchantWallet: string;
      planSeed: string;
      amount: number;
      delegationCycles?: number;
    },
  ): { subscriptionPda: PublicKey; instructions: TransactionInstruction[] } {
    const merchantPubkey = new PublicKey(options.merchantWallet);
    const seedBuf = planSeedToBuffer(options.planSeed);

    const [subscriptionPda] = findSubscriptionPda(
      subscriberWallet,
      merchantPubkey,
      seedBuf,
      this.programId,
    );

    const subscriberAta = getAssociatedTokenAddressSync(
      this.usdcMint,
      subscriberWallet,
    );

    const cycles = options.delegationCycles ?? 12;
    const delegationAmount = BigInt(options.amount) * BigInt(cycles);

    const approveIx = createApproveInstruction(
      subscriberAta,
      subscriptionPda,
      subscriberWallet,
      delegationAmount,
    );

    return {
      subscriptionPda,
      instructions: [approveIx],
    };
  }

  /**
   * Build the `request_cancel` instruction.
   * The authority (signer) must be either the subscriber or merchant.
   */
  buildCancelTransaction(
    authorityWallet: PublicKey,
    options: CancelOptions,
  ): CancelTransaction {
    const subscriberPubkey = new PublicKey(options.subscriberWallet);
    const merchantPubkey = new PublicKey(options.merchantWallet);
    const seedBuf = planSeedToBuffer(options.planSeed);

    const [subscriptionPda] = findSubscriptionPda(
      subscriberPubkey,
      merchantPubkey,
      seedBuf,
      this.programId,
    );

    const ixData = Buffer.alloc(8);
    IX_REQUEST_CANCEL.copy(ixData, 0);

    const cancelIx = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: subscriptionPda, isSigner: false, isWritable: true },
        { pubkey: authorityWallet, isSigner: true, isWritable: false },
        { pubkey: subscriberPubkey, isSigner: false, isWritable: false },
        { pubkey: merchantPubkey, isSigner: false, isWritable: false },
      ],
      data: ixData,
    });

    return { instructions: [cancelIx] };
  }

  /**
   * Build the `finalize_cancel` instruction.
   * Permissionless — anyone can call once cancel_requested_at > 0 and the
   * paid period has elapsed. Closes the PDA and refunds rent to subscriber.
   */
  buildFinalizeCancelTransaction(
    options: CancelOptions,
  ): CancelTransaction {
    const subscriberPubkey = new PublicKey(options.subscriberWallet);
    const merchantPubkey = new PublicKey(options.merchantWallet);
    const seedBuf = planSeedToBuffer(options.planSeed);

    const [subscriptionPda] = findSubscriptionPda(
      subscriberPubkey,
      merchantPubkey,
      seedBuf,
      this.programId,
    );

    const ixData = Buffer.alloc(8);
    IX_FINALIZE_CANCEL.copy(ixData, 0);

    const finalizeIx = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: subscriptionPda, isSigner: false, isWritable: true },
        { pubkey: subscriberPubkey, isSigner: false, isWritable: true },
        { pubkey: merchantPubkey, isSigner: false, isWritable: false },
      ],
      data: ixData,
    });

    return { instructions: [finalizeIx] };
  }

  // =========================================================================
  // API helpers (shared)
  // =========================================================================

  private async apiFetch<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    // Caller-supplied headers take precedence over the stored API key.
    // This allows subscriber methods to pass a per-call Bearer token
    // without it being overwritten by the merchant API key.
    const callerHeaders = (options.headers as Record<string, string> | undefined) ?? {};
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...callerHeaders,
    };

    if (this.apiKey && !callerHeaders["Authorization"]) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const url = `${this.apiBaseUrl}${path}`;

    try {
      const res = await fetch(url, { ...options, headers });
      return (await res.json()) as ApiResponse<T>;
    } catch {
      return {
        success: false,
        data: null,
        error: { code: "NETWORK_ERROR", message: "Failed to reach Recur API" },
      };
    }
  }

  // =========================================================================
  // Public API — Plan queries (no auth needed)
  // =========================================================================

  /**
   * Fetch all active plans for an app (public endpoint).
   */
  async getPlans(appId: string): Promise<ApiResponse<PlanInfo[]>> {
    const params = new URLSearchParams({ appId });
    return this.apiFetch<PlanInfo[]>(`/plans?${params.toString()}`);
  }

  /**
   * Fetch a single plan by ID with merchant info (public endpoint).
   */
  async getPlan(appId: string, planId: string): Promise<ApiResponse<PlanInfo>> {
    const params = new URLSearchParams({ appId });
    return this.apiFetch<PlanInfo>(`/plans/${planId}?${params.toString()}`);
  }

  // =========================================================================
  // Merchant API — requires API key
  // =========================================================================

  /**
   * Create a new plan for an app. Requires API key.
   */
  async createPlan(options: CreatePlanOptions): Promise<ApiResponse<PlanInfo>> {
    return this.apiFetch<PlanInfo>(`/merchant/apps/${options.appId}/plans`, {
      method: "POST",
      body: JSON.stringify({
        name: options.name,
        description: options.description,
        amountBaseUnits: options.amountBaseUnits,
        intervalSeconds: options.intervalSeconds,
      }),
    });
  }

  /**
   * List plans for a merchant's app. Requires API key.
   */
  async listPlans(appId: string): Promise<ApiResponse<PlanInfo[]>> {
    return this.apiFetch<PlanInfo[]>(`/merchant/apps/${appId}/plans`);
  }

  /**
   * List subscriptions for a merchant's app. Requires API key.
   */
  async listSubscriptions(
    appId: string,
    options?: ListOptions,
  ): Promise<ApiResponse<SubscriptionInfo[]>> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    return this.apiFetch<SubscriptionInfo[]>(
      `/merchant/apps/${appId}/subscriptions${qs ? `?${qs}` : ""}`,
    );
  }

  /**
   * Get payment history for a merchant's app. Requires API key.
   */
  async getPaymentHistory(
    appId: string,
    options?: ListOptions,
  ): Promise<ApiResponse<TransactionInfo[]>> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    return this.apiFetch<TransactionInfo[]>(
      `/merchant/apps/${appId}/transactions${qs ? `?${qs}` : ""}`,
    );
  }

  // =========================================================================
  // Subscriber API — requires subscriber JWT (passed per-call, not stored)
  // =========================================================================

  /**
   * Register a newly-created on-chain subscription with the Recur API.
   * Call this after the initialize_subscription transaction confirms on-chain.
   *
   * @param options  - appId + planId + subscriptionPda
   * @param authToken - Subscriber JWT from the nonce→sign→verify auth flow
   */
  async registerSubscription(
    options: RegisterSubscriptionOptions,
    authToken: string,
  ): Promise<ApiResponse<SubscriptionInfo>> {
    return this.apiFetch<SubscriptionInfo>("/subscriber/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        appId: options.appId,
        planId: options.planId,
        subscriptionPda: options.subscriptionPda,
      }),
      headers: { Authorization: `Bearer ${authToken}` },
    });
  }

  /**
   * Fetch all subscriptions for the authenticated subscriber.
   *
   * @param authToken - Subscriber JWT
   * @param options   - Pagination options
   */
  async getMySubscriptions(
    authToken: string,
    options?: ListOptions,
  ): Promise<ApiResponse<SubscriptionInfo[]>> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    return this.apiFetch<SubscriptionInfo[]>(
      `/subscriber/subscriptions${qs ? `?${qs}` : ""}`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
  }

  /**
   * Fetch a single subscription by its on-chain PDA address.
   * Scans the subscriber's subscriptions for a matching PDA.
   * Falls back to the on-chain account if the API returns no match.
   *
   * @param subscriptionPda - Base58 PDA address
   * @param authToken       - Subscriber JWT
   */
  async getSubscription(
    subscriptionPda: string,
    authToken: string,
  ): Promise<ApiResponse<SubscriptionInfo | null>> {
    // Fetch all subscriber subscriptions and find by PDA
    const res = await this.getMySubscriptions(authToken);
    if (!res.success || !res.data) {
      return { success: res.success, data: null, error: res.error };
    }

    const match = res.data.find((s) => s.subscriptionPda === subscriptionPda) ?? null;
    return { success: true, data: match, error: null };
  }
}
