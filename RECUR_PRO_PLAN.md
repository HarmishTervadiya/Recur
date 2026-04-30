# RECUR PRO — Platform Subscription Implementation Plan

## TL;DR

Build a Pro tier ($49/mo USDC) that Recur bills itself with, gating advanced features behind it. Ship in three phases that pause for paying-merchant feedback before continuing:

- **Phase 1 — Tier Infrastructure** (1–2 days)
- **Phase 2 — Recur-on-Recur Billing** (1 day)
- **Phase 3 — CSV Exports** (2–3 days, first gated feature)
- 🛑 **Pause: collect 5–10 paying merchants, gather feedback**
- **Phase 4 — Advanced Analytics** (3–5 days, later)
- **Phase 5 — Multi-team** (3–5 days, later)

---

## Locked-In Decisions

| Topic | Decision |
|---|---|
| Pro v1 features | CSV + Analytics + Multi-team. Drop priority queue. Defer swap to v2. |
| Pricing | $49/mo, $490/yr annual (2 months free), no volume limit, pure feature gate |
| Gating | Backend `requireProTier` middleware (402) + frontend lock UI; backend = source of truth |
| Treasury wallet | New dedicated wallet (clean separation) |
| Platform merchant login | Synthetic record, never logged into |
| Visibility | Hidden from listings + analytics aggregates |
| Sequencing | Phase 1 (tier infra) + Phase 2 (billing) + Phase 3 (CSV) → pause for paying merchants → Phases 4 & 5 later |
| Self-charge resilience | Option 1: accept keeper-down risk; retries + 7-day grace handle it |
| Grace period | 7 days, soft → hard downgrade |
| Billing | Recur-on-Recur, no third-party |

---

## What We Have Already (Massive Head Start)

The exploration surfaced two delightful surprises:

1. **`PlatformPlan`, `PlatformSubscription`, `PlatformTransaction` already exist in the schema** (lines 354–406) — schema scaffolding is done. Zero Prisma additions needed for the core tables; we just add a few fields.
2. **The `subscribe` / `cancel` / `request_cancel` SDK builders are all already exposed in `@recur/sdk`** — Recur-on-Recur subscription flow can use existing builders. Only the keeper's `process_payment` ix isn't in the SDK, but we don't need it; the keeper handles charging.

