import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createApproveInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import {
  PROGRAM_ID as DEFAULT_PROGRAM_ID,
  USDC_MINT_DEVNET,
  findSubscriptionPda,
  planSeedToBuffer,
  planSeedToArray,
} from "@recur/solana-client";
import crypto from "crypto";
import { InsufficientFundsError } from "./errors.js";

import type {
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
  CreatePlanOptions,
  RegisterSubscriptionOptions,
  ListOptions,
} from "./types.js";
import { request, unwrap, type HttpOptions } from "./internal/http.js";
import { signAndSend } from "./internal/sign-and-send.js";
import bs58 from "bs58";

const SUBSCRIPTION_ACCOUNT_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1;

function ixDiscriminator(name: string): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(`global:${name}`).digest(),
  ).subarray(0, 8);
}

const IX_INITIALIZE_SUBSCRIPTION = ixDiscriminator("initialize_subscription");
const IX_REQUEST_CANCEL = ixDiscriminator("request_cancel");
const IX_FINALIZE_CANCEL = ixDiscriminator("finalize_cancel");
const IX_SUBSCRIBER_CANCEL = ixDiscriminator("subscriber_cancel");

export class RecurClient {
  readonly connection: Connection;
  readonly programId: PublicKey;
  readonly usdcMint: PublicKey;
  readonly apiBaseUrl: string;
  private readonly http: HttpOptions;

