# Recur — Full Implementation Plan

> PostgreSQL only. No Redis. No external queues. No Squads dependency.

---

## Table of Contents

1. [Dependencies to Install](#dependencies-to-install)
2. [Phase 1 — Smart Contract](#phase-1--smart-contract)
3. [Phase 2 — Prisma Schema](#phase-2--prisma-schema)
4. [Phase 3 — API Server](#phase-3--api-server)
5. [Phase 4 — Keeper](#phase-4--keeper)
6. [Phase 5 — Package Updates](#phase-5--package-updates)
7. [Execution Order](#execution-order)
8. [Skipped (Out of Scope)](#skipped-out-of-scope)

---

## Dependencies to Install

| Package                                | Where         | Why                                   |
| -------------------------------------- | ------------- | ------------------------------------- |
| `jsonwebtoken` + `@types/jsonwebtoken` | `apps/api`    | JWT issuance + verification           |
| `tweetnacl`                            | `apps/api`    | Ed25519 wallet signature verification |
| `bs58` + `@types/bs58`                 | `apps/api`    | Decode base58 Solana signatures       |
| `@solana/web3.js`                      | `apps/api`    | `PublicKey` for signature verify      |
| `node-cron` + `@types/node-cron`       | `apps/keeper` | Cron scheduling                       |
| `@coral-xyz/anchor`                    | `apps/keeper` | Program client to build txs           |
| `@solana/spl-token`                    | `apps/keeper` | Check delegation on-chain             |

No new infrastructure. No Redis. No queues. Everything via Postgres + direct RPC.

---

## Phase 1 — Smart Contract

### 1.1 Fixes to `contracts/programs/recur/src/lib.rs`

#### Fix A — CPI authority in `process_payment`

The subscriber delegates tokens to the **Subscription PDA** via `spl_token.approve(subscriber, subscription_pda, amount)`.
The PDA signs the CPI via `CpiContext::new_with_signer`. This is the correct Web3 pattern.
The current bug is in the seed construction — `ctx.accounts.subscriber.key` must be `.key.as_ref()`.
Fix the seed slice so the PDA signer seeds compile and match correctly.

#### Fix B — Remove `treasury` from `Subscription` state

Treasury is now a global vault PDA. Storing it per-subscription wastes 32 bytes per account and is unnecessary.

- Remove `treasury: Pubkey` from `Subscription` struct
- Remove `treasury: AccountInfo` from `InitializeSubscription` accounts
- Remove `InvalidTreasury` error
- Remove the treasury key validation in `initialize_subscription`

#### Fix C — Update `treasury_token_account` constraint in `ProcessPayment`

```
Before: treasury_token_account.owner == subscription.treasury
After:  treasury_token_account.owner == treasury_vault.key()
```

Add `treasury_vault: Account<'info, TreasuryVault>` (seeds: `["treasury_vault"]`, read-only) to `ProcessPayment` accounts.

---

### 1.2 New State Structs

```rust
// Global — one per program deployment
#[account]
#[derive(InitSpace)]
pub struct TreasuryVault {
    pub proposal_count: u64,  // auto-increment nonce for proposal seeds
    pub bump: u8,
}

// One per active withdrawal proposal
#[account]
#[derive(InitSpace)]
pub struct WithdrawalProposal {
    pub proposer:    Pubkey,   // MULTISIG_A or MULTISIG_B
    pub amount:      u64,      // token base units to withdraw
    pub destination: Pubkey,   // token account to receive funds
    pub created_at:  u64,
    pub expires_at:  u64,      // created_at + ttl_seconds
    pub nonce:       u64,      // stored for seed verification / replay protection
    pub bump:        u8,
}
```

---

### 1.3 New Instructions

#### `initialize_treasury`

```
Signer:  MULTISIG_A or MULTISIG_B
Creates: TreasuryVault PDA  (seeds: ["treasury_vault"])
         treasury_vault_token_account (ATA owned by vault PDA, init'd here)
Guards:  signer must be MULTISIG_A or MULTISIG_B
         Anchor `init` handles double-init protection automatically
Sets:    proposal_count = 0, bump
```

#### `propose_withdrawal(amount: u64, destination: Pubkey, ttl_seconds: u64)`

```
Signer:  MULTISIG_A or MULTISIG_B
Creates: WithdrawalProposal PDA
         seeds: ["withdrawal_proposal", proposer.key(), nonce.to_le_bytes()]
         nonce = treasury_vault.proposal_count (read, then increment)
Guards:  amount > 0
         ttl_seconds > 0
         vault_token_account.amount >= amount
Sets:    proposer, amount, destination, created_at, expires_at, nonce, bump
```

#### `approve_withdrawal`

```
Signer:  The OTHER multisig key (not the proposer)
Guards:  signer != proposal.proposer              (no self-approval)
         now < proposal.expires_at                (not expired)
         vault_token_account.amount >= proposal.amount
Action:  CPI transfer_checked: treasury_vault_token_account → proposal.destination
         close WithdrawalProposal PDA → rent to approver
```

#### `cancel_proposal`

```
Signer:  proposal.proposer only
Guards:  signer == proposal.proposer
Action:  close WithdrawalProposal PDA → rent to proposer
```

#### `cleanup_expired_proposal` (permissionless)

```
Signer:  anyone
Guards:  now >= proposal.expires_at
Action:  close WithdrawalProposal PDA → rent to caller
```

---

### 1.4 New Errors

```rust
UnauthorizedMultisig      // signer is not MULTISIG_A or MULTISIG_B
SelfApproval              // approver is the same key as proposer
ProposalExpired           // now >= proposal.expires_at
InsufficientVaultBalance  // vault token balance < proposal.amount
NotProposer               // cancel_proposal called by non-proposer
ProposalNotExpired        // cleanup called on a live proposal
```

---

### 1.5 Anchor Tests (`contracts/tests/`)

```
contracts/tests/
├── recur.test.ts
└── helpers/
    ├── accounts.ts    — createFundedWallet(), mintUsdc(), createTokenAccount(), approveDelegate()
    └── program.ts     — getProgram(), getPda(), airdrop()
```

#### Test coverage

**`initialize_subscription`**

- ✓ Creates PDA with all fields set correctly
- ✓ Rejects `amount < 1_000_000`
- ✓ Rejects `interval = 0`

**`process_payment`**

- ✓ Splits fee correctly — merchant gets `amount - fee`, vault gets `fee`
- ✓ Updates `last_payment_timestamp`
- ✓ Rejects if interval not elapsed
- ✓ Rejects if `cancel_requested_at > 0` and period elapsed (`SubscriptionCancelled`)
- ✓ Rejects non-keeper signer
- ✓ Rejects revoked delegation (`DelegationRevoked`)

**`request_cancel` / `finalize_cancel`**

- ✓ Subscriber can request cancel
- ✓ Merchant can request cancel
- ✓ Rejects unauthorized signer
- ✓ Rejects double cancel (`CancelAlreadyRequested`)
- ✓ `finalize_cancel` closes PDA after cancel + interval elapsed
- ✓ `finalize_cancel` rejects if no cancel requested
- ✓ `finalize_cancel` rejects if interval not yet elapsed

**`force_cancel`**

- ✓ Keeper can force cancel
- ✓ Rejects non-keeper signer

**`initialize_treasury`**

- ✓ Creates vault PDA (called by MULTISIG_A)
- ✓ Creates vault PDA (called by MULTISIG_B)
- ✓ Rejects unknown signer (`UnauthorizedMultisig`)
- ✓ Rejects double init (Anchor `init` constraint)

**`propose_withdrawal`**

- ✓ Creates proposal with correct fields
- ✓ `proposal_count` increments on subsequent proposals (nonce is unique)
- ✓ Rejects non-multisig signer
- ✓ Rejects `amount > vault balance` (`InsufficientVaultBalance`)

**`approve_withdrawal`**

- ✓ Transfers correct amount to destination
- ✓ Closes proposal PDA, rent returned to approver
- ✓ Rejects self-approval — A cannot approve A's own proposal (`SelfApproval`)
- ✓ Rejects expired proposal (`ProposalExpired`)
- ✓ Rejects if vault balance dropped below amount at approval time

**`cancel_proposal`**

- ✓ Proposer can cancel their own live proposal
- ✓ Rejects non-proposer (`NotProposer`)

**`cleanup_expired_proposal`**

- ✓ Anyone can clean up after `expires_at`
- ✓ Rejects cleanup of a live (non-expired) proposal (`ProposalNotExpired`)

---

## Phase 2 — Prisma Schema

Full replacement of `packages/db/prisma/schema.prisma`.

### Models

#### `Merchant`

```
id            String   @id @default(cuid())
walletAddress String   @unique
name          String?
webhookUrl    String?
webhookSecret String?  — HMAC signing secret (stored hashed)
createdAt     DateTime
updatedAt     DateTime
→ has many: Plan, Subscription, Transaction, WebhookJob
```

#### `Plan`

```
id          String   @id @default(cuid())
merchantId  String   FK → Merchant
name        String   — e.g. "Pro Monthly"
description String?
amount      BigInt   — USDC base units (u64), source of truth for on-chain
interval    BigInt   — seconds (u64), source of truth for on-chain
isActive    Boolean  @default(true)
createdAt   DateTime
updatedAt   DateTime
→ has many: Subscription
NOTE: amount + interval are immutable once subscriptions exist
```

#### `Subscriber`

```
id            String   @id @default(cuid())
walletAddress String   @unique
createdAt     DateTime
updatedAt     DateTime
→ has many: Subscription
```

#### `Subscription`

```
id                String             @id @default(cuid())
merchantId        String             FK → Merchant
planId            String             FK → Plan
subscriberId      String             FK → Subscriber
onchainPda        String             @unique — base58 PDA address
status            SubscriptionStatus @default(ACTIVE)
lastPaymentAt     DateTime?
nextPaymentDue    DateTime           — Keeper uses this index to find due subs
cancelRequestedAt DateTime?
createdAt         DateTime
updatedAt         DateTime
@@index([status, nextPaymentDue])    — critical Keeper query index
```

#### `Transaction`

```
id             String            @id @default(cuid())
subscriptionId String            FK → Subscription
merchantId     String            FK → Merchant
txSignature    String            @unique
type           TransactionType   — PAYMENT | FORCE_CANCEL | FINALIZE_CANCEL
status         TransactionStatus — CONFIRMED | FAILED
amount         BigInt            — full subscription amount
platformFee    BigInt
errorMessage   String?
createdAt      DateTime
```

#### `WebhookJob`

```
id             String           @id @default(cuid())
merchantId     String           FK → Merchant
subscriptionId String?          FK → Subscription
eventType      WebhookEventType — PAYMENT_SUCCESS | PAYMENT_FAILED | SUBSCRIPTION_CANCELLED | SUBSCRIPTION_PAST_DUE
payload        Json
status         WebhookJobStatus — PENDING | DELIVERED | FAILED
attempts       Int              @default(0)
lastAttemptAt  DateTime?
nextRetryAt    DateTime         @default(now())
createdAt      DateTime
@@index([status, nextRetryAt])  — webhook worker query index
```

#### `AuthNonce`

```
id        String    @id @default(cuid())
wallet    String
nonce     String    @unique
expiresAt DateTime  — now + 5 minutes
usedAt    DateTime? — null = unused; set on verify to prevent replay
createdAt DateTime
@@index([wallet, expiresAt])
```

---

## Phase 3 — API Server

### New packages

```
apps/api: jsonwebtoken, @types/jsonwebtoken, tweetnacl, bs58, @types/bs58, @solana/web3.js
```

### File structure

```
apps/api/src/
├── index.ts                         — register all routers, start webhook worker
├── middleware/
│   ├── auth.ts                      — JWT verify middleware (req.wallet)
│   ├── internal.ts                  — X-Keeper-Key header check
│   └── error.ts                     — global Express error handler
└── modules/
    ├── auth/
    │   └── auth.router.ts           — nonce + verify
    ├── merchant/
    │   └── merchant.router.ts       — profile CRUD
    ├── plan/
    │   └── plan.router.ts           — plan CRUD
    ├── subscriber/
    │   └── subscriber.router.ts     — subscriber lookup + subscription list
    ├── subscription/
    │   └── subscription.router.ts   — create, cancel, list
    ├── transaction/
    │   └── transaction.router.ts    — list by subscription / merchant
    ├── webhook/
    │   ├── webhook.router.ts        — config CRUD + test event
    │   └── webhook.worker.ts        — delivery loop (setInterval 10s)
    └── internal/
        └── internal.router.ts       — keeper-facing result reporting
```

---

### Auth Flow

```
Step 1 — Get nonce
  GET /auth/nonce?wallet=<pubkey>
  Server: generate 32-byte random nonce
          store AuthNonce { wallet, nonce, expiresAt: now+5min }
  Returns: { nonce: "Sign this message to login to Recur:\n<nonce>" }

Step 2 — Sign (client-side, in browser/wallet)
  wallet.signMessage(Buffer.from(nonce))  → signature (base58)

Step 3 — Verify
  POST /auth/verify  { wallet, signature, nonce }
  Server: find AuthNonce where nonce=nonce AND usedAt=null AND expiresAt>now
          verify Ed25519:
            nacl.sign.detached.verify(
              Buffer.from(message),
              bs58.decode(signature),
              new PublicKey(wallet).toBytes()
            )
          mark nonce usedAt=now  (prevents replay)
          issue JWT: { sub: wallet, iat, exp: +24h }
  Returns: { token: string }

All protected routes:
  Authorization: Bearer <token>
  middleware/auth.ts → jwt.verify(token, JWT_SECRET) → req.wallet = payload.sub
```

---

### API Endpoints

#### Auth

```
GET  /auth/nonce?wallet=           → { nonce }
POST /auth/verify                  body: { wallet, signature, nonce } → { token }
```

#### Merchant `[JWT]`

```
POST   /merchants                  → create merchant record from req.wallet
GET    /merchants/me               → get own profile
PATCH  /merchants/me               body: { name?, webhookUrl?, webhookSecret? }
```

#### Plan `[JWT, merchant-scoped]`

```
POST   /plans                      body: { name, description?, amount, interval }
GET    /plans                      → list own plans
GET    /plans/:id                  → get single plan
PATCH  /plans/:id                  body: { name?, description?, isActive? }
                                   NOTE: amount + interval immutable if active subscriptions exist
```

#### Subscriber `[JWT]`

```
GET    /subscribers/:wallet                        → get or upsert subscriber
GET    /subscribers/:wallet/subscriptions          → list subscriptions
```

#### Subscription `[JWT]`

```
POST   /subscriptions              body: { planId, subscriberWallet, onchainPda }
                                   Called by SDK after initialize_subscription confirms on-chain
                                   Sets nextPaymentDue = now + plan.interval

GET    /subscriptions/:id          → get subscription detail

POST   /subscriptions/:id/cancel   → verifies caller is subscriber or merchant
                                     updates status=PENDING_CANCEL, cancelRequestedAt=now
                                     (on-chain request_cancel called by SDK before this)

GET    /merchants/me/subscriptions → paginated list, filterable by status
```

#### Transaction `[JWT]`

```
GET    /subscriptions/:id/transactions    → list txs for a subscription
GET    /merchants/me/transactions         → all txs for merchant (paginated)
```

#### Webhook `[JWT]`

```
POST   /webhooks                   body: { url, secret }  → upsert config
GET    /webhooks                   → get current config
POST   /webhooks/test              → enqueue test PAYMENT_SUCCESS job
```

#### Internal `[X-Keeper-Key header]`

```
POST   /internal/payment-result
       body: {
         subscriptionId, txSignature,
         status: "confirmed" | "failed",
         amount, platformFee,
         errorMessage?
       }
       → upsert Transaction record
       → update Subscription: lastPaymentAt, nextPaymentDue, status
       → enqueue WebhookJob (PAYMENT_SUCCESS or PAYMENT_FAILED)

POST   /internal/cancel-result
       body: {
         subscriptionId, txSignature,
         type: "force_cancel" | "finalize_cancel"
       }
       → update Subscription.status = CANCELLED
       → upsert Transaction
       → enqueue WebhookJob (SUBSCRIPTION_CANCELLED)
```

---

### Webhook Delivery Worker (`webhook.worker.ts`)

Runs as `setInterval` every 10 seconds inside the API process.

```
1. SELECT webhook_jobs WHERE status=PENDING AND nextRetryAt <= NOW() LIMIT 50
2. For each job:
   a. Fetch merchant.webhookUrl — skip if null
   b. Compute HMAC-SHA256:
        signature = hmac(webhookSecret, JSON.stringify(payload))
   c. POST to webhookUrl:
        headers: { X-Recur-Signature: signature, Content-Type: application/json }
        body: payload
   d. On 2xx response   → status = DELIVERED
   e. On failure        → attempts++
                          nextRetryAt = now + backoff(attempts)
                          backoff schedule: 1m, 5m, 15m, 1h, 4h, 12h, 24h, ...
   f. After 10 attempts → status = FAILED (permanent)
```

---

## Phase 4 — Keeper

### New packages

```
apps/keeper: node-cron, @types/node-cron, @coral-xyz/anchor
```

### File structure

```
apps/keeper/src/
├── index.ts              — entry: wire all cron jobs
├── solana.ts             — Connection, Keypair, AnchorProvider, Program client
├── jobs/
│   ├── processPayments.ts
│   ├── finalizeCancel.ts
│   └── forceCancel.ts
└── lib/
    ├── chainVerify.ts    — fetch + validate on-chain PDA state
    ├── reporter.ts       — POST to /internal/* with X-Keeper-Key
    └── txBuilder.ts      — build Anchor instructions for each job type
```

---

### `solana.ts`

```
- Connection from env.SOLANA_RPC_URL
- Keypair from env.KEEPER_KEYPAIR (base58 private key)
- AnchorProvider + Program<Recur> from IDL
- Exports: connection, keeperKeypair, program
```

---

### Cron Schedule

| Job               | Frequency   | Purpose                                                    |
| ----------------- | ----------- | ---------------------------------------------------------- |
| `processPayments` | every 1 min | Find due subscriptions, send `process_payment`             |
| `finalizeCancel`  | every 1 min | Find matured pending-cancel subs, send `finalize_cancel`   |
| `forceCancel`     | every 5 min | Check delegations on-chain, send `force_cancel` if revoked |

```ts
cron.schedule("* * * * *", processPayments);
cron.schedule("* * * * *", finalizeCancel);
cron.schedule("*/5 * * * *", forceCancel);
```

---

### `jobs/processPayments.ts`

```
1. Query DB:
   SELECT * FROM subscriptions
   WHERE status = 'ACTIVE' AND next_payment_due <= NOW()
   LIMIT 50   — batch to avoid tx overload

2. For each subscription:
   a. chainVerify.fetchSubscription(onchainPda)
      → if PDA not found: reporter.reportCancelResult(force_cancel) and skip
      → if PDA.cancelRequestedAt > 0: skip (handled by finalizeCancel job)
   b. Verify interval elapsed on-chain (double-check vs DB)
   c. Build process_payment tx:
        subscriber              from PDA
        merchant                from PDA
        subscriber_token_acct   findATA(subscriber, USDC_MINT)
        merchant_token_acct     findATA(merchant, USDC_MINT)
        treasury_vault          findTreasuryVaultPda(PROGRAM_ID)
        treasury_vault_token    findATA(treasury_vault, USDC_MINT)
        mint                    USDC_MINT_DEVNET
        keeper                  keeperKeypair.publicKey
   d. Send + confirm tx (retry up to 3×, 2s delay)
   e. POST /internal/payment-result { status, txSignature, amount, platformFee, subscriptionId }
```

---

### `jobs/finalizeCancel.ts`

```
1. Query DB:
   SELECT s.* FROM subscriptions s
   JOIN plans p ON s.plan_id = p.id
   WHERE s.status = 'PENDING_CANCEL'
   AND s.cancel_requested_at + (p.interval || ' seconds')::interval <= NOW()

2. For each:
   a. chainVerify: confirm cancelRequestedAt > 0 AND interval elapsed on-chain
   b. Build finalize_cancel tx
   c. Send + confirm
   d. POST /internal/cancel-result { type: "finalize_cancel", txSignature, subscriptionId }
```

---

### `jobs/forceCancel.ts`

```
1. Query DB:
   SELECT * FROM subscriptions WHERE status = 'ACTIVE'

2. For each:
   a. Derive subscriber_token_account = findATA(subscriber, USDC_MINT)
   b. getAccount(connection, subscriber_token_account) → parse TokenAccount
   c. Check:
        tokenAccount.delegate === subscription_pda
        tokenAccount.delegatedAmount >= plan.amount
   d. If invalid (revoked, insufficient, or account closed):
        Build force_cancel tx → send → confirm
        POST /internal/cancel-result { type: "force_cancel", txSignature, subscriptionId }
```

---

### `lib/chainVerify.ts`

```ts
fetchSubscription(pda: string): Promise<SubscriptionAccount | null>
  → program.account.subscription.fetchNullable(new PublicKey(pda))

verifyDelegation(
  subscriberTokenAccount: PublicKey,
  subscriptionPda: PublicKey,
  amount: bigint
): Promise<boolean>
  → getAccount(connection, subscriberTokenAccount)
  → return delegate === subscriptionPda && delegatedAmount >= amount
```

---

### `lib/reporter.ts`

```ts
// All functions POST to env.API_URL with header: X-Keeper-Key: env.KEEPER_API_KEY

reportPaymentResult(data: InternalPaymentResultSchema)  → POST /internal/payment-result
reportCancelResult(data: InternalCancelResultSchema)    → POST /internal/cancel-result
```

---

### `lib/txBuilder.ts`

```ts
buildProcessPaymentTx(sub, keeper): TransactionInstruction
buildFinalizeCancelTx(sub, keeper): TransactionInstruction
buildForceCancelTx(sub, keeper):    TransactionInstruction
```

---

## Phase 5 — Package Updates

### `packages/solana-client/src/index.ts`

```
Fix seed order:   [b"subscription", subscriber, merchant]   — must match lib.rs exactly
                  Current code has them swapped (merchant, subscriber)

Add: findTreasuryVaultPda(programId: PublicKey): [PublicKey, number]
     seeds: ["treasury_vault"]

Add: findWithdrawalProposalPda(proposer, nonce, programId): [PublicKey, number]
     seeds: ["withdrawal_proposal", proposer, nonce_le_bytes]

Add: PROGRAM_ID constant (from env or hardcoded for devnet)

Add: IDL type import (generated after `anchor build`)
```

---

### `packages/types/src/index.ts`

```
Update SubscriptionStatus:  add PENDING_CANCEL variant

Add TransactionTypeSchema:     z.enum(["PAYMENT", "FORCE_CANCEL", "FINALIZE_CANCEL"])
Add TransactionStatusSchema:   z.enum(["CONFIRMED", "FAILED"])
Add WebhookEventTypeSchema:    z.enum(["PAYMENT_SUCCESS", "PAYMENT_FAILED",
                                       "SUBSCRIPTION_CANCELLED", "SUBSCRIPTION_PAST_DUE"])
Add PlanSchema (Zod)
Add SubscriptionSchema (Zod)
Add TransactionSchema (Zod)
Add WebhookPayloadSchema (Zod)

Add InternalPaymentResultSchema:  shared between keeper reporter and api internal router
  { subscriptionId, txSignature, status, amount, platformFee, errorMessage? }

Add InternalCancelResultSchema:
  { subscriptionId, txSignature, type: "force_cancel" | "finalize_cancel" }
```

---

### `packages/config/src/index.ts`

```
Add to envSchema:
  KEEPER_KEYPAIR       z.string()              — base58 private key for keeper wallet
  KEEPER_API_KEY       z.string()              — shared secret keeper ↔ api
  API_URL              z.string().url()        — keeper → api base URL
  WEBHOOK_MAX_ATTEMPTS z.coerce.number().default(10)
```

---

### `.env.example` additions

```
# Keeper
KEEPER_KEYPAIR=<base58_private_key>
KEEPER_API_KEY=<random_32_char_secret>
API_URL=http://localhost:3001

# Webhook
WEBHOOK_MAX_ATTEMPTS=10
```

---

## Execution Order

Each step unblocks the next. Do not reorder.

```
Step 1   Fix lib.rs (CPI authority seeds, remove treasury from Subscription, update constraints)
Step 2   Add TreasuryVault + WithdrawalProposal state + all treasury instructions to lib.rs
Step 3   Write Anchor tests (contracts/tests/)
Step 4   anchor build  →  generates IDL in contracts/idl/
Step 5   Expand Prisma schema with all 7 models
Step 6   bun db:migrate  →  applies schema to Postgres
Step 7   Update packages/types (enums, Zod schemas, shared request/response types)
Step 8   Update packages/solana-client (fix seed order, add PDA helpers, import IDL)
Step 9   Update packages/config (add env vars)
Step 10  Build API:
           auth middleware + error handler
           auth.router (nonce, verify)
           merchant.router
           plan.router
           subscriber.router
           subscription.router
           transaction.router
           webhook.router + webhook.worker
           internal.router
           wire everything in index.ts
Step 11  Build Keeper:
           solana.ts
           lib/chainVerify.ts
           lib/txBuilder.ts
           lib/reporter.ts
           jobs/processPayments.ts
           jobs/finalizeCancel.ts
           jobs/forceCancel.ts
           index.ts cron wiring
Step 12  End-to-end smoke test:
           anchor localnet  (local validator)
           bun dev:api
           bun dev:keeper
           SDK call → initialize_subscription → verify DB record created
           wait interval → Keeper fires process_payment → verify Transaction + WebhookJob
```

---

## Skipped (Out of Scope)

- **Platform pro plan / tier-based analytics** — optional, deferred
- **Web frontend changes** — marketing page is complete and untouched
- **Squads / native multisig** — replaced by on-chain proposal model (no external deps)
- **Redis** — nonce storage handled by `AuthNonce` table in Postgres with cleanup cron
