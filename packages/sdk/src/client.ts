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

// Pre-computed Anchor instruction discriminators: sha256("global:<name>")[0..8]
// These are static and deterministic — no need for runtime crypto.
const IX_INITIALIZE_SUBSCRIPTION = new Uint8Array([208, 156, 144, 38, 56, 65, 152, 18]);
const IX_REQUEST_CANCEL = new Uint8Array([244, 78, 42, 227, 165, 174, 94, 167]);
const IX_FINALIZE_CANCEL = new Uint8Array([6, 200, 45, 123, 144, 47, 207, 102]);
const IX_SUBSCRIBER_CANCEL = new Uint8Array([184, 148, 59, 218, 111, 33, 121, 16]);

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

    const ixData = new Uint8Array(8 + 8 + 8 + 8);
    ixData.set(IX_INITIALIZE_SUBSCRIPTION, 0);
    const dv = new DataView(ixData.buffer);
    dv.setBigUint64(8, BigInt(options.amount), true);
    dv.setBigUint64(16, BigInt(options.intervalSeconds), true);
    ixData.set(seedArray, 24);

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
      data: Buffer.from(ixData),
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

    const ixData = new Uint8Array(8);
    ixData.set(IX_REQUEST_CANCEL, 0);

    const cancelIx = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: subscriptionPda, isSigner: false, isWritable: true },
        { pubkey: authorityWallet, isSigner: true, isWritable: false },
        { pubkey: subscriberPubkey, isSigner: false, isWritable: false },
        { pubkey: merchantPubkey, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(ixData),
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

    const ixData = new Uint8Array(8);
    ixData.set(IX_FINALIZE_CANCEL, 0);

    const finalizeIx = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: subscriptionPda, isSigner: false, isWritable: true },
        { pubkey: subscriberPubkey, isSigner: false, isWritable: true },
        { pubkey: merchantPubkey, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(ixData),
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

    const ixData = new Uint8Array(8);
    ixData.set(IX_SUBSCRIBER_CANCEL, 0);

    const cancelIx = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: subscriptionPda, isSigner: false, isWritable: true },
        { pubkey: subscriberWallet, isSigner: true, isWritable: true },
        { pubkey: subscriberWallet, isSigner: false, isWritable: true },
        { pubkey: merchantPubkey, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(ixData),
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
      query: { page: options?.page, limit: options?.limit, appId: options?.appId, status: options?.status },
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
    console.log("[RecurClient.subscribe]", {
      subscriber: wallet.publicKey.toBase58(),
      appId: options.appId,
      planId: options.planId,
      amount: options.amount,
      merchant: options.merchantWallet,
      planSeed: options.planSeed,
    });

    // Ensure subscriber has enough USDC for at least the first cycle.
    const subscriberAta = getAssociatedTokenAddressSync(this.usdcMint, wallet.publicKey);
    const ataInfo = await this.connection
      .getTokenAccountBalance(subscriberAta)
      .catch(() => null);
    const balance = BigInt(ataInfo?.value?.amount ?? "0");
    const required = BigInt(options.amount);
    console.log("[RecurClient.subscribe] USDC balance:", balance.toString(), "required:", required.toString());
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
    console.log("[RecurClient.subscribe] PDA:", subscriptionPda.toBase58(), "| IXs:", instructions.length);

    // Check if PDA already exists on-chain (previous TX succeeded but API registration failed)
    const existingPda = await this.connection.getAccountInfo(subscriptionPda);
    let signature: string;

    if (existingPda) {
      console.log("[RecurClient.subscribe] PDA already exists on-chain — skipping TX, going to API registration");
      signature = "already-subscribed";
    } else {
      try {
        signature = await signAndSend(this.connection, wallet, instructions);
        console.log("[RecurClient.subscribe] TX confirmed:", signature);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const cause = err instanceof Error && "cause" in err ? String((err as { cause: unknown }).cause) : "";
        if (msg.includes("already been processed") || cause.includes("already been processed")) {
          console.log("[RecurClient.subscribe] TX already processed, checking if PDA exists...");
          const info = await this.connection.getAccountInfo(subscriptionPda);
          if (info) {
            console.log("[RecurClient.subscribe] PDA exists — subscribe was already successful, registering with API");
            signature = "already-subscribed";
          } else {
            console.error("[RecurClient.subscribe] PDA not found despite 'already processed' error");
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    console.log("[RecurClient.subscribe] Registering with API...");
    const registered = await this.registerSubscription(
      {
        appId: options.appId,
        planId: options.planId,
        subscriptionPda: subscriptionPda.toBase58(),
      },
      authToken,
    );
    console.log("[RecurClient.subscribe] API registration result:", registered);
    return { subscriptionPda, signature, subscription: unwrap(registered) };
  }

  /**
   * Cancel a subscription. Defaults to `request_cancel` (preserves prepaid time);
   * pass `mode: "instant"` for `subscriber_cancel` (forfeits prepaid time).
   */
  async cancel(
    wallet: RecurWallet,
    options: { merchantWallet: string; planSeed: string; mode?: "request" | "instant" },
    authToken?: string,
  ): Promise<{ signature: string }> {
    let instructions;
    let subscriptionPda: PublicKey;

    const { pda } = this.deriveSubscriptionPda(
      wallet.publicKey,
      new PublicKey(options.merchantWallet),
      options.planSeed,
    );
    subscriptionPda = pda;

    console.log("[RecurClient.cancel]", {
      mode: options.mode ?? "request",
      subscriber: wallet.publicKey.toBase58(),
      merchant: options.merchantWallet,
      planSeed: options.planSeed,
      pda: pda.toBase58(),
    });

    if (options.mode === "instant") {
      ({ instructions } = this.buildSubscriberCancelTransaction(wallet.publicKey, {
        merchantWallet: options.merchantWallet,
        planSeed: options.planSeed,
      }));
    } else {
      ({ instructions } = this.buildCancelTransaction(wallet.publicKey, {
        subscriptionPda: pda.toBase58(),
        subscriberWallet: wallet.publicKey.toBase58(),
        merchantWallet: options.merchantWallet,
        planSeed: options.planSeed,
      }));
    }
    let signature: string;
    try {
      signature = await signAndSend(this.connection, wallet, instructions);
      console.log("[RecurClient.cancel] TX confirmed:", signature);
    } catch (err: unknown) {
      // If "already been processed", the cancel TX was sent before.
      // Check if PDA is gone — if so, treat as successful cancel.
      const msg = err instanceof Error ? err.message : String(err);
      const cause = err instanceof Error && "cause" in err ? String((err as { cause: unknown }).cause) : "";
      if (msg.includes("already been processed") || cause.includes("already been processed")) {
        console.log("[RecurClient.cancel] TX already processed, checking PDA on-chain...");
        const info = await this.connection.getAccountInfo(subscriptionPda);
        if (!info) {
          console.log("[RecurClient.cancel] PDA already closed — treating as success");
          signature = "already-cancelled";
        } else {
          console.error("[RecurClient.cancel] PDA still exists despite 'already processed' error");
          throw err;
        }
      } else {
        throw err;
      }
    }

    // Report cancellation to API so DB status updates immediately.
    // Non-blocking: if the API call fails, the keeper's forceCancel will handle it.
    if (authToken && signature !== "already-cancelled") {
      console.log("[RecurClient.cancel] Reporting to API cancel-confirm...");
      request(this.http, "/subscriber/subscriptions/cancel-confirm", {
        method: "POST",
        body: { subscriptionPda: subscriptionPda.toBase58(), txSignature: signature },
        authToken,
      }).then((res) => {
        console.log("[RecurClient.cancel] cancel-confirm response:", res);
      }).catch((err) => {
        console.warn("[RecurClient.cancel] cancel-confirm failed (keeper fallback will handle):", err);
      });
    }

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