  constructor(config: RecurConfig) {
    this.connection = new Connection(config.rpcUrl, "confirmed");
    this.programId = config.programId
      ? new PublicKey(config.programId)
      : DEFAULT_PROGRAM_ID;
    this.usdcMint = config.usdcMint
      ? new PublicKey(config.usdcMint)
      : USDC_MINT_DEVNET;
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, "");
    this.http = { baseUrl: this.apiBaseUrl, apiKey: config.apiKey };
  }

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
    let offset = 8;

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

  /** Derive the subscription PDA for given parameters. */
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

  /**
   * Build instructions to create a new subscription on-chain.
   *
   * Instructions:
   *   1. `createAssociatedTokenAccountIdempotent` — ensure subscriber ATA exists
   *   2. SPL Token `approve` — delegate subscription PDA to pull funds
   *   3. `initialize_subscription` — create the PDA on-chain
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

    const subscriberAta = getAssociatedTokenAddressSync(
      this.usdcMint,
      subscriberWallet,
    );

    const delegationAmount = options.delegationCycles
      ? BigInt(options.amount) * BigInt(options.delegationCycles)
      : BigInt("18446744073709551615"); // u64::MAX — revoked on cancel

    const approveIx = createApproveInstruction(
      subscriberAta,
      subscriptionPda,
      subscriberWallet,
      delegationAmount,
    );

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
        { pubkey: subscriberAta, isSigner: false, isWritable: false },
        { pubkey: this.usdcMint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixData,
    });

    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      subscriberWallet,
      subscriberAta,
      subscriberWallet,
      this.usdcMint,
    );

    return { subscriptionPda, instructions: [createAtaIx, approveIx, initIx], bump };
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

    const delegationAmount = options.delegationCycles
      ? BigInt(options.amount) * BigInt(options.delegationCycles)
      : BigInt("18446744073709551615"); // u64::MAX — revoked on cancel

    const approveIx = createApproveInstruction(
      subscriberAta,
      subscriptionPda,
      subscriberWallet,
      delegationAmount,
    );

    return { subscriptionPda, instructions: [approveIx] };
  }

  /**
   * Build the `request_cancel` instruction.
   * Authority (signer) must be subscriber or merchant; preserves prepaid time.
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
   * Permissionless — closes the PDA after the paid period elapses.
   */
  buildFinalizeCancelTransaction(options: CancelOptions): CancelTransaction {
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

  /**
   * Build the `subscriber_cancel` instruction.
   * Closes the PDA immediately; subscriber forfeits any prepaid time.
   */
  buildSubscriberCancelTransaction(
    subscriberWallet: PublicKey,
    options: { merchantWallet: string; planSeed: string },
  ): CancelTransaction {
    const merchantPubkey = new PublicKey(options.merchantWallet);
    const seedBuf = planSeedToBuffer(options.planSeed);

    const [subscriptionPda] = findSubscriptionPda(
      subscriberWallet,
      merchantPubkey,
      seedBuf,
      this.programId,
    );

    const ixData = Buffer.alloc(8);
    IX_SUBSCRIBER_CANCEL.copy(ixData, 0);

    const cancelIx = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: subscriptionPda, isSigner: false, isWritable: true },
        { pubkey: subscriberWallet, isSigner: true, isWritable: true },
        { pubkey: subscriberWallet, isSigner: false, isWritable: true },
        { pubkey: merchantPubkey, isSigner: false, isWritable: false },
      ],
      data: ixData,
    });

    return { instructions: [cancelIx] };
  }

  /** Fetch all active plans for an app (public). */
  async getPlans(appId: string): Promise<ApiResponse<PlanInfo[]>> {
    return request<PlanInfo[]>(this.http, "/plans", { query: { appId } });
  }

  /** Fetch a single plan by ID with merchant info (public). */
  async getPlan(appId: string, planId: string): Promise<ApiResponse<PlanInfo>> {
    return request<PlanInfo>(this.http, `/plans/${planId}`, { query: { appId } });
  }

  /** Create a new plan for an app. Requires API key. */
  async createPlan(options: CreatePlanOptions): Promise<ApiResponse<PlanInfo>> {
    return request<PlanInfo>(this.http, `/merchant/apps/${options.appId}/plans`, {
      method: "POST",
      body: {
        name: options.name,
        description: options.description,
        amountBaseUnits: options.amountBaseUnits,
        intervalSeconds: options.intervalSeconds,
      },
    });
  }

  /** List plans for a merchant's app. Requires API key. */
  async listPlans(appId: string): Promise<ApiResponse<PlanInfo[]>> {
    return request<PlanInfo[]>(this.http, `/merchant/apps/${appId}/plans`);
  }

  /** List subscriptions for a merchant's app. Requires API key. */
  async listSubscriptions(
    appId: string,
    options?: ListOptions,
  ): Promise<ApiResponse<SubscriptionInfo[]>> {
    return request<SubscriptionInfo[]>(
      this.http,
      `/merchant/apps/${appId}/subscriptions`,
      { query: { page: options?.page, limit: options?.limit } },
    );
  }

  /** Get payment history for a merchant's app. Requires API key. */
  async getPaymentHistory(
    appId: string,
    options?: ListOptions,
  ): Promise<ApiResponse<TransactionInfo[]>> {
    return request<TransactionInfo[]>(
      this.http,
      `/merchant/apps/${appId}/transactions`,
      { query: { page: options?.page, limit: options?.limit } },
    );
  }

  /**
   * Register a newly-created on-chain subscription with the Recur API.
   * Call this after the initialize_subscription transaction confirms.
   */
  async registerSubscription(
    options: RegisterSubscriptionOptions,
    authToken: string,
  ): Promise<ApiResponse<SubscriptionInfo>> {
    return request<SubscriptionInfo>(this.http, "/subscriber/subscriptions", {
      method: "POST",
      body: {
        appId: options.appId,
        planId: options.planId,
        subscriptionPda: options.subscriptionPda,
      },
      authToken,
    });
  }

  /** Fetch all subscriptions for the authenticated subscriber. */
  async getMySubscriptions(
    authToken: string,
    options?: ListOptions,
  ): Promise<ApiResponse<SubscriptionInfo[]>> {
    return request<SubscriptionInfo[]>(this.http, "/subscriber/subscriptions", {
      authToken,
      query: { page: options?.page, limit: options?.limit },
    });
  }

  /**
   * Fetch a single subscription by its on-chain PDA address.
   * Scans the subscriber's subscriptions for a matching PDA.
   */
  async getSubscription(
    subscriptionPda: string,
    authToken: string,
  ): Promise<ApiResponse<SubscriptionInfo | null>> {
    const res = await this.getMySubscriptions(authToken);
    if (!res.success || !res.data) {
      return { success: res.success, data: null, error: res.error };
    }
    const match = res.data.find((s) => s.subscriptionPda === subscriptionPda) ?? null;
    return { success: true, data: match, error: null };
  }

  // ---------- L3 high-level helpers ----------

  /**
   * Authenticate a wallet against the Recur API.
   * Performs nonce → signMessage → verify and returns a JWT.
   */
  async authenticate(wallet: RecurWallet): Promise<string> {
    const nonceRes = await request<{ nonce: string; message: string }>(
      this.http,
      "/auth/nonce",
      {
        method: "POST",
        body: { walletAddress: wallet.publicKey.toBase58() },
      },
    );
    const { message } = unwrap(nonceRes);
    const sigBytes = await wallet.signMessage(new TextEncoder().encode(message));

    const verifyRes = await request<{ token: string }>(this.http, "/auth/verify", {
      method: "POST",
      body: {
        walletAddress: wallet.publicKey.toBase58(),
        message,
        signature: bs58.encode(sigBytes),
      },
    });
    return unwrap(verifyRes).token;
  }

  /**
   * Subscribe a wallet to a plan: build → sign → confirm → register.
   * Caller supplies a JWT (from `authenticate()`).
   */
  async subscribe(
    wallet: RecurWallet,
    options: SubscribeOptions & { appId: string; planId: string },
    authToken: string,
  ): Promise<{ subscriptionPda: PublicKey; signature: string; subscription: SubscriptionInfo }> {
    // Ensure subscriber has enough USDC for at least the first cycle.
    const subscriberAta = getAssociatedTokenAddressSync(this.usdcMint, wallet.publicKey);
    const ataInfo = await this.connection
      .getTokenAccountBalance(subscriberAta)
      .catch(() => null);
    const balance = BigInt(ataInfo?.value?.amount ?? "0");
    const required = BigInt(options.amount);
    if (balance < required) {
      throw new InsufficientFundsError(
        `Insufficient USDC balance. Required: ${required.toString()} base units, available: ${balance.toString()}`,
        required,
      );
    }

    const { subscriptionPda, instructions } = this.buildSubscribeTransaction(
      wallet.publicKey,
      options,
    );
    const signature = await signAndSend(this.connection, wallet, instructions);
    const registered = await this.registerSubscription(
      {
        appId: options.appId,
        planId: options.planId,
        subscriptionPda: subscriptionPda.toBase58(),
      },
      authToken,
    );
    return { subscriptionPda, signature, subscription: unwrap(registered) };
  }

  /**
   * Cancel a subscription. Defaults to `request_cancel` (preserves prepaid time);
   * pass `mode: "instant"` for `subscriber_cancel` (forfeits prepaid time).
   */
  async cancel(
    wallet: RecurWallet,
    options: { merchantWallet: string; planSeed: string; mode?: "request" | "instant" },
  ): Promise<{ signature: string }> {
    let instructions;
    if (options.mode === "instant") {
      ({ instructions } = this.buildSubscriberCancelTransaction(wallet.publicKey, {
        merchantWallet: options.merchantWallet,
        planSeed: options.planSeed,
      }));
    } else {
      const { pda } = this.deriveSubscriptionPda(
        wallet.publicKey,
        new PublicKey(options.merchantWallet),
        options.planSeed,
      );
      ({ instructions } = this.buildCancelTransaction(wallet.publicKey, {
        subscriptionPda: pda.toBase58(),
        subscriberWallet: wallet.publicKey.toBase58(),
        merchantWallet: options.merchantWallet,
        planSeed: options.planSeed,
      }));
    }
    const signature = await signAndSend(this.connection, wallet, instructions);
    return { signature };
  }

  /**
   * Re-approve USDC delegation for an existing subscription PDA.
   * Used when the original delegation is exhausted/revoked.
   */
  async reapprove(
    wallet: RecurWallet,
    options: {
      merchantWallet: string;
      planSeed: string;
      amount: number;
      delegationCycles?: number;
    },
  ): Promise<{ signature: string }> {
    const { instructions } = this.buildReapproveTransaction(wallet.publicKey, options);
    const signature = await signAndSend(this.connection, wallet, instructions);
    return { signature };
  }
}
