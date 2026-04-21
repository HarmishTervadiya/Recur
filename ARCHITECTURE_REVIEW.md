# Recur Protocol — Architecture Review, Schema Redesign & Implementation Plan

> **Date:** April 21, 2026
> **Audience:** Co-founders / Engineering team
> **Scope:** Full-stack evaluation — Smart Contract, API, Keeper, DB Schema, SDK, Dashboard

---

## Table of Contents

1. [Current Architecture Summary](#1-current-architecture-summary)
2. [What's Working Well](#2-whats-working-well)
3. [Critical Issues & Gaps](#3-critical-issues--gaps)
4. [Improved Database Schema](#4-improved-database-schema)
5. [Smart Contract Improvements](#5-smart-contract-improvements)
6. [API Layer Improvements](#6-api-layer-improvements)
7. [Keeper Layer Improvements](#7-keeper-layer-improvements)
8. [SDK Design & Implementation Plan](#8-sdk-design--implementation-plan)
9. [Merchant Dashboard Plan](#9-merchant-dashboard-plan)
10. [Platform Subscription (Super Admin) Plan](#10-platform-subscription-super-admin-plan)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Resolved Decisions & Open Questions](#12-resolved-decisions--open-questions)

**Appendices:**
- [Appendix A: Current vs. Proposed Entity Relationship](#appendix-a-current-vs-proposed-entity-relationship)
- [Appendix B: SDK NPM Package Structure](#appendix-b-sdk-npm-package-structure)
- [Appendix C: Webhook Event Catalog](#appendix-c-webhook-event-catalog)
- [Appendix D: Fee Calculation Reference](#appendix-d-fee-calculation-reference)
- [Appendix E: Auth Flow Deep Dive](#appendix-e-auth-flow-deep-dive)

---

## 1. Current Architecture Summary

### Layers

| Layer | Tech | Location |
|-------|------|----------|
| Smart Contract | Anchor 0.32 (Rust) | `contracts/programs/recur/src/lib.rs` |
| API Backend | Express.js + Prisma + PostgreSQL | `apps/api/` |
| Keeper (Cron) | Bun + node-cron | `apps/keeper/` |
| Landing Page | Next.js 14 + Tailwind | `apps/web/` |
| SDK | React (stub) | `packages/sdk/` |
| Shared Packages | `@recur/db`, `@recur/config`, `@recur/logger`, `@recur/types`, `@recur/solana-client` | `packages/` |

### Current Data Flow

```
Subscriber wallet
    │
    ▼
[SDK / Merchant App] ──► SPL approve(PDA, amount) + initialize_subscription
    │
    ▼
[On-chain PDA] ◄──── Keeper polls DB ───► process_payment (CPI transfer)
    │                                          │
    │                                    Keeper reports via HTTP
    │                                          │
    ▼                                          ▼
[DB: subscriptions]  ◄──────────────── [API: /keeper/* routes]
    │
    ▼
[Merchant Dashboard] reads from DB via /merchant/* routes
```

### Current Schema (7 tables)

```
AuthNonce  →  wallet nonce challenges
Merchant   →  App  →  Plan  →  Subscription  ←  Subscriber
                                     │
                                     ▼
                            MerchantTransaction
```

---

## 2. What's Working Well

1. **Two-phase cancellation** — `request_cancel` then `finalize_cancel` after the paid window is a solid pattern that protects both parties. This is genuinely better than most Web2 subscription billing.

2. **PDA-as-delegate** — Using the Subscription PDA as the SPL Token delegate authority is the correct Solana pattern. It avoids pre-authorization re-signing and works with hardware wallets.

3. **Treasury multisig with TTL** — The 2-of-2 propose/approve pattern with auto-incrementing nonce and expiry is well thought out. The `cleanup_expired_proposal` permissionless reclaim is a nice touch.

4. **On-chain/off-chain separation** — Keeping the smart contract minimal (state + payment logic) while using the DB for queryable metadata (plan names, descriptions, analytics) is the right approach.

5. **Keeper architecture** — Mutex guards per job, shared-secret auth to API, and the reporter pattern are solid. The separation of concerns (keeper does chain work, API does DB work) is clean.

6. **Test coverage** — 23 contract tests, 36 API unit tests, and an E2E smoke script is a strong foundation for a project at this stage.

7. **Auth** — Ed25519 wallet signature auth with nonce challenge/response is the correct Web3 pattern. Clean implementation.

---

## 3. Critical Issues & Gaps

### 3.1 Schema Issues

#### A. Missing Merchant profile fields
The `Merchant` model only has `walletAddress` and `name`. You mentioned needing email, mobile number, etc. These are absent.

#### B. Subscriber model is too thin
Only `walletAddress` and timestamps. No name, no notification preferences, no way to contact them about failed payments.

#### C. No platform subscription layer
You described merchants being able to purchase Recur's own platform plans for advanced features. This entire layer is missing — no `SuperAdmin`, no `PlatformPlan`, no `PlatformSubscription`, no `PlatformTransaction` tables.

#### D. One subscription per subscriber-merchant pair (on-chain constraint)
The PDA seeds are `[b"subscription", subscriber, merchant]`. This means a subscriber can only have ONE active subscription to a given merchant wallet. If a merchant has 3 plans, a subscriber can only subscribe to one at a time. This is a fundamental limitation.

#### E. No webhook/notification system for merchants
When payments succeed/fail, merchants have no way to get notified. No webhook URLs, no event log table.

#### F. No API key system for SDK auth
The SDK will need to authenticate requests on behalf of the merchant's app. Currently there's only wallet-based JWT auth — no API key system for server-to-server or client SDK calls.

#### G. No audit/event log
The `MerchantTransaction` table only records payment events. There's no general-purpose event log for subscription created, cancelled, failed, etc. This makes analytics and debugging harder.

#### H. Transaction table lacks `from`/`to` fields
You mentioned wanting `from` (subscriber wallet) and `to` (merchant wallet) on transactions. Currently, the transaction only links to `subscriptionId` and you have to join through Subscription → Plan → App → Merchant to get the merchant wallet, and Subscription → Subscriber for the subscriber wallet.

### 3.2 Smart Contract Issues

#### A. Single subscription per merchant-subscriber pair
As noted above, PDA seeds `[subscriber, merchant]` don't include any plan/app differentiator. To support multiple plans per subscriber-merchant, the seeds need a unique identifier (e.g., a `plan_seed` or nonce).

#### B. No on-chain plan reference
The subscription PDA stores `amount` and `interval` but has no reference to which plan or app it belongs to. This makes it impossible to validate on-chain that a subscription matches a specific plan.

#### C. Hardcoded fee constants
`PLATFORM_FLAT_FEE_BASE_UNITS` and `PLATFORM_BPS` are compile-time constants. To support tiered pricing for platform subscribers (e.g., lower fees for premium merchants), these would need to be configurable — either via a global config PDA or passed as parameters with validation.

#### D. Hardcoded keeper identity
The keeper is identified only as a `Signer` — there's no on-chain registry of authorized keepers. If you need to rotate or add keepers, you'd need to redeploy.

#### E. `initialize_subscription` requires merchant to sign
The current contract requires both subscriber AND merchant as `Signer` (merchant pays PDA rent). In an SDK/browser context, only the subscriber's wallet is connected — the merchant is not present. This completely blocks the SDK checkout flow. **Decision: Change to subscriber-pays-rent model (see Section 5.5).**

### 3.3 API Issues

#### A. No rate limiting
No rate limiting on any endpoint. The `/auth/nonce` endpoint is particularly vulnerable to abuse.

#### B. No pagination metadata
Transaction list endpoints return paginated data but don't return total count, page number, or has-next-page metadata.

#### C. No input sanitization beyond Zod
Zod handles type validation, but there's no sanitization for XSS in string fields (plan names, descriptions).

#### D. Auth token in JWT_SECRET defaults to "change-me-in-production"
This is a **critical** security risk if someone forgets to set it in production. Any attacker can forge valid JWTs. See [Appendix E.5, Issue 1](#issue-1-jwt_secret-defaults-to-known-value--critical) for the fix.

#### E. Missing auth layers (super admin, API keys, refresh tokens)
No super admin auth, no API key auth for SDK, no refresh token mechanism, no session revocation. The current auth works for merchant/subscriber wallet sign-in but is incomplete for the full system. See [Appendix E](#appendix-e-auth-flow-deep-dive) for the complete analysis and fixes.

### 3.4 Keeper Issues

#### A. No retry queue
Failed payments generate a `failed-${Date.now()}` fake signature and are reported once. There's no retry mechanism — if a payment fails due to a transient RPC error, it won't be retried until the next polling cycle at best, but the `cancelRequestedAt: null` filter might skip it if the state changed.

#### B. No dead letter handling
If a subscription repeatedly fails (e.g., insufficient funds for 3 cycles), there's no escalation — it just keeps trying forever or until force-cancelled.

#### C. Batch size hardcoded to 50
`take: 50` in `processPayments` means at scale, some subscriptions may consistently get delayed if there are >50 due at once.

### 3.5 SDK Issues

The SDK is currently a stub — a single `RecurButton` component that renders a plain `<button>`. It needs a complete redesign.

---

## 4. Improved Database Schema

Below is the complete redesigned Prisma schema. Changes are annotated with comments.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// AUTH
// ============================================================================

model AuthNonce {
  id            String    @id @default(cuid())
  walletAddress String    @map("wallet_address")
  nonce         String    @unique
  expiresAt     DateTime  @map("expires_at")
  usedAt        DateTime? @map("used_at")
  createdAt     DateTime  @default(now()) @map("created_at")

  @@index([walletAddress])
  @@index([expiresAt])
  @@map("auth_nonces")
}

/// Refresh tokens for session management. Short-lived access JWTs (15 min)
/// paired with long-lived refresh tokens (30 days) stored in DB for revocation.
model RefreshToken {
  id            String    @id @default(cuid())
  walletAddress String    @map("wallet_address")
  role          String                                            // "merchant" | "subscriber" | "super_admin"
  tokenHash     String    @unique @map("token_hash")              // SHA-256 hash of the actual token
  expiresAt     DateTime  @map("expires_at")
  revokedAt     DateTime? @map("revoked_at")
  createdAt     DateTime  @default(now()) @map("created_at")

  @@index([walletAddress])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

// ============================================================================
// MERCHANT (expanded)
// ============================================================================

model Merchant {
  id            String   @id @default(cuid())
  walletAddress String   @unique @map("wallet_address")
  name          String?
  email         String?  @unique                              // NEW
  phone         String?                                       // NEW
  avatarUrl     String?  @map("avatar_url")                   // NEW
  businessName  String?  @map("business_name")                // NEW
  website       String?                                       // NEW
  isVerified    Boolean  @default(false) @map("is_verified")  // NEW — for KYB
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  apps                 App[]
  apiKeys              ApiKey[]                               // NEW
  platformSubscription PlatformSubscription?                  // NEW
  webhookEndpoints     WebhookEndpoint[]                      // NEW

  @@map("merchants")
}

// ============================================================================
// API KEYS — for SDK & server-to-server auth
// ============================================================================

/// Each merchant app gets API keys for SDK integration.
/// Public key is sent client-side; secret key is used server-side.
model ApiKey {
  id          String    @id @default(cuid())
  merchantId  String    @map("merchant_id")
  appId       String    @map("app_id")
  label       String    @default("default")                   // e.g., "production", "staging"
  publicKey   String    @unique @map("public_key")            // pk_live_xxx — safe for client-side
  secretKey   String    @unique @map("secret_key")            // sk_live_xxx — hashed, server-only
  isActive    Boolean   @default(true) @map("is_active")
  lastUsedAt  DateTime? @map("last_used_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  app      App      @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@index([merchantId])
  @@index([appId])
  @@map("api_keys")
}

// ============================================================================
// WEBHOOK ENDPOINTS — merchant-configured notification URLs
// ============================================================================

model WebhookEndpoint {
  id          String   @id @default(cuid())
  merchantId  String   @map("merchant_id")
  appId       String   @map("app_id")
  url         String                                          // https://merchant.com/webhooks/recur
  secret      String                                          // HMAC signing secret
  events      String[]                                        // e.g., ["payment.success", "payment.failed", "subscription.cancelled"]
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  merchant        Merchant         @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  app             App              @relation(fields: [appId], references: [id], onDelete: Cascade)
  deliveryLogs    WebhookDelivery[]

  @@index([merchantId])
  @@index([appId])
  @@map("webhook_endpoints")
}

model WebhookDelivery {
  id           String   @id @default(cuid())
  endpointId   String   @map("endpoint_id")
  event        String                                         // "payment.success"
  payload      Json                                           // full event payload
  statusCode   Int?     @map("status_code")                   // HTTP response code
  attempts     Int      @default(0)
  lastAttempt  DateTime? @map("last_attempt")
  deliveredAt  DateTime? @map("delivered_at")
  createdAt    DateTime @default(now()) @map("created_at")

  endpoint WebhookEndpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)

  @@index([endpointId])
  @@index([createdAt])
  @@map("webhook_deliveries")
}

// ============================================================================
// APP (unchanged except new relations)
// ============================================================================

model App {
  id          String   @id @default(cuid())
  merchantId  String   @map("merchant_id")
  name        String
  description String?
  logoUrl     String?  @map("logo_url")                       // NEW
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  merchant          Merchant          @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  plans             Plan[]
  apiKeys           ApiKey[]                                  // NEW
  webhookEndpoints  WebhookEndpoint[]                         // NEW

  @@index([merchantId])
  @@map("apps")
}

// ============================================================================
// PLAN (added planSeed for multi-subscription support)
// ============================================================================

model Plan {
  id              String   @id @default(cuid())
  appId           String   @map("app_id")
  name            String
  description     String?
  /// Unique seed used in PDA derivation to allow multiple subscriptions
  /// per subscriber-merchant pair. Generated as a short hash or sequential ID.
  planSeed        String   @map("plan_seed")                  // NEW — used in on-chain PDA seeds
  amountBaseUnits BigInt   @map("amount_base_units")
  intervalSeconds Int      @map("interval_seconds")
  currency        String   @default("USDC")
  /// Max number of billing cycles (0 = unlimited / until cancelled).
  maxCycles       Int      @default(0) @map("max_cycles")     // NEW
  /// Optional trial period in seconds before first payment.
  trialSeconds    Int      @default(0) @map("trial_seconds")  // NEW
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  app           App            @relation(fields: [appId], references: [id], onDelete: Cascade)
  subscriptions Subscription[]

  @@unique([appId, planSeed])
  @@index([appId])
  @@map("plans")
}

// ============================================================================
// SUBSCRIBER (expanded)
// ============================================================================

model Subscriber {
  id            String   @id @default(cuid())
  walletAddress String   @unique @map("wallet_address")
  name          String?                                       // NEW
  email         String?                                       // NEW — for payment failure notifications
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  subscriptions Subscription[]

  @@map("subscribers")
}

// ============================================================================
// SUBSCRIPTION — DB mirror of on-chain PDA state (expanded)
// ============================================================================

enum SubscriptionStatus {
  active
  past_due        // payment failed but still within grace period
  cancelled       // cancel requested, pending finalization
  expired         // finalized / force-cancelled / max cycles reached
}

model Subscription {
  id                String             @id @default(cuid())
  planId            String             @map("plan_id")
  subscriberId      String             @map("subscriber_id")
  subscriptionPda   String             @unique @map("subscription_pda")
  status            SubscriptionStatus @default(active)       // NEW — replaces boolean isActive
  currentCycle      Int                @default(0) @map("current_cycle")  // NEW
  lastPaymentAt     DateTime?          @map("last_payment_at")
  nextPaymentDue    DateTime?          @map("next_payment_due")           // NEW — precomputed
  cancelRequestedAt DateTime?          @map("cancel_requested_at")
  cancelledAt       DateTime?          @map("cancelled_at")               // NEW — when finalized
  createdAt         DateTime           @default(now()) @map("created_at")
  updatedAt         DateTime           @updatedAt @map("updated_at")

  plan         Plan                  @relation(fields: [planId], references: [id])
  subscriber   Subscriber            @relation(fields: [subscriberId], references: [id])
  transactions MerchantTransaction[]
  events       SubscriptionEvent[]                             // NEW

  @@index([planId])
  @@index([subscriberId])
  @@index([status])
  @@index([nextPaymentDue])                                    // NEW — for keeper queries
  @@map("subscriptions")
}

// ============================================================================
// SUBSCRIPTION EVENT LOG — audit trail for all lifecycle events
// ============================================================================

enum EventType {
  subscription_created
  payment_success
  payment_failed
  cancel_requested
  cancel_finalized
  force_cancelled
  delegation_revoked
  cycle_completed
}

model SubscriptionEvent {
  id             String    @id @default(cuid())
  subscriptionId String    @map("subscription_id")
  event          EventType
  txSignature    String?   @map("tx_signature")               // Solana tx sig if applicable
  metadata       Json?                                        // flexible extra data
  createdAt      DateTime  @default(now()) @map("created_at")

  subscription Subscription @relation(fields: [subscriptionId], references: [id])

  @@index([subscriptionId])
  @@index([event])
  @@index([createdAt])
  @@map("subscription_events")
}

// ============================================================================
// MERCHANT TRANSACTION (expanded with from/to)
// ============================================================================

enum MerchantTransactionStatus {
  success
  failed
}

model MerchantTransaction {
  id               String                    @id @default(cuid())
  subscriptionId   String                    @map("subscription_id")
  fromWallet       String                    @map("from_wallet")    // NEW — subscriber wallet
  toWallet         String                    @map("to_wallet")      // NEW — merchant wallet
  amountGross      BigInt                    @map("amount_gross")
  platformFee      BigInt                    @map("platform_fee")
  amountNet        BigInt                    @map("amount_net")
  txSignature      String                    @unique @map("tx_signature")
  status           MerchantTransactionStatus
  cycleNumber      Int                       @map("cycle_number")   // NEW
  createdAt        DateTime                  @default(now()) @map("created_at")

  subscription Subscription @relation(fields: [subscriptionId], references: [id])

  @@index([subscriptionId])
  @@index([fromWallet])                                              // NEW
  @@index([toWallet])                                                // NEW
  @@index([createdAt])                                               // NEW
  @@map("merchant_transactions")
}

// ============================================================================
// PLATFORM LAYER — Recur's own subscription billing for merchants
// ============================================================================

/// Super admins who manage the Recur platform itself.
model SuperAdmin {
  id            String   @id @default(cuid())
  walletAddress String   @unique @map("wallet_address")
  email         String   @unique
  name          String
  role          String   @default("admin")                    // "admin" | "super_admin"
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("super_admins")
}

/// Platform tier plans that merchants can subscribe to (Free, Pro, Enterprise).
model PlatformPlan {
  id              String   @id @default(cuid())
  name            String   @unique                            // "free", "pro", "enterprise"
  description     String?
  amountBaseUnits BigInt   @map("amount_base_units")          // 0 for free tier
  intervalSeconds Int      @map("interval_seconds")           // 2592000 = 30 days
  currency        String   @default("USDC")
  /// Feature flags / limits for this tier
  features        Json                                        // e.g., { "maxApps": 3, "maxPlans": 5, "webhooks": false, "analytics": "basic" }
  /// Fee overrides for this tier
  platformFeeBps  Int      @default(25) @map("platform_fee_bps")     // basis points
  platformFeeFlat BigInt   @default(50000) @map("platform_fee_flat") // base units
  isActive        Boolean  @default(true) @map("is_active")
  sortOrder       Int      @default(0) @map("sort_order")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  subscriptions PlatformSubscription[]

  @@map("platform_plans")
}

/// A merchant's subscription to a Recur platform plan.
model PlatformSubscription {
  id            String   @id @default(cuid())
  merchantId    String   @unique @map("merchant_id")          // one platform sub per merchant
  planId        String   @map("plan_id")
  status        SubscriptionStatus @default(active)
  currentPeriodStart DateTime @map("current_period_start")
  currentPeriodEnd   DateTime @map("current_period_end")
  cancelledAt   DateTime? @map("cancelled_at")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  merchant     Merchant                @relation(fields: [merchantId], references: [id])
  plan         PlatformPlan            @relation(fields: [planId], references: [id])
  transactions PlatformTransaction[]

  @@index([planId])
  @@map("platform_subscriptions")
}

/// Transactions for platform plan payments (separate from merchant app transactions).
model PlatformTransaction {
  id                     String   @id @default(cuid())
  platformSubscriptionId String   @map("platform_subscription_id")
  fromWallet             String   @map("from_wallet")         // merchant wallet
  toWallet               String   @map("to_wallet")           // recur treasury
  amount                 BigInt
  txSignature            String   @unique @map("tx_signature")
  status                 MerchantTransactionStatus
  createdAt              DateTime @default(now()) @map("created_at")

  platformSubscription PlatformSubscription @relation(fields: [platformSubscriptionId], references: [id])

  @@index([platformSubscriptionId])
  @@map("platform_transactions")
}

// ============================================================================
// GLOBAL CONFIG — managed by super admins
// ============================================================================

/// Key-value store for global platform configuration.
model GlobalConfig {
  key       String   @id
  value     Json
  updatedBy String?  @map("updated_by")                       // super admin ID
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("global_config")
}
```

### Key Changes Summary

| Change | Reason |
|--------|--------|
| Added `RefreshToken` table | Enables short-lived access JWTs (15 min) + revocable refresh tokens (30 days). See Appendix E. |
| Expanded `Merchant` fields (email, phone, business, avatar, website, isVerified) | You need real merchant profiles for the dashboard |
| Added `ApiKey` table | SDK needs public/secret key pairs for auth |
| Added `WebhookEndpoint` + `WebhookDelivery` | Merchants need event notifications |
| Added `planSeed` to `Plan` | Enables multiple subs per subscriber-merchant pair on-chain |
| `SubscriptionStatus` enum replaces `isActive` boolean | More granular status tracking (active, past_due, cancelled, expired) |
| Added `nextPaymentDue` to `Subscription` | Precomputed field makes keeper queries fast (`WHERE nextPaymentDue <= NOW()`) |
| Added `currentCycle` and `cycleNumber` | Enables max-cycle billing and per-cycle tracking |
| Added `SubscriptionEvent` table | Full audit trail / event log for all lifecycle events |
| Added `fromWallet` / `toWallet` to `MerchantTransaction` | Direct access to both wallets without deep joins |
| Expanded `Subscriber` with name and email | Enables notifications for failed payments |
| Added `SuperAdmin` table | Separate from merchants — manages the platform |
| Added `PlatformPlan` with features JSON and fee overrides | Tiered pricing for merchants |
| Added `PlatformSubscription` and `PlatformTransaction` | Separate billing for platform plans |
| Added `GlobalConfig` | Key-value store for platform settings managed by super admins |

---

## 5. Smart Contract Improvements

### 5.1 Multi-Subscription PDA Seeds

**Current:** `seeds = [b"subscription", subscriber, merchant]`
**Problem:** Only one subscription per subscriber-merchant pair.

**Proposed:** `seeds = [b"subscription", subscriber, merchant, plan_seed]`

Where `plan_seed` is a fixed-length identifier (e.g., 8-byte hash of the plan ID). This allows a subscriber to hold multiple subscriptions to different plans from the same merchant.

```rust
#[derive(Accounts)]
#[instruction(amount: u64, interval: u64, plan_seed: [u8; 8])]
pub struct InitializeSubscription<'info> {
    #[account(
        init,
        payer = subscriber,                          // CHANGED — subscriber pays ~0.002 SOL rent
        space = 8 + Subscription::INIT_SPACE,
        seeds = [
            b"subscription",
            subscriber.key().as_ref(),
            merchant.key().as_ref(),
            plan_seed.as_ref(),                      // NEW — 8-byte plan identifier
        ],
        bump
    )]
    pub subscription: Account<'info, Subscription>,

    /// Subscriber signs to prove consent AND pays PDA rent.
    #[account(mut)]
    pub subscriber: Signer<'info>,

    /// Merchant does NOT sign. Passed as AccountInfo for PDA derivation only.
    /// CHECK: No signature required. Used only in PDA seed derivation.
    pub merchant: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
```

> **Why subscriber pays rent instead of merchant:** In the SDK flow, only the
> subscriber's wallet is connected in the browser. The merchant is not present to
> sign. By making the subscriber the payer, the entire subscription can be created
> in a single wallet popup with no server-side co-signing. The rent cost is
> ~0.002 SOL (~$0.30), which is negligible. When the subscription is finalized/
> cancelled, the rent is refunded to the subscriber (change `close = merchant`
> to `close = subscriber` in `FinalizeCancel` and `ForceCancel`).

### 5.2 On-chain Config PDA (for dynamic fees)

Instead of hardcoded fee constants, create a `PlatformConfig` PDA:

```rust
#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    pub authority: Pubkey,          // super admin or multisig
    pub flat_fee: u64,              // default 50_000
    pub bps_fee: u64,               // default 25
    pub min_plan_amount: u64,       // default 1_000_000
    pub keeper: Pubkey,             // registered keeper pubkey
    pub bump: u8,
}
```

This allows fee adjustments without redeploying the program, and lets you register/rotate keepers.

### 5.3 Keeper Registry

Add a `keeper` field to `PlatformConfig` (or a separate `KeeperRegistry` PDA) so that keeper identity is validated on-chain rather than just by signer check.

### 5.4 Plan Reference in Subscription

Add a `plan_seed` field to the on-chain `Subscription` struct so the off-chain system can definitively link on-chain state to a specific plan:

```rust
pub struct Subscription {
    pub subscriber: Pubkey,
    pub merchant: Pubkey,
    pub plan_seed: [u8; 8],         // NEW
    pub amount: u64,
    pub interval: u64,
    pub last_payment_timestamp: u64,
    pub created_at: u64,
    pub cancel_requested_at: u64,
    pub bump: u8,
}
```

### 5.5 Subscriber-Pays-Rent Model (Decided)

**Problem:** The current `initialize_subscription` requires the merchant to sign and pay PDA rent. In the SDK flow, only the subscriber's wallet is connected in the browser — the merchant is never present.

**Solution:** Change the contract so the **subscriber pays rent** and the merchant is a plain `AccountInfo` (no signature required).

| Aspect | Current (v1) | New (v2) |
|--------|-------------|----------|
| `payer` | `merchant` (Signer) | `subscriber` (Signer) |
| `merchant` | `Signer` | `AccountInfo` (CHECK) |
| Rent cost | ~0.002 SOL paid by merchant | ~0.002 SOL paid by subscriber |
| Rent refund on cancel | → merchant | → subscriber |
| SDK flow | Impossible without co-signing server | Single wallet popup, subscriber signs alone |

**Additional contract changes required:**
- `FinalizeCancel`: change `close = merchant` → `close = subscriber` (rent refund goes back to subscriber)
- `ForceCancel`: change `close = merchant` → `close = subscriber`
- All `has_one = merchant` constraints remain valid (merchant is still stored in the PDA, just doesn't sign creation)

**Impact on existing instructions:**
- `process_payment`: No change — merchant is already just an `AccountInfo` here
- `request_cancel`: No change — authority can be subscriber OR merchant, checked in logic
- `finalize_cancel` / `force_cancel`: Only the `close` target changes

---

## 6. API Layer Improvements

### 6.1 New Routes Needed

| Route | Auth | Purpose |
|-------|------|---------|
| **API Key Management** | | |
| `POST /merchant/apps/:appId/api-keys` | merchant JWT | Generate API key pair |
| `GET /merchant/apps/:appId/api-keys` | merchant JWT | List API keys |
| `DELETE /merchant/apps/:appId/api-keys/:keyId` | merchant JWT | Revoke API key |
| **Webhook Management** | | |
| `POST /merchant/apps/:appId/webhooks` | merchant JWT | Register webhook endpoint |
| `GET /merchant/apps/:appId/webhooks` | merchant JWT | List webhooks |
| `PATCH /merchant/apps/:appId/webhooks/:id` | merchant JWT | Update webhook |
| `DELETE /merchant/apps/:appId/webhooks/:id` | merchant JWT | Remove webhook |
| `GET /merchant/apps/:appId/webhooks/:id/deliveries` | merchant JWT | View delivery logs |
| **SDK / Public API** | | |
| `GET /sdk/plans/:planId` | API key (public) | Get plan details for checkout (amount, interval, merchantWallet, planSeed) |
| `POST /sdk/subscriptions/register` | API key (public) | SDK reports on-chain subscription after tx confirms. API verifies tx on-chain, fetches PDA, validates against plan, upserts subscriber, creates subscription + event, dispatches webhook. |
| `GET /sdk/subscriptions/:pda/status` | API key (public) | Check subscription status (active, past_due, cancelled, expired) |
| **Platform Subscription** | | |
| `GET /platform/plans` | none | List platform plans |
| `POST /platform/subscribe` | merchant JWT | Subscribe to platform plan |
| `GET /platform/subscription` | merchant JWT | Get current platform subscription |
| `POST /platform/cancel` | merchant JWT | Cancel platform subscription |
| **Super Admin** | | |
| `GET /admin/merchants` | super admin JWT | List all merchants |
| `GET /admin/analytics` | super admin JWT | Platform-wide analytics |
| `PATCH /admin/config/:key` | super admin JWT | Update global config |
| `GET /admin/config` | super admin JWT | Get all config |
| **Analytics** | | |
| `GET /merchant/apps/:appId/analytics` | merchant JWT | Revenue, churn, MRR, subscriber count |
| `GET /merchant/analytics` | merchant JWT | Cross-app aggregate analytics |

### 6.2 Auth Middleware Changes

Add a new `authenticateApiKey` middleware:

```typescript
// For SDK requests — validates the public API key
export function authenticateApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  // Look up key, resolve to merchant + app context
}

// For super admin routes
export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== "super_admin") {
    fail(res, ErrorCode.FORBIDDEN, "Super admin access required");
    return;
  }
  next();
}
```

### 6.3 Rate Limiting

Add `express-rate-limit`:

```typescript
import rateLimit from "express-rate-limit";

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }); // 20 per 15 min
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 });       // 100 per min

app.use("/auth", authLimiter, authRouter);
app.use("/sdk", apiLimiter, sdkRouter);
```

### 6.4 Pagination Metadata

All list endpoints should return:

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8,
    "hasNext": true
  }
}
```

### 6.5 Webhook Dispatch Service

Create a new module `apps/api/src/services/webhookDispatcher.ts`:

```typescript
// Called by keeper routes after recording events
async function dispatchWebhook(appId: string, event: string, payload: object) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { appId, isActive: true, events: { has: event } },
  });
  for (const ep of endpoints) {
    // Sign payload with HMAC, POST to ep.url, record in WebhookDelivery
    // Retry with exponential backoff (3 attempts)
  }
}
```

---

## 7. Keeper Layer Improvements

### 7.1 Query Optimization

Replace the current query (fetches all active subs, then filters in code) with a targeted query:

```typescript
// BEFORE:
const subs = await prisma.subscription.findMany({
  where: { isActive: true, cancelRequestedAt: null },
  take: 50,
});
// Then check lastPaymentAt + interval in JS

// AFTER:
const subs = await prisma.subscription.findMany({
  where: {
    status: "active",
    nextPaymentDue: { lte: new Date() },
  },
  orderBy: { nextPaymentDue: "asc" },
  take: 100,
});
```

### 7.2 Retry Queue with Backoff

Add a `retryCount` and `nextRetryAt` to the subscription or a separate job queue table:

```prisma
model PaymentRetry {
  id             String   @id @default(cuid())
  subscriptionId String   @map("subscription_id")
  attempts       Int      @default(0)
  nextAttemptAt  DateTime @map("next_attempt_at")
  lastError      String?  @map("last_error")
  createdAt      DateTime @default(now()) @map("created_at")

  @@index([nextAttemptAt])
  @@map("payment_retries")
}
```

Backoff schedule: 1h, 6h, 24h, 72h. After 4 failures, mark subscription as `past_due` and notify merchant via webhook.

### 7.3 Grace Period and Dunning

After a failed payment:
1. Cycle 1 fail: Retry in 1 hour. Status remains `active`.
2. Cycle 2 fail: Retry in 6 hours. Status → `past_due`.
3. Cycle 3 fail: Retry in 24 hours. Send subscriber notification (if email available).
4. Cycle 4 fail: Mark as `expired`. Trigger `force_cancel` on-chain.

### 7.4 Webhook Trigger Integration

After each event (payment success, failure, cancel), call the webhook dispatcher:

```typescript
// In processPayments, after reportPaymentResult:
await dispatchWebhook(sub.plan.appId, "payment.success", {
  subscriptionId: sub.id,
  txSignature: sig,
  amount: gross.toString(),
  // ...
});
```

### 7.5 Monitoring & Alerting

Add health check endpoint for the keeper:
- Track last successful run timestamp per job
- Expose `/keeper/health` that returns job statuses
- Alert if any job hasn't run in 2x its expected interval

### 7.6 Chain Scan Safety Net (Missed Subscription Recovery)

**Problem:** The primary flow relies on the SDK calling `POST /sdk/subscriptions/register` after on-chain confirmation. If the user closes their browser, their network drops, or the API is temporarily down, the subscription exists on-chain but NOT in the DB. The keeper will never process payments for it.

**Solution:** A periodic `getProgramAccounts` scan in the keeper that diffs on-chain state against the DB and registers any missing subscriptions.

```typescript
// New job: apps/keeper/src/jobs/syncSubscriptions.ts
// Runs every 5 minutes via cron

export async function syncSubscriptions(): Promise<void> {
  // 1. Fetch ALL subscription PDAs owned by our program
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: 8 + SUBSCRIPTION_ACCOUNT_SIZE },  // discriminator + struct size
    ],
  });

  // 2. For each on-chain PDA, check if it exists in DB
  for (const { pubkey, account } of accounts) {
    const pdaBase58 = pubkey.toBase58();
    const exists = await prisma.subscription.findUnique({
      where: { subscriptionPda: pdaBase58 },
    });

    if (exists) continue;  // already registered

    // 3. Decode the on-chain data
    const sub = decodeSubscription(account.data);

    // 4. Try to match to a plan using planSeed
    //    Look up: plan WHERE planSeed = sub.planSeed
    //    AND app.merchant.walletAddress = sub.merchant
    const plan = await prisma.plan.findFirst({
      where: {
        planSeed: Buffer.from(sub.planSeed).toString("hex"),
        app: { merchant: { walletAddress: sub.merchant.toBase58() } },
      },
    });

    if (!plan) {
      logger.warn({ pda: pdaBase58 }, "On-chain sub with no matching plan — skipping");
      continue;
    }

    // 5. Register the missing subscription
    const subscriber = await prisma.subscriber.upsert({
      where: { walletAddress: sub.subscriber.toBase58() },
      update: {},
      create: { walletAddress: sub.subscriber.toBase58() },
    });

    await prisma.subscription.create({
      data: {
        subscriptionPda: pdaBase58,
        planId: plan.id,
        subscriberId: subscriber.id,
        status: sub.cancelRequestedAt > 0n ? "cancelled" : "active",
        lastPaymentAt: sub.lastPaymentTimestamp > 0n
          ? new Date(Number(sub.lastPaymentTimestamp) * 1000)
          : null,
        nextPaymentDue: new Date(
          (Number(sub.lastPaymentTimestamp) + Number(sub.interval)) * 1000
        ),
      },
    });

    logger.info({ pda: pdaBase58, plan: plan.id }, "Recovered missing subscription from chain");
  }
}
```

**Registration in keeper entry point:**

```typescript
// apps/keeper/src/index.ts — add alongside existing jobs
cron.schedule("*/5 * * * *", async () => {
  if (syncRunning) return;
  syncRunning = true;
  try {
    await syncSubscriptions();
  } catch (err) {
    logger.error({ err }, "syncSubscriptions job crashed");
  } finally {
    syncRunning = false;
  }
});
```

**Scale considerations:**
- `getProgramAccounts` returns ALL subscription PDAs. At 10,000 subscriptions this is ~1.5 MB of data — acceptable.
- At 100,000+ subscriptions, switch to **Helius webhooks** or add a `memcmp` filter on the merchant pubkey to scan per-merchant.
- The DB lookup per PDA is cheap due to the `subscriptionPda` unique index.
- This job is idempotent — running it multiple times is safe.

---

## 8. SDK Design & Implementation Plan

### 8.1 Architecture

The SDK should be a JavaScript/TypeScript package that merchants install:

```
@recur/sdk
├── core/            — Framework-agnostic subscription logic
│   ├── RecurClient.ts      — Main client class
│   ├── transactions.ts     — Solana transaction builders
│   ├── types.ts            — TypeScript types
│   └── api.ts              — HTTP client for Recur API
├── react/           — React components & hooks
│   ├── RecurProvider.tsx   — Context provider
│   ├── useSubscribe.ts     — Hook for subscription flow
│   ├── useSubscription.ts  — Hook for checking status
│   ├── SubscribeButton.tsx — Pre-built checkout button
│   └── CheckoutModal.tsx   — Pre-built checkout modal
└── index.ts         — Main export
```

### 8.2 SDK ↔ Server Subscription Flow (Complete)

This is the most critical flow in the system. The smart contract cannot call HTTP, so the **SDK is responsible for telling the server** that a subscription was created on-chain. A keeper background scan acts as a safety net.

#### Step-by-Step Flow

```
SUBSCRIBER'S BROWSER                YOUR API SERVER                SOLANA CHAIN
        │                                  │                            │
   ┌────┴────┐                             │                            │
   │ Merchant│                             │                            │
   │  App +  │                             │                            │
   │  SDK    │                             │                            │
   └────┬────┘                             │                            │
        │                                  │                            │
   1. SDK: GET /sdk/plans/:planId          │                            │
   (X-Api-Key: pk_live_xxx)                │                            │
        │─────────────────────────────────>│                            │
        │                                  │  Validates API key,        │
        │                                  │  resolves app + merchant   │
        │    { amount, interval,           │                            │
        │      merchantWallet, planSeed }  │                            │
        │<─────────────────────────────────│                            │
        │                                  │                            │
   2. SDK computes PDA locally:            │                            │
      PDA = findProgramAddress(            │                            │
        ["subscription",                   │                            │
         subscriberWallet,                 │                            │
         merchantWallet,                   │                            │
         planSeed],                        │                            │
        PROGRAM_ID                         │                            │
      )                                    │                            │
        │                                  │                            │
   3. SDK builds transaction:              │                            │
      ix[0]: createAssociatedTokenAccount  │                            │
             (if subscriber ATA absent)    │                            │
      ix[1]: spl_token::approve(           │                            │
               source = subscriber_ata,    │                            │
               delegate = PDA,             │                            │
               amount = plan_amount)       │                            │
      ix[2]: recur::initialize_subscription│                            │
               (amount, interval,          │                            │
                plan_seed)                 │                            │
        │                                  │                            │
   4. Wallet popup → subscriber signs      │                            │
      (ONLY subscriber signs — merchant    │                            │
       is not a Signer, just AccountInfo)  │                            │
        │                                  │                            │
   5. SDK sends tx to Solana               │                            │
        │──────────────────────────────────────────────────────────────>│
        │                                  │                            │
   6. SDK waits for 'confirmed' status     │                            │
        │<─────────────────────────────────────────────────────────────│
        │   txSignature                    │                            │
        │                                  │                            │
   7. SDK: POST /sdk/subscriptions/register│                            │
      {                                    │                            │
        planId: "clxyz...",                │                            │
        subscriptionPda: "base58...",      │                            │
        subscriberWallet: "base58...",     │                            │
        txSignature: "base58..."           │                            │
      }                                    │                            │
      (X-Api-Key: pk_live_xxx)             │                            │
        │─────────────────────────────────>│                            │
        │                                  │                            │
        │                           8. API VERIFICATION:                │
        │                              a. Validate API key → resolve    │
        │                                 merchant + app                │
        │                              b. Verify txSignature on-chain   │
        │                                 (getTransaction, check it's   │
        │                                  confirmed and interacts with │
        │                                  our program)                 │
        │                                  │───────────────────────────>│
        │                                  │      tx data               │
        │                                  │<──────────────────────────│
        │                              c. Fetch PDA account on-chain    │
        │                                  │───────────────────────────>│
        │                                  │      PDA data              │
        │                                  │<──────────────────────────│
        │                              d. Validate PDA data matches     │
        │                                 plan (amount, interval,       │
        │                                 planSeed, merchant)           │
        │                              e. Upsert Subscriber in DB       │
        │                              f. Create Subscription row       │
        │                                 (status: active,              │
        │                                  nextPaymentDue = now +       │
        │                                  interval)                    │
        │                              g. Log SubscriptionEvent         │
        │                                 (subscription_created)        │
        │                              h. Dispatch webhook to merchant  │
        │                                 (subscription.created)        │
        │                                  │                            │
        │   { subscriptionId,              │                            │
        │     status: "active" }           │                            │
        │<─────────────────────────────────│                            │
        │                                  │                            │
   9. SDK fires onSuccess(result)          │                            │
      callback to merchant's app           │                            │
        │                                  │                            │
```

#### Failure & Recovery Paths

| Failure Point | What Happens | Recovery |
|---------------|-------------|----------|
| **Step 5 fails** (tx rejected by Solana) | No on-chain state created. SDK fires `onError`. | User retries. Nothing to clean up. |
| **Step 6 times out** (network issue) | Subscription MAY exist on-chain but SDK doesn't know. | Keeper chain scan (every 5 min) discovers the PDA and registers it in DB. SDK can also retry the register call with the same txSignature (idempotent via PDA unique constraint). |
| **Step 7 fails** (browser closes / network drop after tx confirms) | Subscription EXISTS on-chain but is NOT in DB. | **Primary recovery:** User reopens the app, SDK detects existing PDA on-chain, calls register again. **Backup recovery:** Keeper `syncSubscriptions` job (every 5 min) discovers the orphaned PDA via `getProgramAccounts` and registers it. |
| **Step 8 fails** (API server down) | Same as step 7 — on-chain but not in DB. | SDK retries with exponential backoff (3 attempts). If all fail, keeper chain scan recovers within 5 min. |
| **Step 8d fails** (PDA data doesn't match plan) | API rejects the registration. | This indicates a tampered or mismatched request. The on-chain subscription exists but won't be tracked. The keeper chain scan will also fail to match it to a plan and log a warning. Manual investigation needed. |

#### Why This Two-Layer Approach Works

1. **Speed:** In the happy path (99%+ of cases), the subscription is registered in the DB within seconds of on-chain confirmation — the SDK does it immediately.

2. **Reliability:** The keeper chain scan is a safety net that catches the remaining <1% of cases where the SDK's POST fails. A 5-minute delay for recovery is acceptable since the first payment isn't due until the billing interval elapses (typically 30 days).

3. **No third-party dependency:** Unlike Helius/Shyft webhooks, `getProgramAccounts` uses your existing RPC connection. No additional service to manage.

4. **Idempotent:** Both the SDK registration and the keeper scan use `subscriptionPda` as the unique key. Duplicate registration attempts are harmless (upsert or unique constraint catch).

### 8.3 Core Client

```typescript
class RecurClient {
  constructor(config: {
    apiKey: string;          // pk_live_xxx (public key)
    cluster?: Cluster;       // "mainnet-beta" | "devnet"
    rpcUrl?: string;
  });

  // Fetch plan details from Recur API
  async getPlan(planId: string): Promise<Plan>;

  // Full subscription flow (see Section 8.2 for detailed diagram):
  // 1. Fetch plan details from API (amount, interval, merchantWallet, planSeed)
  // 2. Compute subscription PDA locally
  // 3. Build tx: (optional ATA create) + SPL approve + initialize_subscription
  // 4. Send to wallet for signing (ONLY subscriber signs)
  // 5. Wait for on-chain confirmation
  // 6. Register subscription with API (POST /sdk/subscriptions/register)
  // 7. API verifies on-chain, creates DB records, dispatches webhook
  //
  // `merchantWallet` is used for PDA derivation only — merchant does NOT sign.
  async subscribe(params: {
    wallet: WalletAdapter;       // subscriber's connected wallet
    planId: string;              // plan to subscribe to
  }): Promise<{
    subscriptionPda: string;
    txSignature: string;
    subscriptionId: string;      // DB ID returned by API
  }>;

  // Check on-chain subscription status
  async getSubscriptionStatus(pda: string): Promise<SubscriptionStatus>;

  // Build cancel request transaction (subscriber signs)
  async requestCancel(params: {
    wallet: WalletAdapter;
    subscriptionPda: string;
  }): Promise<string>; // tx signature
}
```

> **Note:** The `subscribe()` method handles the entire flow end-to-end. The
> merchant's wallet address is fetched from the API (resolved via the API key),
> not passed by the caller. This prevents mismatched merchant addresses and
> simplifies the integration — the merchant just provides their API key and plan ID.

### 8.4 React Components

```tsx
// Provider wraps the app — API key resolves the merchant context
<RecurProvider apiKey="pk_live_xxx" cluster="devnet">
  <App />
</RecurProvider>

// Simple checkout button — only needs planId (merchant resolved from API key)
<SubscribeButton
  planId="clxyz..."
  onSuccess={(result) => console.log("Subscribed!", result.subscriptionId)}
  onError={(err) => console.error(err)}
  theme="dark"
/>

// Or use the hook for custom UI
function CustomCheckout() {
  const { subscribe, loading, error } = useSubscribe();
  const { status } = useSubscription(subscriptionPda);

  return (
    <button onClick={() => subscribe({ planId: "..." })}>
      {loading ? "Processing..." : "Subscribe $9.99/mo"}
    </button>
  );
}
```

### 8.5 Integration Flow (Merchant Perspective)

```
1. Merchant creates app + plan in Recur dashboard
2. Merchant generates API key for the app
3. Merchant installs @recur/sdk
4. Merchant adds <RecurProvider> with API key
5. Merchant adds <SubscribeButton planId="..."> or uses useSubscribe() hook
6. Subscriber clicks button → single wallet popup → approve + initialize_subscription
   (only subscriber signs — merchant wallet is resolved from API key)
7. SDK registers subscription with Recur API (on-chain verification)
8. Keeper automatically processes recurring payments on schedule
9. Merchant receives webhooks for payment events
10. Merchant views analytics in Recur dashboard
```

### 8.6 Vanilla JS Support

For merchants not using React, provide a vanilla JS interface:

```javascript
import { RecurClient } from "@recur/sdk";

const recur = new RecurClient({ apiKey: "pk_live_xxx" });

// Render a checkout button into a DOM element
recur.mountButton("#subscribe-button", {
  planId: "clxyz...",
  merchantWallet: "Abc123...",
  onSuccess: (result) => { /* handle success */ },
});
```

---

## 9. Merchant Dashboard Plan

### 9.1 Pages & Features

| Page | Features |
|------|----------|
| **Onboarding** | Connect wallet, set business name/email, create first app |
| **Dashboard Home** | MRR, active subscribers, revenue chart, recent events |
| **Apps** | List apps, create/edit/archive apps |
| **Plans** | List plans per app, create/edit/deactivate plans |
| **Subscribers** | List subscribers per app/plan, view subscription details, payment history |
| **Transactions** | Paginated transaction list with filters (date, status, plan, app) |
| **Analytics** | Revenue over time, churn rate, ARPU, LTV, subscriber growth, plan breakdown |
| **Webhooks** | Configure webhook endpoints, view delivery logs, test webhook |
| **API Keys** | Generate/revoke API keys, copy to clipboard |
| **Settings** | Profile (name, email, phone), platform subscription, billing history |
| **Integration Guide** | SDK installation steps, code examples, API docs link |

### 9.2 Tech Stack

- **Framework:** Next.js 14 (app router) — already in the monorepo
- **UI:** Tailwind CSS + shadcn/ui components
- **Charts:** Recharts or Tremor
- **State:** TanStack Query for server state
- **Wallet:** `@solana/wallet-adapter-react`
- **Location:** `apps/dashboard/` (new workspace)

### 9.3 Analytics Queries

Key metrics the dashboard should compute:

```sql
-- Monthly Recurring Revenue (MRR)
SELECT SUM(p.amount_base_units)
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.status = 'active'
  AND p.app_id IN (SELECT id FROM apps WHERE merchant_id = :merchantId);

-- Churn Rate (monthly)
SELECT
  COUNT(*) FILTER (WHERE cancelled_at >= date_trunc('month', now())) AS churned,
  COUNT(*) FILTER (WHERE created_at < date_trunc('month', now()) AND status = 'active') AS start_count
FROM subscriptions
WHERE plan_id IN (SELECT id FROM plans WHERE app_id IN (SELECT id FROM apps WHERE merchant_id = :merchantId));

-- Revenue by Plan
SELECT p.name, SUM(mt.amount_net) as total_revenue, COUNT(DISTINCT s.subscriber_id) as subscribers
FROM merchant_transactions mt
JOIN subscriptions s ON mt.subscription_id = s.id
JOIN plans p ON s.plan_id = p.id
WHERE p.app_id IN (SELECT id FROM apps WHERE merchant_id = :merchantId)
GROUP BY p.id, p.name;
```

---

## 10. Platform Subscription (Super Admin) Plan

### 10.1 Tier Structure

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0/mo | 1 app, 2 plans, 50 subscribers, basic analytics, no webhooks, standard fees (0.25% + $0.05) |
| **Pro** | $29/mo | 5 apps, unlimited plans, unlimited subscribers, advanced analytics, webhooks, reduced fees (0.15% + $0.03) |
| **Enterprise** | Custom | Unlimited everything, priority support, custom fees, dedicated keeper, SLA |

### 10.2 Enforcement

Platform plan limits are enforced at the API layer:

```typescript
// Middleware that checks platform subscription limits
async function enforcePlatformLimits(req, res, next) {
  const merchant = await getMerchant(req.user.walletAddress);
  const platformSub = await prisma.platformSubscription.findUnique({
    where: { merchantId: merchant.id },
    include: { plan: true },
  });

  const features = platformSub?.plan.features as PlanFeatures;
  const appCount = await prisma.app.count({ where: { merchantId: merchant.id } });

  if (features.maxApps && appCount >= features.maxApps) {
    throw new AppError(ErrorCode.PLAN_LIMIT_REACHED, "App limit reached. Upgrade your plan.");
  }
  next();
}
```

### 10.3 Super Admin Dashboard

Separate from the merchant dashboard. Located at `apps/admin/` or accessible via `/admin` routes:

- View all merchants, their subscription tiers, revenue
- Manage platform plans (CRUD)
- Update global config (fee rates, feature flags)
- View platform-wide analytics (total GMV, platform revenue, merchant count)
- Manage super admin accounts

### 10.4 Platform Fee Dynamics

When a merchant is on the Pro tier with reduced fees:
1. The on-chain `PlatformConfig` PDA stores the default fees
2. The keeper reads the merchant's platform tier from the DB
3. If the merchant has a fee override, the keeper uses a different code path (or the contract reads from a merchant-specific config PDA)

**Option A (simpler, off-chain enforcement):** Keep on-chain fees as the maximum. The keeper calculates the reduced fee off-chain and only sends the reduced `platformFee` amount to the treasury. The smart contract validates `platformFee >= min_fee` rather than computing it.

**Option B (on-chain):** Add a `MerchantConfig` PDA that stores per-merchant fee overrides, set by the super admin. The contract reads this during `process_payment`.

Recommendation: **Option A** for now. It's simpler and fee disputes can be resolved by checking the tx on-chain.

---

## 11. Implementation Roadmap

### Phase 1: Schema & API Foundation (Week 1-2)

- [ ] **Fix JWT_SECRET fail-fast on default value** (critical security fix)
- [ ] Update Prisma schema with all new models
- [ ] Run migrations
- [ ] Add `RefreshToken` model, implement `POST /auth/refresh` and `POST /auth/logout`
- [ ] Switch to short-lived access tokens (15 min) + refresh tokens (30 days)
- [ ] Add expired nonce cleanup cron job
- [ ] Expand Merchant model (email, phone, business fields)
- [ ] Expand Subscriber model (name, email)
- [ ] Add `SubscriptionStatus` enum, `nextPaymentDue`, `currentCycle`
- [ ] Add `SubscriptionEvent` table and start logging events
- [ ] Add `fromWallet`/`toWallet` to MerchantTransaction
- [ ] Add pagination metadata to all list endpoints
- [ ] Add rate limiting

### Phase 2: Platform Subscription Layer (Week 2-3)

- [ ] Add SuperAdmin, PlatformPlan, PlatformSubscription, PlatformTransaction models
- [ ] Add GlobalConfig table
- [ ] Add super admin role to `/auth/verify` with pre-registration guard (no auto-create)
- [ ] Add `requireSuperAdmin` middleware
- [ ] Build platform plan CRUD routes (super admin only)
- [ ] Build platform subscription routes (merchant-facing)
- [ ] Auto-assign free tier to new merchants on registration
- [ ] Add platform limit enforcement middleware

### Phase 3: API Keys & Webhooks (Week 3-4)

- [ ] Add ApiKey model
- [ ] Build API key generation/revocation routes
- [ ] Build `authenticateApiKey` middleware
- [ ] Add WebhookEndpoint and WebhookDelivery models
- [ ] Build webhook CRUD routes
- [ ] Build webhook dispatcher service with retry logic
- [ ] Integrate webhook dispatch into keeper event reporting

### Phase 4: Smart Contract v2 (Week 4-5)

- [ ] **Change `InitializeSubscription` to subscriber-pays-rent** (remove merchant as Signer, make AccountInfo)
- [ ] Update `FinalizeCancel` and `ForceCancel` to `close = subscriber` (rent refund to subscriber)
- [ ] Add `plan_seed` to PDA seeds (breaking change — plan migration strategy needed)
- [ ] Add `plan_seed` field to on-chain `Subscription` struct
- [ ] Add `PlatformConfig` PDA for dynamic fees and keeper registry
- [ ] Update Subscription struct with `plan_seed`
- [ ] Update all instruction contexts for new PDA derivation
- [ ] Update all tests
- [ ] Deploy to devnet and run E2E smoke tests
- [ ] Update `@recur/solana-client` PDA helpers

### Phase 5: SDK (Week 5-7)

- [ ] Build core `RecurClient` class
  - [ ] API client (fetch plan, register subscription)
  - [ ] Transaction builder (ATA creation, SPL approve, initialize_subscription)
  - [ ] Subscription status checker
- [ ] Build React components
  - [ ] `RecurProvider` context
  - [ ] `useSubscribe` hook
  - [ ] `useSubscription` hook
  - [ ] `SubscribeButton` component
  - [ ] `CheckoutModal` component
- [ ] Build vanilla JS `mountButton` interface
- [ ] Write SDK documentation with code examples
- [ ] Publish to npm as `@recur/sdk`

### Phase 6: Keeper v2 (Week 6-7)

- [ ] Optimize queries using `nextPaymentDue` index
- [ ] Implement retry queue with exponential backoff
- [ ] Implement grace period and dunning logic
- [ ] **Add `syncSubscriptions` chain scan job** (getProgramAccounts every 5 min, register missing subs)
- [ ] Add webhook trigger calls after each event
- [ ] Add health check endpoint
- [ ] Add monitoring/alerting (log-based or Prometheus metrics)
- [ ] Remove hardcoded batch size (make configurable)

### Phase 7: Merchant Dashboard (Week 7-10)

- [ ] Set up `apps/dashboard/` workspace (Next.js 14 + shadcn/ui)
- [ ] Wallet connect + auth flow
- [ ] Onboarding wizard (business profile, first app, first plan)
- [ ] Dashboard home (MRR, charts, recent events)
- [ ] App management pages
- [ ] Plan management pages
- [ ] Subscriber list + detail pages
- [ ] Transaction history with filters
- [ ] Analytics page (revenue, churn, growth charts)
- [ ] Webhook configuration pages
- [ ] API key management pages
- [ ] Settings & platform subscription page
- [ ] Integration guide with live code examples

### Phase 8: Testing & Hardening (Week 10-11)

- [ ] API integration tests (not just unit tests with mocked Prisma)
- [ ] SDK integration tests against devnet
- [ ] Keeper E2E tests with real chain interactions
- [ ] Load testing (simulate 1000+ concurrent subscriptions)
- [ ] Security audit of smart contract
- [ ] Pen testing of API endpoints

### Phase 9: Launch Prep (Week 11-12)

- [ ] Mainnet deployment of smart contract
- [ ] Production infrastructure setup (DB, API, keeper, monitoring)
- [ ] DNS + SSL for API and dashboard
- [ ] SDK v1.0.0 published to npm
- [ ] Documentation site
- [ ] Merchant onboarding flow tested end-to-end

---

## 12. Resolved Decisions & Open Questions

### Resolved Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **How does the server learn about new subscriptions?** | Client-side SDK reports to API after on-chain confirmation (primary) + Keeper `getProgramAccounts` scan every 5 min (backup safety net) | The SDK handles 99%+ of cases instantly. The chain scan catches edge cases (browser close, network drop) within 5 min — acceptable since first payment isn't due for days/weeks. No third-party dependency. |
| **Who signs `initialize_subscription`?** | Subscriber only (subscriber-pays-rent model) | In the SDK flow, only the subscriber's wallet is connected in the browser. Making the subscriber the payer eliminates the co-signing problem entirely. Rent is ~0.002 SOL (~$0.30), refunded on cancel. |
| **SDK framework support for v1?** | Core client is framework-agnostic. React components for v1. Vue/Svelte adapters in v2. | React covers the majority of the market. The core `RecurClient` class works with any framework. |

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **SPL Token approve is per-account, not per-amount** — If subscriber changes delegation, all subscriptions to that merchant break | High | Educate subscribers; monitor delegation in keeper; force-cancel gracefully |
| **Single keeper is a SPOF** — If keeper goes down, all payments stop | High | Run 2+ keeper instances with leader election or idempotent processing (tx signature dedup already handles this) |
| **On-chain PDA seed change is breaking** — Existing subscriptions can't be migrated to new PDA seeds | High | Version the program: new subs use v2 seeds, old subs continue with v1 until they expire. Dual-read in keeper. |
| **Token-2022 and Token Extensions** — Current code uses legacy SPL Token. Some mints may only support Token-2022 | Medium | Add Token-2022 support in Phase 8 or later |
| **Solana RPC rate limits / reliability** — Heavy keeper polling may hit rate limits | Medium | Use dedicated RPC (Helius/QuickNode), implement circuit breaker |

### Open Questions

1. **Should platform subscriptions (merchant buying Recur plans) go through the same smart contract?**
   - Pro: Dogfooding your own protocol, proves it works
   - Con: Adds complexity; platform billing could be simpler off-chain
   - Recommendation: Use the same smart contract. It's great marketing ("we use our own protocol").

2. **Multi-token support** — Currently USDC-only. When/if to add SOL, USDT, etc.?
   - Recommendation: Keep USDC-only for v1. Add multi-token as a v2 feature.

3. **Upgrade authority** — Who holds the program upgrade authority in production?
   - Recommendation: Multisig (same as treasury), with plans to eventually make the program immutable.

4. **How to handle subscription price changes?**
   - On-chain amount is immutable per PDA. To change price: create a new plan, new subscribers get the new price, old subscribers keep their locked-in price until they cancel and re-subscribe.

5. **At what scale should the keeper chain scan switch from `getProgramAccounts` to Helius webhooks?**
   - `getProgramAccounts` is fine up to ~10,000-50,000 subscriptions. Beyond that, the response size and RPC load become significant. Plan to evaluate Helius webhooks when approaching 10K active subs.

---

## Appendix A: Current vs. Proposed Entity Relationship

### Current (7 tables)
```
AuthNonce
Merchant ──→ App ──→ Plan ──→ Subscription ←── Subscriber
                                    │
                                    ▼
                           MerchantTransaction
```

### Proposed (17 tables)
```
AuthNonce
RefreshToken

Merchant ──→ App ──→ Plan ──→ Subscription ←── Subscriber
   │           │                    │
   │           ├── ApiKey           ├── SubscriptionEvent
   │           └── WebhookEndpoint  └── MerchantTransaction
   │                    │
   │                    └── WebhookDelivery
   │
   └── PlatformSubscription ──→ PlatformPlan
              │
              └── PlatformTransaction

SuperAdmin
GlobalConfig
```

---

## Appendix B: SDK NPM Package Structure

```
@recur/sdk (published to npm)
├── dist/
│   ├── index.js          # CJS entry
│   ├── index.mjs         # ESM entry
│   ├── index.d.ts        # TypeScript declarations
│   ├── core/
│   │   ├── RecurClient.js
│   │   ├── transactions.js
│   │   └── api.js
│   └── react/
│       ├── RecurProvider.js
│       ├── useSubscribe.js
│       ├── useSubscription.js
│       ├── SubscribeButton.js
│       └── CheckoutModal.js
├── package.json
│   {
│     "name": "@recur/sdk",
│     "version": "1.0.0",
│     "main": "dist/index.js",
│     "module": "dist/index.mjs",
│     "types": "dist/index.d.ts",
│     "exports": {
│       ".": { "import": "./dist/index.mjs", "require": "./dist/index.js" },
│       "./react": { "import": "./dist/react/index.mjs", "require": "./dist/react/index.js" }
│     },
│     "peerDependencies": {
│       "@solana/web3.js": "^1.87",
│       "@solana/wallet-adapter-base": "^0.9",
│       "react": "^18.0 || ^19.0"
│     }
│   }
└── README.md
```

---

## Appendix C: Webhook Event Catalog

| Event | Trigger | Payload |
|-------|---------|---------|
| `subscription.created` | New subscription initialized on-chain | `{ subscriptionId, planId, subscriberWallet, pda, timestamp }` |
| `payment.success` | Keeper processes payment successfully | `{ subscriptionId, txSignature, amountGross, platformFee, amountNet, cycle, timestamp }` |
| `payment.failed` | Payment transaction fails | `{ subscriptionId, error, attempt, nextRetry, timestamp }` |
| `subscription.past_due` | Subscription enters grace period | `{ subscriptionId, failedSince, nextRetry, timestamp }` |
| `subscription.cancel_requested` | Subscriber or merchant requests cancel | `{ subscriptionId, requestedBy, timestamp }` |
| `subscription.cancelled` | Cancel finalized, PDA closed | `{ subscriptionId, pda, totalCycles, timestamp }` |
| `subscription.force_cancelled` | Delegation revoked, keeper force-cancels | `{ subscriptionId, reason, timestamp }` |

All webhooks are signed with HMAC-SHA256 using the endpoint's secret. Header: `X-Recur-Signature`.

---

## Appendix D: Fee Calculation Reference

For a payment of `amount` base units:

```
percent_fee = amount * 25 / 10_000        (0.25%)
platform_fee = 50_000 + percent_fee       ($0.05 flat + 0.25%)
merchant_net = amount - platform_fee
```

| Plan Price | Subscriber Pays | Platform Fee | Merchant Receives |
|-----------|----------------|--------------|-------------------|
| $1.00 | $1.00 | $0.0525 | $0.9475 |
| $5.00 | $5.00 | $0.0625 | $4.9375 |
| $9.99 | $9.99 | $0.0750 | $9.9150 |
| $29.99 | $29.99 | $0.1250 | $29.8650 |
| $99.99 | $99.99 | $0.3000 | $99.6900 |

**Pro tier fee overrides (proposed):**

| Plan Price | Standard Fee (Free) | Pro Fee | Difference |
|-----------|-------------------|---------|------------|
| $9.99/mo | $0.0750 | $0.0450 | saves $0.03/payment |
| $99.99/mo | $0.3000 | $0.1800 | saves $0.12/payment |

---

## Appendix E: Auth Flow Deep Dive

### E.1 Current Implementation

The system uses **Ed25519 wallet signature auth** with a nonce challenge/response pattern. A single pair of endpoints (`POST /auth/nonce` + `POST /auth/verify`) handles all roles. The `role` field in the request determines which table is upserted and what goes into the JWT.

**Files:** `apps/api/src/modules/auth/auth.routes.ts`, `apps/api/src/middleware/auth.ts`

### E.2 Complete Merchant Auth Flow

```
MERCHANT'S BROWSER                        YOUR API SERVER                    DATABASE
       │                                        │                              │
  1. Merchant connects Phantom/Solflare          │                              │
     wallet in the dashboard                     │                              │
       │                                        │                              │
  2. POST /auth/nonce                            │                              │
     { walletAddress: "ABC...",                  │                              │
       role: "merchant" }                        │                              │
       │───────────────────────────────────────>│                              │
       │                                        │                              │
       │                              3. Delete any expired nonces             │
       │                                 for this wallet (cleanup)             │
       │                                        │─────────────────────────────>│
       │                                        │                              │
       │                              4. Generate UUID nonce +                 │
       │                                 expiry (120 seconds)                  │
       │                                        │                              │
       │                              5. Save to auth_nonces table             │
       │                                        │─────────────────────────────>│
       │                                        │                              │
       │    { nonce: "uuid...",                  │                              │
       │      message: "Sign in to Recur        │                              │
       │        as merchant.\n\n                 │                              │
       │        Wallet: ABC...\n                 │                              │
       │        Nonce: uuid...",                 │                              │
       │      expiresAt: "2026-..." }            │                              │
       │<───────────────────────────────────────│                              │
       │                                        │                              │
  6. Dashboard displays the message              │                              │
     in wallet popup for signing                 │                              │
       │                                        │                              │
  7. Merchant clicks "Sign" in wallet            │                              │
     → Ed25519 signature over message bytes     │                              │
       │                                        │                              │
  8. POST /auth/verify                           │                              │
     { walletAddress: "ABC...",                  │                              │
       role: "merchant",                         │                              │
       nonce: "uuid...",                         │                              │
       signature: "base58sig..." }               │                              │
       │───────────────────────────────────────>│                              │
       │                                        │                              │
       │                              9. Look up nonce record                  │
       │                                        │─────────────────────────────>│
       │                                        │      nonce record            │
       │                                        │<─────────────────────────────│
       │                                        │                              │
       │                             10. Validate:                              │
       │                                 a. Nonce exists                        │
       │                                 b. walletAddress matches record       │
       │                                 c. Not used (usedAt == null)          │
       │                                 d. Not expired (expiresAt > now)      │
       │                                        │                              │
       │                             11. Reconstruct the exact message:        │
       │                                 "Sign in to Recur as merchant.        │
       │                                  \n\nWallet: ABC...\nNonce: uuid..."  │
       │                                        │                              │
       │                             12. Verify Ed25519 signature:             │
       │                                 nacl.sign.detached.verify(            │
       │                                   messageBytes,                       │
       │                                   signatureBytes,                     │
       │                                   walletPublicKeyBytes               │
       │                                 )                                     │
       │                                 → Proves the wallet owner             │
       │                                   actually signed this message        │
       │                                        │                              │
       │                             13. Mark nonce as used (usedAt = now)     │
       │                                        │─────────────────────────────>│
       │                                        │                              │
       │                             14. Upsert merchant row:                  │
       │                                 prisma.merchant.upsert({              │
       │                                   where: { walletAddress },           │
       │                                   update: {},                         │
       │                                   create: { walletAddress }           │
       │                                 })                                    │
       │                                 (auto-creates on first login)         │
       │                                        │─────────────────────────────>│
       │                                        │                              │
       │                             15. Issue JWT:                             │
       │                                 jwt.sign(                             │
       │                                   { walletAddress,                    │
       │                                     role: "merchant" },               │
       │                                   JWT_SECRET,                         │
       │                                   { expiresIn: "7d" }                │
       │                                 )                                     │
       │                                        │                              │
       │    { token: "eyJhbG..." }               │                              │
       │<───────────────────────────────────────│                              │
       │                                        │                              │
  16. Store JWT (localStorage / memory)          │                              │
       │                                        │                              │
  ─ ─ ─ ─ ─ ─  ALL SUBSEQUENT REQUESTS  ─ ─ ─ ─ ─ ─                           │
       │                                        │                              │
  17. GET /merchant/me                           │                              │
      Authorization: Bearer eyJhbG...            │                              │
       │───────────────────────────────────────>│                              │
       │                                        │                              │
       │                             18. authenticate middleware:               │
       │                                 - Extract token from header           │
       │                                 - jwt.verify(token, JWT_SECRET)       │
       │                                 - Attach { walletAddress, role }      │
       │                                   to req.user                         │
       │                                        │                              │
       │                             19. requireMerchant middleware:            │
       │                                 - Check req.user.role === "merchant"  │
       │                                 - Reject if wrong role               │
       │                                        │                              │
       │                             20. Route handler:                         │
       │                                 prisma.merchant.findUnique({          │
       │                                   where: { walletAddress }            │
       │                                 })                                    │
       │                                        │─────────────────────────────>│
       │    { id, walletAddress, name, apps }    │                              │
       │<───────────────────────────────────────│                              │
```

### E.3 Role-Based Auth Behavior

The same `/auth/nonce` + `/auth/verify` endpoints handle all roles. The `role` field determines:

| Role | Table Upserted | JWT Payload | Auto-Create? | Route Guard |
|------|---------------|-------------|-------------|-------------|
| `merchant` | `merchants` | `{ walletAddress, role: "merchant" }` | Yes — any wallet can register | `requireMerchant` |
| `subscriber` | `subscribers` | `{ walletAddress, role: "subscriber" }` | Yes — any wallet can register | `requireSubscriber` |
| `super_admin` | **None currently** | N/A | N/A | N/A |

A single wallet can hold both roles — they request separate JWTs with different `role` values.

### E.4 All Auth Methods in the System

| Actor | Auth Method | Token/Key | Middleware | File |
|-------|------------|-----------|------------|------|
| Merchant | Wallet Ed25519 sign → JWT | `Authorization: Bearer eyJ...` (role: merchant) | `authenticate` → `requireMerchant` | `auth.ts`, `merchant.routes.ts` |
| Subscriber | Wallet Ed25519 sign → JWT | `Authorization: Bearer eyJ...` (role: subscriber) | `authenticate` → `requireSubscriber` | `auth.ts`, `subscription.routes.ts` |
| Super Admin | **Not yet implemented** | — | — | — |
| SDK (client) | **Not yet implemented** | — | — | — |
| Keeper → API | Shared secret | `X-Keeper-Secret: xxx` | `verifyKeeperSecret` | `keeper.routes.ts` |

### E.5 Issues & Required Improvements

#### Issue 1: JWT_SECRET defaults to known value — CRITICAL

`JWT_SECRET` defaults to `"change-me-in-production"` in both `auth.routes.ts` and `auth.ts`. If not set in production, every JWT is signed with a publicly known secret — anyone can forge tokens.

**Fix:** Fail fast on startup:
```typescript
const JWT_SECRET = process.env["JWT_SECRET"];
if (!JWT_SECRET || JWT_SECRET === "change-me-in-production") {
  throw new Error("FATAL: JWT_SECRET must be set to a secure value. Refusing to start.");
}
```

#### Issue 2: No refresh token mechanism

JWT expires in 7 days with no refresh path. Merchant must re-sign with wallet every 7 days.

**Improvement:** Add refresh tokens:

```prisma
model RefreshToken {
  id            String   @id @default(cuid())
  walletAddress String   @map("wallet_address")
  role          String                                // "merchant" | "subscriber" | "super_admin"
  token         String   @unique                      // hashed token value
  expiresAt     DateTime @map("expires_at")
  revokedAt     DateTime? @map("revoked_at")
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([walletAddress])
  @@index([expiresAt])
  @@map("refresh_tokens")
}
```

**Flow:**
- `POST /auth/verify` returns `{ accessToken (15 min), refreshToken (30 days) }`
- `POST /auth/refresh` accepts refresh token → returns new access token
- `POST /auth/logout` revokes the refresh token
- Refresh tokens stored in DB so they can be revoked per-wallet if compromised

#### Issue 3: No session revocation

JWTs can't be individually revoked. If a wallet is compromised, the attacker's JWT remains valid for up to 7 days.

**Fix:** Solved by Issue 2 — short-lived access tokens (15 min) + revocable refresh tokens. If a wallet is compromised, revoke all refresh tokens for that wallet. The access token expires in 15 min max.

#### Issue 4: Super admin auth is missing

Needed for platform subscription management and global config.

**Improvement:** Reuse the same auth flow with a guard:

```typescript
// In auth.routes.ts verify handler — add before JWT issuance:
if (role === "super_admin") {
  const admin = await prisma.superAdmin.findUnique({
    where: { walletAddress, isActive: true },
  });
  if (!admin) {
    throw new AppError(ErrorCode.FORBIDDEN, "Not an authorized super admin");
  }
  // Do NOT upsert — super admins are pre-registered by another super admin or via DB seed
}
```

Add the route guard middleware:

```typescript
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "super_admin") {
    fail(res, ErrorCode.FORBIDDEN, "Super admin access required");
    return;
  }
  next();
}
```

**Key difference from merchant/subscriber:** Super admins are NOT auto-created. They must be pre-registered in the `super_admins` table (initial seed via Prisma seed script, subsequent admins added by existing super admins).

#### Issue 5: API key auth for SDK not implemented

The SDK can't do wallet signing. It needs API key auth.

**Implementation:**

```typescript
// apps/api/src/middleware/auth.ts — new middleware

export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = req.headers["x-api-key"] as string;
  if (!key) {
    fail(res, ErrorCode.UNAUTHORIZED, "Missing X-Api-Key header");
    return;
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { publicKey: key, isActive: true },
    include: { merchant: true, app: true },
  });

  if (!apiKey) {
    fail(res, ErrorCode.UNAUTHORIZED, "Invalid API key");
    return;
  }

  // Attach resolved context to request
  req.apiContext = {
    merchantId: apiKey.merchantId,
    appId: apiKey.appId,
    keyType: key.startsWith("sk_") ? "secret" : "public",
  };

  // Update last used timestamp (fire-and-forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {}); // non-blocking

  next();
}
```

**Public vs Secret keys:**
- `pk_live_xxx` — Used client-side (browser SDK). Can only read plans and register subscriptions.
- `sk_live_xxx` — Used server-side. Can also list subscribers, transactions, and manage webhooks.

#### Issue 6: Nonce table accumulates stale records

Expired nonces are only cleaned up when the same wallet requests a new nonce. Wallets that auth once and never return leave orphaned rows.

**Improvement:** Add periodic cleanup — either as a keeper cron job or a DB scheduled task:

```typescript
// Run daily — delete all expired nonces
cron.schedule("0 3 * * *", async () => {
  const deleted = await prisma.authNonce.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  logger.info({ count: deleted.count }, "Cleaned up expired auth nonces");
});
```

#### Issue 7: Role self-declaration (acceptable for now)

Anyone can call `/auth/verify` with `role: "merchant"` and get a merchant account auto-created. This is by design for a self-service platform — no approval gate.

For a future beta launch / invite-only mode, add an invite code check:

```typescript
// Optional: check invite code for merchant registration
if (role === "merchant" && !existingMerchant) {
  const inviteCode = req.body.inviteCode;
  if (env.REQUIRE_INVITE && !inviteCode) {
    throw new AppError(ErrorCode.FORBIDDEN, "Invite code required");
  }
  // validate invite code...
}
```

### E.6 Final Auth Architecture (All Roles)

```
                    ┌──────────────────────────────────────┐
                    │          /auth/nonce + /auth/verify   │
                    │       (Ed25519 wallet signature)      │
                    └────────────┬─────────────────────────┘
                                 │
                    ┌────────────┼────────────────────┐
                    │            │                    │
                    ▼            ▼                    ▼
             role: merchant  role: subscriber   role: super_admin
             auto-create ✓   auto-create ✓      pre-registered only
                    │            │                    │
                    ▼            ▼                    ▼
              JWT (7d/15m)  JWT (7d/15m)        JWT (7d/15m)
              + refresh     + refresh           + refresh
                    │            │                    │
                    ▼            ▼                    ▼
             requireMerchant requireSubscriber  requireSuperAdmin
             /merchant/*     /subscriber/*      /admin/*

  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

                    ┌──────────────────────────────────────┐
                    │       authenticateApiKey              │
                    │    (X-Api-Key: pk_live / sk_live)     │
                    └────────────┬─────────────────────────┘
                                 │
                    ┌────────────┼────────────────────┐
                    │                                │
                    ▼                                ▼
              pk_live (public)                sk_live (secret)
              browser SDK                    server-side SDK
              read plans,                    + list subscribers,
              register subs                  transactions, webhooks
                    │                                │
                    ▼                                ▼
              /sdk/* routes                  /sdk/* routes (elevated)

  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

                    ┌──────────────────────────────────────┐
                    │       verifyKeeperSecret              │
                    │    (X-Keeper-Secret: shared secret)   │
                    └────────────┬─────────────────────────┘
                                 │
                                 ▼
                          /keeper/* routes
                     (payment, cancel, sync events)
```

### E.7 Implementation Checklist

| Task | Phase | Priority |
|------|-------|----------|
| Fail-fast on default JWT_SECRET | Phase 1 | **Critical** |
| Add `RefreshToken` model to Prisma schema | Phase 1 | High |
| Implement `POST /auth/refresh` and `POST /auth/logout` | Phase 1 | High |
| Add super admin role to `/auth/verify` with pre-registration check | Phase 2 | High |
| Add `requireSuperAdmin` middleware | Phase 2 | High |
| Implement `authenticateApiKey` middleware | Phase 3 | High |
| Add public vs secret key permission differentiation | Phase 3 | Medium |
| Add nonce cleanup cron job | Phase 1 | Low |
| Add invite-code gating (optional, for beta) | Phase 9 | Low |

---

*This document should be treated as a living spec. Update it as design decisions are finalized.*
