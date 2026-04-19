# Setup Guide

This guide walks through setting up a full local development environment for Recur from scratch.
Follow every section in order on a fresh machine.

---

## Prerequisites

Before cloning the repo, install the following tools.

### Required

| Tool | Version | Install |
|---|---|---|
| Bun | ≥ 1.1 | `curl -fsSL https://bun.sh/install \| bash` |
| Node.js | ≥ 20 LTS | [nodejs.org](https://nodejs.org) or via `nvm` |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Solana CLI | ≥ 1.18 | See below |
| Anchor CLI | ≥ 0.30 | See below |
| Docker | latest | [docker.com](https://www.docker.com/get-started/) (for Postgres) |

### Installing Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"

# Verify
solana --version
```

### Installing Anchor CLI

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# Verify
anchor --version
```

---

## 1. Clone the repository

```bash
git clone https://github.com/<your-org>/recur.git
cd recur
```

---

## 2. Install dependencies

Bun handles all workspace dependencies from the root:

```bash
bun install
```

---

## 3. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in each value. The table below describes every variable:

### Solana

| Variable | Description | Example |
|---|---|---|
| `SOLANA_RPC_URL` | RPC endpoint. Use `127.0.0.1` not `localhost` (IPv6 issues on Windows/WSL) | `http://127.0.0.1:8899` |
| `PROGRAM_ID` | Deployed program address (pre-set in `.env.example`) | `Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj` |
| `KEEPER_KEYPAIR` | JSON array or base58 private key for the Keeper wallet | `[174,23,55,...]` |

### Database

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/recur` |

### API

| Variable | Description | Example |
|---|---|---|
| `PORT` | Express server port | `3001` |
| `JWT_SECRET` | Secret for signing API tokens | any long random string |
| `KEEPER_SECRET` | Shared secret between Keeper and API | `localnet-keeper-secret` |
| `API_URL` | API base URL (used by Keeper) | `http://localhost:3001` |

### Web (Next.js)

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL | `http://localhost:3001` |
| `NEXT_PUBLIC_PROGRAM_ID` | Program address for client-side use | same as `PROGRAM_ID` |

> **Note:** `USDC_MINT` is left blank in `.env.example`. The seed scripts
> create a mock USDC mint on localnet and update `.env` automatically.

---

## 4. Set up PostgreSQL

### Option A — Docker (recommended)

> **Always use a named volume** so data survives container removal and restarts.
> Without `-v`, removing the container wipes the entire database.

```bash
docker run -d \
  --name recur-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=recur \
  -p 5432:5432 \
  -v recur-postgres-data:/var/lib/postgresql/data \
  postgres:16-alpine
```

### Option B — Local PostgreSQL

Create a database and user manually:

```sql
CREATE USER postgres WITH PASSWORD 'postgres';
CREATE DATABASE recur OWNER postgres;
```

### Push the Prisma schema

> **Important:** Run this from the `packages/db` directory with `DATABASE_URL`
> set explicitly. The Turborepo `db:push` script does not inherit the root
> `.env`, which causes `Environment variable not found: DATABASE_URL`.

```bash
cd packages/db
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recur" bunx prisma db push
cd ../..
```

On PowerShell:

```powershell
cd packages/db
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recur"
bunx prisma db push
cd ../..
```

Verify:

```bash
docker exec recur-postgres psql -U postgres -d recur -c "\dt"
# Expected: 7 tables
```

The `db push` also runs `prisma generate` to create the typed client used by
`apps/api`. Re-run it any time you change `schema.prisma`.

---

## 5. Set up Solana localnet

### Generate a local keypair (if you don't have one)

```bash
solana-keygen new --outfile ~/.config/solana/id.json
solana config set --keypair ~/.config/solana/id.json
solana config set --url http://127.0.0.1:8899
```

### Set `KEEPER_KEYPAIR` in `.env`

Copy the JSON array from your keypair file into `.env`:

```bash
# WSL
cat ~/.config/solana/id.json

# Windows PowerShell
Get-Content "$env:USERPROFILE\.config\solana\id.json"
```

Paste the entire JSON array:

```env
KEEPER_KEYPAIR=[174,23,55,...]
```

### Start a local validator

```bash
solana-test-validator --reset
```

Leave this running in a separate terminal. The `--reset` flag wipes state on
each start.

### Airdrop SOL

```bash
solana airdrop 10
```

---

## 6. Build and deploy the smart contract

```bash
cd contracts

# Build with testing features enabled
anchor build -- --features testing

# Deploy to localnet
anchor deploy
```

After deploying, copy the program ID printed to the terminal and set it as
`PROGRAM_ID` and `NEXT_PUBLIC_PROGRAM_ID` in your `.env`.

**Or** start the validator with the pre-compiled program (skips deploy step):

```bash
solana-test-validator --reset \
  --bpf-program Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj \
  contracts/target/deploy/recur.so
```

### Run contract tests

```bash
cd contracts
anchor test -- --features testing --skip-local-validator
```

Expect all tests to pass before moving on.

---

## 7. Start development servers

From the repo root, start everything with Turborepo:

```bash
bun run dev
```

This starts `apps/web`, `apps/api`, and `apps/keeper` in parallel.

Or start individual apps:

```bash
bun run apps/api/src/index.ts     # Express on http://localhost:3001
bun run apps/keeper/src/index.ts  # Keeper daemon
```

> **If you recreated the Docker container** (or it restarted), restart the API
> server. Prisma caches the DB connection, and a stale pool causes silent 500
> errors on every DB operation.

---

## 8. Verify the setup

Once all services are running, check:

- [ ] `Invoke-RestMethod http://localhost:3001/health` returns `ok`
- [ ] Keeper logs show `Recur Keeper started — jobs registered`
- [ ] `solana-test-validator` is running with the program deployed
- [ ] `docker exec recur-postgres psql -U postgres -d recur -c "\dt"` shows 7 tables

---

## Common issues

### `Environment variable not found: DATABASE_URL` during `db:push`

Prisma runs in the `packages/db` workspace which does not inherit the root
`.env`. Set `DATABASE_URL` inline:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recur"
cd packages/db
bunx prisma db push
```

### `TransactionExpiredBlockheightExceeded` during seed scripts

Stale blockhash — the localnet moved past the block height before the tx was
confirmed. This happens when multiple airdrops/txs queue up. Just re-run the
seed. The scripts fetch fresh blockhashes per transaction.

### API returns 500 after recreating Docker container

Prisma's connection pool holds a reference to the old container. Restart the
API process and it will reconnect.

### `anchor build` fails with a version mismatch

Ensure the `anchor-lang` version in `contracts/programs/recur/Cargo.toml`
matches the installed Anchor CLI version:

```bash
anchor --version
```

### `bun install` is slow or fails

```bash
bun pm cache rm
bun install
```

### Port conflicts

Default ports: Next.js `3000`, API `3001`. If taken, override in `.env`:

```
PORT=3002
```

---

## Useful commands

```bash
# Rebuild all packages
bun run build

# Lint everything
bun run lint

# Run all tests
bun run test

# Open Prisma Studio (DB browser)
cd packages/db && bunx prisma studio

# Check active subscriptions in DB
bun run scripts/check-subs.ts

# Run the full E2E smoke test (no keeper needed)
bun run scripts/e2e-smoke.ts

# Run the demo simulation (see SIMULATION.md)
bun run demo:seed     # seed once
bun run demo:show     # watch payments live
bun run demo:watch    # live balance pane
```

---

## Editor setup (VS Code)

Install the recommended extensions:

```json
{
  "recommendations": [
    "rust-lang.rust-analyzer",
    "coral-xyz.anchor",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss"
  ]
}
```

Save this as `.vscode/extensions.json` in the repo root.

Enable format-on-save in your workspace settings:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  }
}
```
