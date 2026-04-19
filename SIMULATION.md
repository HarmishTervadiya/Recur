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
| Bun | 1.1+ | Windows: `C:\Users\<you>\.bun\bin\bun.exe` |
| Docker | — | For PostgreSQL |

## 1. Start PostgreSQL

> **Important:** Use a named volume (`-v recur-postgres-data:...`) so your data
> survives `docker rm` and restarts. Without a volume, removing the container
> wipes the DB and you have to re-push the schema and re-seed.

```bash
docker run -d --name recur-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=recur \
  -p 5432:5432 \
  -v recur-postgres-data:/var/lib/postgresql/data \
  postgres:16-alpine
```

If already running: `docker start recur-postgres`

Verify it's up:

```bash
docker exec recur-postgres pg_isready -U postgres
# Expected: /var/run/postgresql:5432 - accepting connections
```

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — set at minimum:

```env
SOLANA_RPC_URL=http://127.0.0.1:8899
PROGRAM_ID=Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recur
PORT=3001
JWT_SECRET=any-local-secret
KEEPER_SECRET=localnet-keeper-secret
API_URL=http://localhost:3001
```

> **Note on `SOLANA_RPC_URL`:** Use `http://127.0.0.1:8899` not `http://localhost:8899`.
> On some Windows/WSL setups, `localhost` resolves to IPv6 `::1` which the
> validator doesn't bind to. `127.0.0.1` avoids this.

Leave `KEEPER_KEYPAIR` and `USDC_MINT` empty for now — the seed script sets them.

### Setting `KEEPER_KEYPAIR`

The keeper needs a funded Solana keypair. Use the default Solana CLI keypair:

**WSL:**
```bash
cat ~/.config/solana/id.json
```

**Windows (if Solana CLI is installed natively):**
```powershell
Get-Content "$env:USERPROFILE\.config\solana\id.json"
```

Copy the entire JSON array and paste it into `.env`:

```env
KEEPER_KEYPAIR=[174,23,55,...]
```

The keeper also accepts a base58-encoded private key instead.

Make sure the keypair has SOL on localnet (after starting the validator):

```bash
solana airdrop 10
```

## 3. Install dependencies and push DB schema

From PowerShell in the project root:

```powershell
bun install
```

Push the Prisma schema to Postgres:

```powershell
cd packages/db
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recur"
bunx prisma db push
cd ../..
```

> **Why the explicit `$env:DATABASE_URL`?** The Turborepo `bun run db:push`
> command runs Prisma inside the `packages/db` workspace, which does not
> automatically inherit the root `.env` file. Setting the env var inline
> ensures Prisma can connect. If you skip this, you'll see:
> `Error: Environment variable not found: DATABASE_URL`

Verify tables were created:

```bash
docker exec recur-postgres psql -U postgres -d recur -c "\dt"
# Expected: 7 tables (apps, auth_nonces, merchant_transactions, merchants, plans, subscribers, subscriptions)
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

> **`--reset` wipes all on-chain state.** This is fine — the seed script
> creates everything fresh. If you restart the validator with `--reset`,
> you must re-run the seed script (step 7).

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
```

Expected: `{ "success": true, "data": { "status": "ok", ... } }`

> **If you recreated the Docker container** (or ran `docker rm` + `docker run`),
> you must restart the API server. Prisma's connection pool caches the
> connection to the old container, and all DB operations will 500 silently
> until the API is restarted.

## 7. Run the seed script

Two options:

### Option A: Full simulation seed (3 subscribers, $2/10s interval)

```powershell
bun run scripts/seed-localnet.ts
```

Creates 3 subscribers each funded with $100 USDC, a $2/10s plan, and
registers everything on-chain + in the DB. The keeper will process
payments in bulk every 15 seconds.

### Option B: Demo seed (1 subscriber, $10/15s interval — for recordings)

```powershell
bun run demo:seed
```

Creates a single clean setup optimised for the demo video:
- 1 subscriber with exactly 100 USDC
- 1 merchant with 0 USDC
- Treasury at 0
- $10 plan with 15-second interval
- All credentials saved to `.env` automatically

Expected output ends with:

```
============================================================
  DEMO SEED COMPLETE
============================================================
  ALL CREDENTIALS SAVED TO .env AUTOMATICALLY
```

Both seed scripts:
- Create a fresh USDC mint on localnet
- Initialise the treasury vault on-chain
- Auto-update `USDC_MINT` in `.env`

> **The seed script will fail if the API is not running.** It authenticates
> wallets and creates merchants/plans/subscriptions via the API. Start the
> API (step 6) before running the seed.

## 8. Start the keeper daemon

From PowerShell in the project root (important — Bun loads `.env` from CWD):

```powershell
bun run apps/keeper/src/index.ts
```

The keeper polls every 15 seconds (configurable via `KEEPER_POLL_MS` in `.env`).

Expected: `Recur Keeper started — jobs registered`

