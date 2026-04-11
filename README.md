# Recur — AutoPay Protocol

> Stripe for Solana. Decentralised, automated recurring billing for Web3 SaaS, games, and DAOs.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-fbf0df)](https://bun.sh)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-EF4444)](https://turbo.build)
[![Anchor](https://img.shields.io/badge/Smart%20Contracts-Anchor-512DA8)](https://anchor-lang.com)

---

## The problem

Web3 subscriptions today require one of two painful tradeoffs:

- **Manual signing** — users must approve a transaction every 30 days, causing massive churn when they miss it.
- **Escrow lockup** — capital is locked upfront, creating friction and trust issues.

## The solution

Recur introduces the **Smart Allowance Model**. A subscriber signs a single SPL Token `Approve` transaction, granting a time-locked smart contract the right to pull a fixed amount at a fixed interval. Their capital stays liquid in their wallet. An off-chain Keeper automates the monthly pull — no repeated signing, no lockup.

```
Subscriber grants allowance once
        │
        ▼
Anchor PDA enforces billing interval (e.g. every 30 days)
        │
        ▼
Keeper checks pre-flight → sends process_payment CPI
        │
        ▼
Merchant receives USDC + webhook notification
```

---

## Monorepo structure

```
recur/
├── apps/
│   ├── web/          # Next.js 14 merchant dashboard
│   ├── api/          # Node.js + Express REST server
│   └── keeper/       # Bun automation worker (cron + tx retry)
├── packages/
│   ├── sdk/          # @recur/sdk — <RecurButton /> npm package
│   ├── db/           # @recur/db — Prisma schema + client
│   ├── types/        # @recur/types — Zod schemas + shared types
│   ├── solana-client/# @recur/solana-client — RPC + IDL helpers
│   ├── logger/       # @recur/logger — Pino structured logging
│   └── config/       # Shared ESLint, TypeScript, Tailwind configs
└── contracts/        # Rust + Anchor smart contracts
    └── programs/recur/
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS |
| Backend API | Node.js, Express.js, Zod |
| Keeper worker | Bun runtime |
| Database | PostgreSQL + Prisma ORM |
| Smart contracts | Rust, Anchor framework |
| Monorepo | Turborepo + Bun workspaces |

---

## Quick start

See [SETUP.md](SETUP.md) for the full environment setup guide.

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env

# Start all services in development
bun run dev
```

---

## How it works

### On-chain (Anchor smart contract)

The `recur` program manages `Subscription` PDAs — one per merchant/subscriber pair. Each PDA stores the billing amount, interval, and last payment timestamp. The contract enforces exact interval timing with a ~60-second clock drift buffer.

**Instructions:**

| Instruction | Who calls it | What it does |
|---|---|---|
| `initialize` | Merchant | Creates the Subscription PDA, subscriber grants SPL allowance |
| `process_payment` | Keeper | CPIs into SPL Token to pull `amount` USDC if interval has elapsed |
| `cancel` | Subscriber or merchant | Closes the PDA, refunds 0.002 SOL rent to merchant |
| `force_cancel` | Keeper | Fires when delegation is revoked; closes PDA and emits webhook |

### Off-chain (Keeper)

The Keeper runs on a cron schedule and for each active subscription:

1. **Pre-flight balance check** — subscriber has ≥ `amount` USDC.
2. **Pre-flight delegation check** — SPL allowance ≥ `amount`. If revoked, fires `force_cancel`.
3. **Interval check** — `now >= last_payment_ts + interval`.
4. **Send tx** — builds and signs `process_payment` instruction with dynamic priority fees.
5. **Retry on congestion** — exponential backoff if transaction is dropped.

### Webhooks

Merchants register webhook URLs in the dashboard. The API dispatches signed webhook events after every state change:

```json
{
  "event": "payment.success",
  "subscription": "8xKf...",
  "merchant": "3mPq...",
  "subscriber": "7nRt...",
  "amount": 5000000,
  "timestamp": 1712000000
}
```

---

## SDK usage (for merchant integrations)

```tsx
import { RecurButton } from '@recur/sdk';

export default function PricingPage() {
  return (
    <RecurButton
      planId="plan_monthly_pro"
      merchantAddress="3mPq..."
      amount={5_000_000}        // 5 USDC in lamports
      interval={2592000}        // 30 days in seconds
      onSuccess={(sub) => console.log('Subscribed:', sub)}
    />
  );
}
```

Three lines of code. The component handles wallet connection, SPL token approval, and PDA initialisation.

---

## Gas economics

The Keeper pays SOL to execute transactions. To avoid spending gas on doomed transactions:

- **Pre-flight checks** skip transactions when the subscriber's balance or delegation is invalid.
- **Gas Tank** — merchants fund a small SOL deposit (~0.002 per subscription) at plan creation. This covers rent for the Subscription PDA and is refunded in full when the subscription is cancelled.

**Platform fees:**
- 0.25% of each successful payment
- $0.05 per Keeper execution (covers gas costs)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

---

## License

MIT — see [LICENSE](LICENSE).

---

*Built for the Solana Colosseum Frontier Hackathon by Harmis Tervadiya & team.*
