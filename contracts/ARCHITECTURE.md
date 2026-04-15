# Recur — Smart Contract Architecture

> Decentralised recurring billing on Solana.
> One `Approve` signature from the user. The rest is automatic.

---

## Table of Contents

1. [Overview](#overview)
2. [Repository Layout](#repository-layout)
3. [Core Concept](#core-concept)
4. [On-Chain State](#on-chain-state)
5. [PDA Derivation](#pda-derivation)
6. [Instructions](#instructions)
7. [Subscription Lifecycle](#subscription-lifecycle)
8. [Cancellation Flow](#cancellation-flow)
9. [Security Model](#security-model)
10. [Error Reference](#error-reference)
11. [Dependencies](#dependencies)

---

## Overview

Recur is a Solana program (built with Anchor 0.30) that allows a merchant to
collect recurring SPL token payments from a subscriber without requiring the
subscriber to sign every transaction.

The mechanism mirrors a traditional direct-debit:

1. Subscriber signs a single SPL Token `Approve`, delegating up to
   `amount × N` tokens to their own wallet (the authority the program uses).
2. An off-chain **Keeper** watches every active `Subscription` PDA and calls
   `process_payment` once per billing interval.
3. Cancellation — by either party — is recorded on-chain as a flag. The PDA
   is only closed after the already-paid period has elapsed, ensuring the
   subscriber always receives the service they paid for.

---

## Repository Layout

```
contracts/
├── Anchor.toml                  # Anchor workspace config (devnet)
├── Cargo.toml                   # Workspace manifest
├── programs/
│   └── recur/
│       ├── Cargo.toml           # Crate manifest + dependencies
│       └── src/
│           └── lib.rs           # Entire program: instructions, accounts, state, errors
├── idl/                         # Generated IDL (populated after `anchor build`)
└── tests/                       # Integration tests (ts-mocha)
```

---

## Core Concept

```
┌─────────────────────────────────────────────────────────────────┐
│                        RECUR PROTOCOL                           │
│                                                                 │
│   Subscriber                Keeper (off-chain)       Merchant   │
│       │                           │                     │       │
│       │── SPL Approve ──────────► │                     │       │
│       │                           │                     │       │
│       │── initialize_subscription ┼─────────────────────┤       │
│       │   (both sign once)        │                     │       │
│       │                           │                     │       │
│       │          every interval   │                     │       │
│       │                    ┌──────┴──────┐              │       │
│       │                    │  process_   │              │       │
│       │◄─── USDC pulled ───│  payment   │──► USDC ─────►│       │
│       │                    └──────┬──────┘              │       │
│       │                           │                     │       │
│       │                    (repeat until cancelled)     │       │
└─────────────────────────────────────────────────────────────────┘
```

The Keeper never holds funds. It only constructs and signs `process_payment`
transactions. The CPI into SPL Token validates the subscriber's delegation;
if the delegation was revoked, the CPI fails and `force_cancel` is called.

---

## On-Chain State

A single account type, `Subscription`, is stored as a PDA per
subscriber–merchant pair.

```
Subscription account  (8 + 113 bytes)
┌──────────────────────────┬──────────┬────────────────────────────────────┐
│ Field                    │ Type     │ Description                        │
├──────────────────────────┼──────────┼────────────────────────────────────┤
│ subscriber               │ Pubkey   │ Wallet being charged               │
│ merchant                 │ Pubkey   │ Wallet receiving funds             │
│ amount                   │ u64      │ Token base-units per interval      │
│ interval                 │ u64      │ Seconds between pulls              │
│ last_payment_timestamp   │ u64      │ Unix ts of last successful pull    │
│ created_at               │ u64      │ Unix ts of PDA creation            │
│ cancel_requested_at      │ u64      │ 0 = active, >0 = cancel pending ts │
│ bump                     │ u8       │ Canonical PDA bump seed            │
└──────────────────────────┴──────────┴────────────────────────────────────┘
```

**`cancel_requested_at` semantics**

```
0          → subscription is active
timestamp  → cancel has been requested; PDA is pending closure
             process_payment is still allowed until
             cancel_requested_at + interval has elapsed
```

---

## PDA Derivation

```
seeds = [ "subscription" | subscriber pubkey | merchant pubkey ]
```

```
PDA address = find_program_address(
    ["subscription", subscriber, merchant],
    program_id
)
```

One PDA per unique (subscriber, merchant) pair. A subscriber can have
concurrent subscriptions to different merchants, each with its own PDA.

---

## Instructions

### `initialize_subscription(amount, interval)`

Creates the `Subscription` PDA.

```
Signers  : subscriber, merchant
Payer    : merchant (pays ~0.002 SOL rent)
Validates: amount > 0, interval > 0
Sets     : all fields; cancel_requested_at = 0
           last_payment_timestamp = now
           (first pull available after interval seconds)
```

```
 subscriber ──signs──┐
                     ├──► [Subscription PDA created]
   merchant ──signs──┘         seeds: ["subscription", sub, mer]
   merchant ──pays rent────────►
```

---

### `process_payment`

Pulls `amount` tokens from subscriber → merchant via CPI `transfer_checked`.

```
Signer   : keeper (off-chain worker)
Validates:
  1. now >= last_payment_timestamp + interval      (time-lock)
  2. if cancel_requested_at > 0:
       now < cancel_requested_at + interval        (cancel guard)
  3. subscriber_token_account.owner == subscriber  (substitution)
  4. subscriber_token_account.mint  == mint        (mint check)
  5. merchant_token_account.owner   == merchant    (substitution)
  6. merchant_token_account.mint    == mint        (mint check)
Updates  : last_payment_timestamp = now
```

```
 keeper ──signs──► process_payment
                        │
                        │ CPI: transfer_checked
                        ▼
  [subscriber token account] ──amount──► [merchant token account]
         (delegation validates allowance via SPL Token)
```

---

### `request_cancel`

Sets the cancellation flag. Does **not** close the PDA.

```
Signer   : subscriber OR merchant
Validates: authority == subscription.subscriber
                     OR subscription.merchant
           cancel_requested_at == 0  (idempotency — prevents clock reset)
Sets     : cancel_requested_at = now
```

```
subscriber ──OR── merchant ──signs──► request_cancel
                                            │
                                            ▼
                              [cancel_requested_at = now]
                              PDA stays open; Keeper continues
                              to collect the final paid period
```

---

### `finalize_cancel`

Closes the PDA once the paid period has elapsed. **Permissionless.**

```
Signer   : none required (anyone can call)
Validates:
  1. cancel_requested_at > 0          (cancel was requested)
  2. now >= last_payment_timestamp + interval  (paid period elapsed)
Action   : close PDA → rent returned to merchant
```

```
[anyone] ──calls──► finalize_cancel
                          │
                    checks conditions
                          │
                          ▼
              [Subscription PDA closed]
              rent ──────────────────► merchant (Gas Tank)
```

---

### `force_cancel`

Immediate close by the Keeper when delegation is revoked or wallet is empty.
Skips the paid-period cooldown because no future payment is possible.

```
Signer : keeper
Action : close PDA immediately → rent to merchant
         Keeper fires subscription.canceled webhook off-chain
```

---

## Subscription Lifecycle

```
                        ┌─────────────────────────────────┐
                        │         SUBSCRIPTION             │
                        │                                  │
     initialize         │  cancel_requested_at = 0         │
     ─────────────────► │  (ACTIVE)                        │
                        │                                  │
                        └──────────┬──────────────┬────────┘
                                   │              │
                          interval │              │ request_cancel
                          elapsed  │              │ (sub or merchant)
                                   ▼              ▼
                        ┌──────────────┐  ┌────────────────────┐
                        │ process_     │  │ cancel_requested    │
                        │ payment      │  │ _at > 0             │
                        │ (Keeper CPI) │  │ (PENDING CANCEL)    │
                        └──────┬───────┘  └────────┬───────────┘
                               │                   │
                               │ updates            │ interval elapses
                               │ last_payment_ts    │ OR delegation revoked
                               │                   ▼
                               │          ┌─────────────────────┐
                               │          │ finalize_cancel      │
                               │          │ (permissionless)     │
                               │          │    ── OR ──          │
                               │          │ force_cancel         │
                               │          │ (Keeper only)        │
                               │          └────────┬────────────┘
                               │                   │
                               ▼                   ▼
                        ┌──────────────────────────────────┐
                        │      PDA CLOSED                  │
                        │  rent returned to merchant       │
                        └──────────────────────────────────┘
```

---

## Cancellation Flow

The two-step design (request → finalize) solves the race condition where a
merchant collects a payment and then immediately cancels, denying the
subscriber the service they paid for.

```
Timeline example  (interval = 30 days)

Day  0 ──► initialize_subscription
           last_payment_timestamp = Day 0

Day 30 ──► process_payment
           last_payment_timestamp = Day 30
           (subscriber has paid for Day 30–60)

Day 35 ──► request_cancel  (merchant decides to stop)
           cancel_requested_at = Day 35
           PDA stays open

Day 35–60 ► process_payment ALLOWED
            (cancel_requested_at + interval = Day 65 > now)
            If interval has elapsed (Day 60+) and cancel flag set,
            process_payment is BLOCKED (SubscriptionCancelled)

Day 60+ ──► finalize_cancel (anyone)
            now >= last_payment_timestamp(30) + interval(30) = Day 60 ✓
            cancel_requested_at > 0 ✓
            PDA closed, rent returned

```

```
                force_cancel path (delegation revoked)

Day 35 ──► Keeper detects DelegationRevoked on process_payment attempt
Day 35 ──► force_cancel called immediately
           PDA closed, webhook fired
           (no cooldown — no future payment is possible)
```

---

## Security Model

| Threat                                | Mitigation                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Keeper double-dips**                | `last_payment_timestamp` updated atomically after CPI; `BillingIntervalNotReached` blocks early re-entry |
| **Merchant steals payment + cancels** | `request_cancel` only sets a flag; `finalize_cancel` blocked until paid period elapses                   |
| **Account substitution**              | `has_one = subscriber`, `has_one = merchant` on every PDA constraint                                     |
| **Fake token account**                | `constraint = *.owner == *`, `constraint = *.mint == mint.key()` on both token accounts                  |
| **Mint-swap attack**                  | `transfer_checked` (not `transfer`) validates mint address and decimals in SPL Token                     |
| **Revoked delegation**                | CPI failure mapped to `DelegationRevoked`; Keeper calls `force_cancel`                                   |
| **Cancel clock reset**                | `CancelAlreadyRequested` blocks overwriting an existing `cancel_requested_at`                            |
| **u64 timestamp overflow**            | All additions use `saturating_add`                                                                       |
| **Wrong rent destination**            | `has_one = merchant` ties the `close =` target to PDA state                                              |
| **Unauthorized cancellation**         | `authority` checked against `subscription.subscriber` or `subscription.merchant` at runtime              |
| **Stale bump**                        | Canonical bump stored in PDA; all post-init contexts use `bump = subscription.bump`                      |

---

## Error Reference

| Code | Name                        | Meaning                                                |
| ---- | --------------------------- | ------------------------------------------------------ |
| 6000 | `InvalidAmount`             | `amount` must be > 0                                   |
| 6001 | `InvalidInterval`           | `interval` must be > 0                                 |
| 6002 | `BillingIntervalNotReached` | Too early to pull; interval not elapsed                |
| 6003 | `UnauthorizedCancellation`  | Signer is neither subscriber nor merchant              |
| 6004 | `DelegationRevoked`         | SPL Token CPI failed — allowance revoked or zero       |
| 6005 | `InvalidTokenAccountOwner`  | Token account owner mismatch                           |
| 6006 | `InvalidMint`               | Token account mint mismatch                            |
| 6007 | `CancelAlreadyRequested`    | Cancel flag already set; cannot reset the clock        |
| 6008 | `NoCancelRequested`         | `finalize_cancel` called with no pending cancel        |
| 6009 | `PaidPeriodNotElapsed`      | Too early to finalize; subscriber still in paid window |
| 6010 | `SubscriptionCancelled`     | Cancel matured; no further payments allowed            |

---

## Dependencies

| Crate         | Version | Role                                                       |
| ------------- | ------- | ---------------------------------------------------------- |
| `anchor-lang` | 0.30.1  | Program framework, account macros, CPI helpers             |
| `anchor-spl`  | 0.30.1  | SPL Token CPI (`transfer_checked`, `TokenAccount`, `Mint`) |

**Toolchain**

```
anchor-cli  0.30.x
solana-cli  1.18.x
rustc       stable (edition 2021)
cluster     devnet
```

**Build**

```bash
cd contracts
anchor build          # compiles + generates IDL in idl/
anchor deploy         # deploys to devnet, updates Anchor.toml program ID
anchor test           # runs tests/ suite via ts-mocha
```
