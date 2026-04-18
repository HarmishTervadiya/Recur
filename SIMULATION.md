# Recur — Local Simulation Guide

Run the full Recur protocol locally: smart contract, API, keeper daemon, and automated payments on a Solana test validator.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| WSL 2 | — | All Solana/Rust/Anchor commands run in WSL |
| Rust | 1.94+ | `rustup update` inside WSL |
| Solana CLI | 3.1+ | `solana --version` |
| Anchor CLI | 0.32+ | `anchor --version` |
| Node.js | 20+ | Via nvm inside WSL |
| Bun | 1.1+ | Windows only — `C:\Users\<you>\.bun\bin\bun.exe` |
| Docker | — | For PostgreSQL |

## 1. Start PostgreSQL

```bash
docker run -d --name recur-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=recur \
  -p 5432:5432 \
  postgres:16-alpine
```

If already running: `docker start recur-postgres`

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — set at minimum:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recur
SOLANA_RPC_URL=http://localhost:8899
JWT_SECRET=any-local-secret
KEEPER_SECRET=localnet-keeper-secret
API_URL=http://localhost:3001
PORT=3001
```

Leave `KEEPER_KEYPAIR` and `USDC_MINT` empty for now — the seed script sets them automatically.

## 3. Install dependencies and push DB schema

From PowerShell in the project root:

```powershell
bun install
```

Push the Prisma schema to Postgres:

```powershell
bun run db:push
```

Or manually:

```bash
cd packages/db && npx prisma db push
```

## 4. Build the Solana program and start the test validator

All commands below run in WSL (`wsl -e bash -lc '...'`).

```bash
cd contracts
anchor build -- --features testing
```

In a **separate WSL terminal**, start the validator with the compiled program:

```bash
solana-test-validator --reset \
  --bpf-program Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj \
  contracts/target/deploy/recur.so
```

Leave this terminal running.

## 5. (Optional) Run smart contract tests

```bash
cd contracts
anchor test -- --features testing --skip-local-validator
```

Expected: **23/23 passing**.

## 6. Start the API server

From PowerShell in the project root:

```powershell
bun run apps/api/src/index.ts
```

You should see: `Recur API running on http://localhost:3001`

Verify:

```powershell
Invoke-RestMethod http://localhost:3001/health
# or: curl http://localhost:3001/health
```

Expected: `{ "success": true, "data": { "status": "ok", ... } }`

## 7. Run the seed script

The seed script creates everything needed for the simulation:
- A fresh USDC mint on localnet
- Treasury vault on-chain
- A merchant wallet with an app and plan ($2 / 10s interval)
- 3 subscriber wallets, each funded with $100 USDC
- 3 on-chain subscriptions with token delegation
- All wallets authenticated and subscriptions registered in the DB
- Auto-updates `.env` with the new `USDC_MINT`

From PowerShell in the project root:

```powershell
bun run scripts/seed-localnet.ts
```

Expected output ends with:

```
SEED COMPLETE — Ready to run the keeper
Merchant:    <pubkey>
USDC Mint:   <pubkey>
Plan:        $2 every 10s
Subs:        3
```

## 8. Set `KEEPER_KEYPAIR` in `.env`

The keeper needs a funded Solana keypair. Use the default Solana CLI keypair:

**WSL:**
```bash
cat ~/.config/solana/id.json
```

Copy the JSON array and set it in `.env`:

```env
KEEPER_KEYPAIR=[174,23,55,...]
```

Or use a base58-encoded private key instead.

Make sure the keypair has SOL on localnet:

```bash
solana airdrop 10
```

## 9. Start the keeper daemon

From PowerShell in the project root (important — bun loads `.env` from CWD):

```powershell
bun run apps/keeper/src/index.ts
```

The keeper polls every 15 seconds (configurable via `KEEPER_POLL_MS` in `.env`).

## 10. Watch it work

The keeper will:
1. Query the DB for active subscriptions past their `nextPaymentDate`
2. Verify on-chain state and token delegation
3. Submit `process_payment` transactions to the validator
4. Report results back to the API (`POST /keeper/payment`)
5. The API records the transaction and updates `lastPaymentAt`

You should see keeper logs like:

```
[keeper] Processing 3 due subscriptions
[keeper] Payment processed: <sub_pda> tx=<signature>
[keeper] Payment processed: <sub_pda> tx=<signature>
[keeper] Payment processed: <sub_pda> tx=<signature>
```

And API logs showing:

```
[keeper-api] Payment recorded for subscription <id>
```

Each payment deducts $2.00 from the subscriber, sends $1.945 to the merchant, and $0.055 to the treasury (flat $0.05 + 0.25% fee).

## 11. Verify results

Check the DB for recorded transactions:

```powershell
# List transactions via API (replace <token> with a merchant JWT from seed output)
Invoke-RestMethod -Uri "http://localhost:3001/merchant/apps/<appId>/transactions" `
  -Headers @{ Authorization = "Bearer <token>" }
```

Or query Postgres directly:

```sql
SELECT COUNT(*), status FROM "MerchantTransaction" GROUP BY status;
SELECT id, "amountGross", "platformFee", "amountNet", "txSignature"
FROM "MerchantTransaction" ORDER BY "createdAt" DESC LIMIT 10;
```

## Alternative: Run the full E2E smoke test

Instead of steps 7-10, you can run the automated E2E test that does everything in one shot (seed + payment + cancel + verify):

```powershell
bun run scripts/e2e-smoke.ts
```

This creates its own wallets, mint, and subscription, processes one payment, tests the cancel flow, and asserts all 12 steps pass. It does **not** start the keeper — it simulates the keeper's on-chain transaction directly.

Expected: `All E2E smoke tests passed!`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Failed to connect to localhost:3001` | API not running. Start it (step 6). |
| `Failed to connect to localhost:8899` | Validator not running. Start it (step 4). |
| `account already in use` on treasury init | Validator was reset but PDA exists. Use `--reset` flag. |
| Keeper can't find `KEEPER_KEYPAIR` | Rebuild config package: `cd packages/config && npx -p typescript tsc` |
| Keeper fails with BigInt serialization | Pull latest — this was fixed in `merchant.routes.ts`. |
| `USDC_MINT` mismatch | Re-run `seed-localnet.ts` — it auto-updates `.env`. |
| Port 3001 already in use | Kill the old process: `netstat -ano \| findstr :3001` then `Stop-Process -Id <pid>` |
| Prisma client errors in IDE | Stale cache. Run `npx prisma generate` in `packages/db`. `tsc --noEmit` passes clean. |

## Architecture overview

```
┌──────────────┐    poll DB     ┌──────────────┐    on-chain tx    ┌────────────────────┐
│  Keeper      │───────────────>│  API (3001)   │                  │  Solana Validator   │
│  (daemon)    │<───────────────│  + Postgres   │                  │  (8899)             │
│              │  POST /keeper  │               │                  │                     │
│              │────────────────────────────────────────────────────>  process_payment    │
│              │<───────────────────────────────────────────────────  tx confirmed        │
└──────────────┘                └──────────────┘                  └────────────────────┘
```

- **Validator**: Runs the Recur smart contract (9 instructions, treasury, subscriptions)
- **API**: Express server — auth, merchant/subscriber CRUD, keeper webhook endpoints
- **Keeper**: Polls for due subscriptions, submits on-chain payments, reports to API
- **DB**: PostgreSQL via Prisma — merchants, apps, plans, subscriptions, transactions