## 9. Watch it work

The keeper will:
1. Query the DB for active subscriptions past their billing interval
2. Fetch on-chain state to verify the subscription PDA exists and is not cancelled
3. Submit `process_payment` transactions to the validator
4. Report results back to the API (`POST /keeper/payment`)
5. The API records the transaction and updates `lastPaymentAt`

You should see keeper logs like:

```
[processPayments] Payment processed: <sub_pda> sig=<signature>
```

### Demo watcher (if you ran `demo:seed`)

Run the persistent demo in a separate terminal:

```powershell
bun run demo:show
```

This creates a fresh 100 USDC subscriber, shows a BEFORE/AFTER table, and
then prints each payment as a new row as the keeper fires every 15 seconds:

```
┌──────────────────────────────────────────────────────────────┐
│  #   Subscriber     Merchant      Treasury     Recur Fee     │
├──────────────────────────────────────────────────────────────┤
│  0       100.00         0.00         0.00       —            │
│  1        90.00         9.93         0.07      0.075         │
│  2        80.00        19.85         0.15      0.075         │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
```

Or run the live balance watcher in a second pane:

```powershell
bun run demo:watch
```

This refreshes every 2 seconds and auto-reads addresses from `.env`.

### Fee breakdown per payment

```
Gross:              $10.000000
Flat fee:            $0.050000
Percent fee (0.25%): $0.025000
Total Recur fee:     $0.075000
Net to merchant:     $9.925000
```

## 10. Verify results

Check the DB for recorded transactions:

```bash
docker exec recur-postgres psql -U postgres -d recur -c \
  "SELECT COUNT(*), status FROM merchant_transactions GROUP BY status;"
```

Or view individual transactions:

```bash
docker exec recur-postgres psql -U postgres -d recur -c \
  "SELECT amount_gross, platform_fee, amount_net, tx_signature FROM merchant_transactions ORDER BY created_at DESC LIMIT 5;"
```

## Alternative: Run the full E2E smoke test

Instead of steps 7–9, you can run the automated E2E test that does everything
in one shot (seed + payment + cancel + verify):

```powershell
bun run scripts/e2e-smoke.ts
```

This creates its own wallets, mint, and subscription, processes one payment,
tests the cancel flow, and asserts all 12 steps pass. It does **not** start the
keeper — it simulates the keeper's on-chain transaction directly.

Expected: `All E2E smoke tests passed!`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Environment variable not found: DATABASE_URL` when pushing schema | Set it inline: `$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recur"` then run `bunx prisma db push` in `packages/db` |
| `TransactionExpiredBlockheightExceeded` during seed | Stale blockhash. Re-run the seed — the scripts use fresh blockhashes per transaction. If it persists, restart the validator with `--reset`. |
| API returns 500 on `/auth/nonce` after DB recreate | Restart the API server. Prisma's connection pool is pointing to the old container. |
| `Failed to connect to localhost:3001` | API not running. Start it (step 6). The seed script calls the API — it must be running first. |
| `Failed to connect to localhost:8899` | Validator not running. Start it (step 4). |
| `Program ... is not deployed` | Validator was started without the `--bpf-program` flag, or was reset after deployment. Re-start with the flag. |
| `account already in use` on treasury init | Normal — treasury vault PDA persists across seed runs on the same validator. The seed scripts handle this automatically. |
| Keeper can't find `KEEPER_KEYPAIR` | Check `.env` has the JSON array or base58 key. Rebuild config if needed: `cd packages/config && bunx tsc` |
| `USDC_MINT` mismatch / keeper processes 0 subs | Re-run the seed script — it auto-updates `.env` with the new mint. Then restart the keeper so it picks up the new value. |
| Port 3001 already in use | Kill the old process: `netstat -ano \| findstr :3001` then `Stop-Process -Id <pid>` |
| Docker container gone after restart | `docker start recur-postgres`. If you used a named volume, data is preserved — no `db:push` needed. If you didn't use a volume, re-push the schema and re-seed. |
| `bigint: Failed to load bindings, pure JS will be used` | Harmless warning from the `bigint` package. Does not affect functionality. |
| Keeper logs show payments but merchant balance doesn't change | Check `USDC_MINT` in `.env` matches the one printed by the seed. Restart the keeper after re-seeding. |

## Order-of-operations cheat sheet

```
1.  docker start recur-postgres          # or create with -v volume
2.  (one-time) db:push                   # push schema
3.  solana-test-validator --reset ...     # start validator
4.  bun run apps/api/src/index.ts        # start API
5.  bun run demo:seed                    # seed on-chain + DB state
6.  bun run apps/keeper/src/index.ts     # start keeper
7.  bun run demo:show                    # watch payments live
```

If you restart the validator with `--reset`, repeat from step 5.
If you recreate the Docker container, repeat from step 2.
If you only restart the API or keeper, no re-seed needed.

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