What's missing:
- No `tier` field on Merchant
- No `subscriptionStatus` / `gracePeriodExpiresAt` on Merchant
- No `subscriptionPda` on `PlatformSubscription` (needed since we're going on-chain)
- No unique constraint on `PlatformSubscription.merchantId`
- No relation from `Merchant` → `PlatformSubscription`
- No middleware, no UI, no seeding for the Recur Platform merchant
- Keeper doesn't process platform subscriptions (currently only processes subscriber→merchant subs)

---

## PHASE 1 — Tier Infrastructure (1–2 days)

### 1.1 Schema Changes

**File:** `packages/db/prisma/schema.prisma`

Add to `Merchant` model:
```prisma
tier                    MerchantTier         @default(free) @map("tier")
subscriptionStatus      SubscriptionStatus?  @map("subscription_status")
gracePeriodExpiresAt    DateTime?            @map("grace_period_expires_at")
platformSubscriptionId  String?              @unique @map("platform_subscription_id")
platformSubscription    PlatformSubscription? @relation(fields: [platformSubscriptionId], references: [id])
```

Add new enum:
```prisma
enum MerchantTier {
  free
  pro
}
```

Add to `PlatformSubscription` model:
```prisma
subscriptionPda  String   @unique @map("subscription_pda")
nextPaymentDue   DateTime @map("next_payment_due")
delegationCycles Int      @default(12) @map("delegation_cycles")
merchant         Merchant?
```

Add unique constraint (`@@unique([merchantId])`) so a merchant can only have one Pro subscription at a time.

Add new event types for webhooks (`EventType` enum):
```prisma
platform_pro_activated
platform_pro_past_due
platform_pro_downgraded
```

### 1.2 Migration

```bash
bun run db:generate
bun run db:migrate -- --name add_merchant_tier_and_pro_subscription_fields
```

The migration is non-destructive — all new fields are nullable or have defaults. Existing merchants become `tier: free`.

### 1.3 Backend Middleware

**New file:** `apps/api/src/middleware/tier.ts`

```ts
export async function requireProTier(req, res, next) {
  // Look up merchant by walletAddress (req.user)
  // Check merchant.tier === 'pro' AND
  //   (merchant.subscriptionStatus === 'active' OR
  //    (merchant.subscriptionStatus === 'past_due' AND
  //     merchant.gracePeriodExpiresAt > now))
  // If yes → next()
  // If no → 402 Payment Required with { code: "PRO_REQUIRED", upgradePath: "/dashboard/settings#recur-pro" }
}
```

This is per-request lookup (not cached in JWT) because tier can change mid-15m-token-lifetime due to grace expiry. The query is one indexed lookup → cheap.

### 1.4 New API Endpoints

In `apps/api/src/modules/merchant/merchant.routes.ts` (or a new file `pro.routes.ts`):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/merchant/me/pro` | Returns `{ tier, status, nextPaymentDue, gracePeriodExpiresAt, currentPeriodEnd, platformPlan }` |
| `POST` | `/merchant/me/pro/subscribe` | Returns the unsigned subscribe transaction (SDK `buildSubscribeTransaction`) for the merchant to sign client-side |
| `POST` | `/merchant/me/pro/cancel` | Returns the unsigned `request_cancel` transaction; on submission, marks `cancelRequestedAt` |
| `POST` | `/merchant/me/pro/confirm` | Called by frontend after submitting the subscribe tx; verifies tx on-chain, creates `PlatformSubscription` row, links to Merchant, sets `tier = pro`, `status = active` |

Modify `GET /merchant/me`:
- Add `tier`, `subscriptionStatus`, `gracePeriodExpiresAt` to response

### 1.5 Frontend Hook & Components

**New file:** `apps/web/src/lib/use-tier.ts`

```ts
export function useTier(): {
  tier: MerchantTier;
  status: SubscriptionStatus | null;
  gracePeriodExpiresAt: Date | null;
  isLoading: boolean;
}
```

Polls `/merchant/me/pro` on mount; refreshes after subscription/cancel actions.

**New file:** `apps/web/src/components/ui/TierGate.tsx`

```tsx
<TierGate fallback={<UpgradeUpsell feature="csv-export" />}>
  <FullCsvExportButton />
</TierGate>
```

**New file:** `apps/web/src/components/ui/UpgradeUpsell.tsx` — the lock-icon + "Upgrade to Pro" CTA used across the app

**New file:** `apps/web/src/components/dashboard/TierBadge.tsx` — small "PRO" or "FREE" badge for sidebar

### 1.6 Sidebar Tier Badge

**Edit:** `apps/web/src/components/dashboard/DashboardSidebar.tsx`

Below wallet display, above Sign Out, add:
```tsx
<TierBadge />
{tier === 'free' && <UpgradeButton />}
```

### 1.7 Settings Page Section

**Edit:** `apps/web/src/app/dashboard/settings/page.tsx`

Add a third `<section>` after API Keys:
- "Recur Pro Subscription"
- Free state: feature list + "Upgrade — $49/mo USDC" button → opens subscribe modal
- Active state: status badge, next payment date, "Cancel Subscription" button (uses existing Modal pattern)
- Past-due state: red banner with grace period countdown, "Top up wallet" copy + Solana Explorer link

---

## PHASE 2 — Recur-on-Recur Billing (1 day)

### 2.1 Seed the Recur Platform Merchant

**New file:** `scripts/seed-platform-merchant.ts`

Idempotent (checks for existence by walletAddress before inserting). Creates:
1. **Recur Platform merchant** — name `"Recur Platform"`, walletAddress = `RECUR_PLATFORM_WALLET` env var, never logged into
2. **Recur Platform app** — name `"Recur Platform"`
3. **Pro plan** — `name: "Recur Pro"`, `amountBaseUnits: 49_000_000n` (49 USDC × 6 decimals), `intervalSeconds: 2_592_000` (30 days), `currency: "USDC"`
4. **Annual plan** — `name: "Recur Pro Annual"`, `amountBaseUnits: 490_000_000n`, `intervalSeconds: 31_536_000`

Stores the resulting `appId` and `planSeed` values in `GlobalConfig` so the API and frontend can look them up:
- `platform.appId`
- `platform.proPlanId`
- `platform.proPlanSeed`
- `platform.annualPlanId`
- `platform.annualPlanSeed`

Add to `package.json`:
```json
"seed:platform": "bun run scripts/seed-platform-merchant.ts"
```

### 2.2 New Env Vars

**Edit:** `packages/config/src/index.ts`

```ts
RECUR_PLATFORM_WALLET: z.string().optional(),  // base58 wallet address
RECUR_PLATFORM_TREASURY_ATA: z.string().optional(),  // mock USDC ATA on devnet
RECUR_PRO_GRACE_DAYS: z.coerce.number().default(7),
RECUR_PRO_PRICE_BASE_UNITS: z.coerce.number().default(49_000_000),
```

For dev: auto-generate a keypair on first seed run, persist to `.env` via existing `upsertEnv` helper pattern. For prod: requires explicit env var.

### 2.3 Frontend Subscribe Flow

In settings Pro section:

1. User clicks "Upgrade to Pro"
2. Modal explains: "$49/mo USDC, charged from your wallet. Cancel anytime."
3. User confirms → frontend calls `POST /merchant/me/pro/subscribe` to get unsigned tx
4. Wallet adapter signs and submits the tx
5. Frontend calls `POST /merchant/me/pro/confirm` with the tx signature
6. Backend verifies tx on-chain, creates `PlatformSubscription`, sets `Merchant.tier = pro`, returns success
7. Frontend shows success toast, refreshes tier, badge flips to PRO

The "subscribe" here is **the existing on-chain `subscribe` instruction** — Recur Platform is just another merchant in the system; the merchant subscribing to Pro is just another subscriber. Zero new on-chain code.

### 2.4 Keeper Charges the Platform Subscription

The keeper currently queries:
```ts
prisma.subscription.findMany({
  where: { status: 'active', nextPaymentDue: { lte: now } }
})
```

**Decision: Reuse `Subscription` table (Option A).** Recur Platform is just another merchant. When a merchant subscribes to Pro, it creates:
- A row in `Subscription` (pointing to Recur Platform's Pro plan)
- A linked row in `PlatformSubscription` for tier-tracking convenience

Then the keeper picks up the `Subscription` row like any other, no special-case code. The `PlatformSubscription` row exists for analytics/reporting only.

For Phase 2: `Subscription` row drives the keeper, `PlatformSubscription` row mirrors for analytics, both rows update together.

### 2.5 Webhook Handler Updates `Merchant.tier`

**Edit:** `apps/api/src/modules/webhook/keeper.routes.ts`

When `POST /keeper/payment` fires for a subscription whose plan belongs to the Recur Platform app:
1. Look up the merchant who owns the subscriber wallet (subscriber → wallet → Merchant)
2. Set `merchant.subscriptionStatus = 'active'`
3. Set `merchant.tier = 'pro'`
4. Update `currentPeriodEnd`, clear `gracePeriodExpiresAt`
5. Fire `platform_pro_activated` event for our own analytics

When `POST /keeper/payment-failed` fires for the same:
1. Mark `merchant.subscriptionStatus = 'past_due'`
2. Set `merchant.gracePeriodExpiresAt = now + 7 days`
3. Keep `merchant.tier = 'pro'` (soft downgrade)
4. Fire `platform_pro_past_due` event
5. Send email (deferred — not in v1; just a TODO comment)

When `cancel_finalized` fires:
1. `merchant.tier = 'free'`
2. `merchant.subscriptionStatus = 'cancelled'`
3. Fire `platform_pro_downgraded`

### 2.6 Daily Grace-Period Expiry Job

**New file:** `apps/keeper/src/jobs/expirePlatformGrace.ts`

Cron schedule: `0 */6 * * *` (every 6 hours; doesn't need to be exact-daily).

```ts
const expired = await prisma.merchant.findMany({
  where: {
    subscriptionStatus: 'past_due',
    gracePeriodExpiresAt: { lte: new Date() }
  }
});
for (const m of expired) {
  await prisma.merchant.update({
    where: { id: m.id },
    data: { tier: 'free', subscriptionStatus: 'expired' }
  });
  await fireWebhook('platform_pro_downgraded', m.id);
}
```

Register in `apps/keeper/src/index.ts` next to existing `cron.schedule(...)` blocks.

### 2.7 Frontend "Manage Pro" UI

In settings page Pro section, when active:
- "Recur Pro" badge
- Next charge: `Apr 29, 2026 ($49 USDC)`
- "Cancel Subscription" button → uses existing Modal pattern (mirroring API key revoke confirmation flow)
- On cancel: hits `/merchant/me/pro/cancel`, gets unsigned `request_cancel` tx, signs and submits via wallet
- Banner explains: "Your Pro features remain active until the end of your current billing period (Apr 29, 2026)."

---

## PHASE 3 — CSV Exports (2–3 days, first gated feature)

### 3.1 New Endpoints

| Method | Path | Tier | Purpose |
|---|---|---|---|
| `GET` | `/merchant/exports/transactions.csv?since=&until=` | Free (last 30 days only) / Pro (any range) | Stream CSV of `MerchantTransaction` rows |
| `GET` | `/merchant/exports/subscriptions.csv?since=&until=` | Free / Pro | Stream CSV of `Subscription` rows |
| `GET` | `/merchant/exports/subscribers.csv?since=&until=` | Free / Pro | Stream CSV of `Subscriber` rows that subscribed to merchant's plans |

Free tier: server-side enforces `since >= now - 30 days`. If user requests older, returns 402 with `code: "PRO_REQUIRED"`.

Pro tier: `requireProTier` middleware applied; full history available.

### 3.2 CSV Format (Stripe-compatible columns)

Mirror Stripe's export schema for easy migration story:

**transactions.csv:**
```
id,created,amount_gross,platform_fee,amount_net,currency,subscription_id,subscriber_wallet,merchant_wallet,tx_signature,status
```

**subscriptions.csv:**
```
id,created,plan_id,plan_name,subscriber_wallet,status,next_payment_due,last_payment_at,cancelled_at
```

**subscribers.csv (every subscriber ever, with current_status column):**
```
wallet_address,name,email,first_subscribed_at,total_subscriptions,total_paid_base_units,current_status
```

### 3.3 Implementation

**New file:** `apps/api/src/modules/merchant/exports.routes.ts`

Use `stringify` from `csv-stringify` (need to add: `bun add csv-stringify -p @recur/api`). Stream rows via `res.write(...)` to avoid loading entire history into memory for large merchants.

Pagination via `prisma.findMany` with cursor; flush after each batch.

Headers:
```ts
res.setHeader('Content-Type', 'text/csv; charset=utf-8');
res.setHeader('Content-Disposition', `attachment; filename="recur-transactions-${date}.csv"`);
```

### 3.4 Frontend UI

**Edit:** `apps/web/src/app/dashboard/apps/[appId]/_components/TransactionsTab.tsx`

Add a button group above the table:
- Free tier: "Export Last 30 Days (CSV)" — works
- Pro tier: "Export All History (CSV)" + "Export Subscribers (CSV)" + "Export Subscriptions (CSV)"
- For free users hovering on disabled "All History" option: tooltip "Pro feature — Upgrade to export full history"

**New file (optional):** `apps/web/src/app/dashboard/exports/page.tsx`

Consolidated exports page. Shows three large cards: Transactions, Subscriptions, Subscribers. Date range picker. Free shows lock on extended range.

### 3.5 (Deferred to v1.1) Scheduled Monthly Email

Pro feature: every month, email merchant a CSV bundle of last month's transactions. Requires:
- Sender service (Resend? SES?) — **TBD**, not in v1
- Cron job in keeper or new email worker
- Per-merchant email preference (already have `merchant.email` field)

For Pro v1, the manual "Export" button is sufficient. Add a TODO and revisit after seeing if anyone asks.

---

## 🛑 PAUSE POINT

**After Phase 3 ships:**
1. Soft-launch Pro tier to existing merchants (quiet launch — only dashboard CTA, no surprise email)
2. Aim for 5–10 paying merchants
3. Watch which features they request next
4. Validate $49 price point — willingness to pay, churn rate, feature usage

**Decision points before resuming:**
- Are merchants asking for analytics first or multi-team first? (Order of Phase 4 vs 5)
- Is $49 the right number? (Sticker shock? Too cheap?)
- Any features I haven't predicted that come up in feedback?

---

## PHASE 4 — Advanced Analytics (3–5 days, Pro-gated)

(Brief sketch — full plan to be revised after Phase 3 feedback.)

### 4.1 Endpoints
- `GET /merchant/analytics/mrr` — MRR over time, with growth rate
- `GET /merchant/analytics/churn` — voluntary + involuntary churn rate by month
- `GET /merchant/analytics/ltv` — average revenue per subscriber, distribution
- `GET /merchant/analytics/cohort` — retention by subscribe-month cohort

All gated by `requireProTier`.

### 4.2 Computation
- Most queries already feasible from `Subscription` + `MerchantTransaction` tables
- Some require aggregation on history; consider materialized views or a daily cron job to pre-compute `analytics_daily_snapshots` table
- For v1: compute on-request with reasonable caching headers

### 4.3 Frontend
- New `apps/web/src/app/dashboard/analytics/page.tsx`
- Charts via `recharts` (lightweight, ~30KB) or hand-rolled SVG
- Free tier sees "preview" — shows MRR widget only, blurred, with upgrade CTA

---

## PHASE 5 — Multi-team (3–5 days, Pro-gated)

(Brief sketch — full plan to be revised after Phase 3 feedback.)

### 5.1 Schema additions
```prisma
model TeamMember {
  id            String     @id @default(cuid())
  merchantId    String
  walletAddress String
  role          TeamRole   @default(viewer)
  invitedAt     DateTime   @default(now())
  acceptedAt    DateTime?
  @@unique([merchantId, walletAddress])
}

model TeamInvite {
  id            String    @id @default(cuid())
  merchantId    String
  email         String?
  walletAddress String?
  role          TeamRole
  token         String    @unique
  expiresAt     DateTime
  acceptedAt    DateTime?
}

enum TeamRole {
  owner
  admin
  developer  // can manage API keys, webhooks
  viewer     // read-only dashboard access
}
```

### 5.2 Auth changes
- JWT now needs `merchantId` claim (the merchant being acted on, not just wallet)
- New middleware `requireTeamRole(['owner', 'admin'])` for protected endpoints
- Refactor existing routes to check team membership instead of direct ownership

### 5.3 Major refactor warning
Multi-team is the most invasive phase. Every existing merchant route needs to refactor from "is this merchant's wallet the owner?" to "is this user a team member of this merchant with sufficient role?" — this could touch 20+ files.

**Recommendation:** When we get to Phase 5, do a separate planning round.

---

## Cross-Cutting Concerns

### Test Strategy
- **Unit:** `requireProTier` middleware (active/past_due/grace/expired states)
- **Integration:** subscribe → confirm → tier becomes PRO; charge fails → past_due → grace expires → tier becomes FREE
- **E2E manual:** localnet seed creates one Pro merchant + one Free merchant; smoke test both can/can't access CSV export

### Demo / Localnet Updates
**Edit:** `scripts/demo-seed.ts` and `scripts/seed-localnet.ts`
- Run `seed:platform` first to create Recur Platform merchant
- Optionally subscribe one demo merchant to Pro at the end so the demo dashboard shows both tier states

### Webhook Payload Updates
Add to outgoing webhook payloads (subscriber→merchant ones, not platform-internal):
- No changes needed for Pro v1 — Pro is internal to Recur, doesn't affect customer-facing webhooks

### Logging / Observability
- Pino log line on every tier transition: `merchant.id, old_tier, new_tier, reason`
- Pino log line on every grace period entry/expiry
- Counter for active Pro merchants, exposed at internal `/admin/stats` route (deferred to later)

### Edge Cases Considered
1. **Merchant cancels Pro and re-subscribes same day**: existing Subscription row may still be `active` until `cancel_finalized`. Re-subscribe creates a new Subscription row + new PlatformSubscription. Old one transitions to `cancelled`.
2. **Grace period expires while a charge is mid-flight**: keeper's atomic state transition (`past_due` → success → `active`) takes precedence over grace expiry. Daily expiry job re-queries `subscriptionStatus = 'past_due'` so a mid-flight charge that succeeds will already have flipped the status.
3. **Webhook delivery to platform self-fires**: when our own subscription succeeds, our webhook fires too (Recur Platform is also a merchant with webhooks). To avoid weird recursion, the platform merchant should have **no webhooks configured**.
4. **Keeper down for >7 days**: All Pro merchants whose grace expired during that time get downgraded next time keeper runs. Acceptable; we said Option 1.
5. **Treasury wallet is empty / can't receive USDC**: charges land in treasury PDA; we just need to make sure `RECUR_PLATFORM_TREASURY_ATA` exists for the mint we're using. Seed script ensures this.

### Devnet Smoke Test Plan
1. Run `bun run db:migrate -- --name ...` (Phase 1.2)
2. Run `bun run seed:platform`
3. Restart API + keeper
4. Open dashboard for an existing test merchant
5. Click "Upgrade to Pro" → sign tx → confirm tier flips to PRO
6. Wait 30 days … or manually nudge `nextPaymentDue` to past for testing
7. Keeper picks up next charge → verify `MerchantTransaction` row created, `PlatformTransaction` row created, period extends 30 days
8. Manually drain test wallet's USDC → keeper next charge fails → verify `subscriptionStatus = past_due`, banner appears in dashboard
9. Manually nudge `gracePeriodExpiresAt` to past → wait for cron tick → verify tier flips to free

---

## Files Touched Summary

### Created
- `packages/db/prisma/migrations/<timestamp>_add_merchant_tier.../migration.sql` (auto-generated)
- `apps/api/src/middleware/tier.ts`
- `apps/api/src/modules/merchant/pro.routes.ts`
- `apps/api/src/modules/merchant/exports.routes.ts`
- `apps/keeper/src/jobs/expirePlatformGrace.ts`
- `apps/web/src/lib/use-tier.ts`
- `apps/web/src/components/ui/TierGate.tsx`
- `apps/web/src/components/ui/UpgradeUpsell.tsx`
- `apps/web/src/components/dashboard/TierBadge.tsx`
- `scripts/seed-platform-merchant.ts`
- `RECUR_PRO_PLAN.md` (this document)

### Edited
- `packages/db/prisma/schema.prisma`
- `packages/config/src/index.ts`
- `apps/api/src/modules/merchant/merchant.routes.ts` (`/merchant/me` returns tier fields)
- `apps/api/src/modules/webhook/keeper.routes.ts` (handle platform-app webhooks)
- `apps/api/src/index.ts` (register pro.routes + exports.routes)
- `apps/keeper/src/index.ts` (register expirePlatformGrace cron)
- `apps/web/src/app/dashboard/settings/page.tsx` (Pro section)
- `apps/web/src/components/dashboard/DashboardSidebar.tsx` (TierBadge + Upgrade button)
- `apps/web/src/app/dashboard/apps/[appId]/_components/TransactionsTab.tsx` (export buttons)
- `scripts/demo-seed.ts` (run platform seed first)
- `package.json` (add `seed:platform` script)
- `apps/api/package.json` (add `csv-stringify` dependency)

---

## Resolved Open Questions

| # | Question | Resolution |
|---|---|---|
| 1 | Pricing tiers offered | Both: $49/mo + $490/yr annual |
| 2 | Recur Platform wallet on devnet | Auto-generate keypair in seed script (persist to `.env`); explicit env var required for prod |
| 3 | First-launch UX for existing merchants | Quiet launch — only dashboard CTA, no surprise email |
| 4 | CSV "subscribers" export scope | Every subscriber ever, with `current_status` column |
| 5 | PlatformSubscription mirroring | Option A: keep both `Subscription` and `PlatformSubscription` rows (denormalized) |
| 6 | CSV export library | `csv-stringify` |

---

## Execution Order (When Starting Build)

1. **Phase 1.1–1.2**: Schema delta + migration. Verify `bun run db:generate` clean and Prisma client regenerated.
2. **Phase 1.3–1.4**: `tier.ts` middleware + `pro.routes.ts` endpoints. Smoke test 402 path with manual `tier=free` merchant.
3. **Phase 1.5–1.7**: Frontend hook, `TierGate`, `TierBadge`, settings section. Verify free state displays correctly.
4. **Phase 2.1–2.2**: Seed script + env vars. Run `bun run seed:platform`. Verify `GlobalConfig` populated.
5. **Phase 2.3**: Frontend subscribe flow. Manually subscribe a test merchant to Pro on localnet. Verify `tier` flips.
6. **Phase 2.4–2.6**: Keeper + webhook handler + grace cron. Force a payment failure; verify past_due → grace → expired transitions.
7. **Phase 2.7**: "Manage Pro" UI. Verify cancel flow.
8. **Phase 3.1–3.4**: CSV exports. Add `csv-stringify` dep, build endpoints, gate with `requireProTier`, frontend buttons.
9. **Phase 3 sign-off**: Manual smoke test on devnet, deploy.

🛑 **Pause for paying-merchant feedback.**
