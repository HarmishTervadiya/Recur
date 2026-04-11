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
| PostgreSQL | ≥ 15 | [postgresql.org](https://www.postgresql.org/download/) or Docker |
| Docker | latest | [docker.com](https://www.docker.com/get-started/) (optional, for Postgres) |

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

This installs dependencies for all apps and packages in one step. You will see
`bun.lockb` updated if any resolved versions changed.

---

## 3. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in each value. The table below describes every variable:

### Solana

| Variable | Description | Example |
|---|---|---|
| `SOLANA_RPC_URL` | RPC endpoint (localnet for dev) | `http://127.0.0.1:8899` |
| `PROGRAM_ID` | Deployed program address | set after `anchor deploy` |
| `KEEPER_KEYPAIR_PATH` | Path to Keeper's `.json` keypair | `~/.config/solana/keeper.json` |

### Database

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://recur:recur@localhost:5432/recur` |

### API

| Variable | Description | Example |
|---|---|---|
| `PORT` | Express server port | `3001` |
| `JWT_SECRET` | Secret for signing API tokens | any long random string |

### Web (Next.js)

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL | `http://localhost:3001` |
| `NEXT_PUBLIC_PROGRAM_ID` | Program address for client-side use | same as `PROGRAM_ID` |

---

## 4. Set up PostgreSQL

### Option A — Docker (recommended for local dev)

```bash
docker run -d \
  --name recur-postgres \
  -e POSTGRES_USER=recur \
  -e POSTGRES_PASSWORD=recur \
  -e POSTGRES_DB=recur \
  -p 5432:5432 \
  postgres:15
```

### Option B — Local PostgreSQL

Create a database and user manually:

```sql
CREATE USER recur WITH PASSWORD 'recur';
CREATE DATABASE recur OWNER recur;
```

### Run Prisma migrations

```bash
cd packages/db
bunx prisma migrate dev --name init
bunx prisma generate
```

The `generate` step creates the typed Prisma client used by `apps/api`. Re-run it any
time you change `schema.prisma`.

---

## 5. Set up Solana localnet

### Generate a local keypair (if you don't have one)

```bash
solana-keygen new --outfile ~/.config/solana/id.json
solana config set --keypair ~/.config/solana/id.json
solana config set --url localhost
```

### Generate a Keeper keypair

```bash
solana-keygen new --outfile ~/.config/solana/keeper.json
```

Update `KEEPER_KEYPAIR_PATH` in `.env` to this path.

### Start a local validator

```bash
solana-test-validator --reset
```

Leave this running in a separate terminal. The `--reset` flag wipes state on each start,
which is useful during development.

### Airdrop SOL to your accounts

```bash
# Fund your main keypair
solana airdrop 10

# Fund the Keeper
solana airdrop 10 ~/.config/solana/keeper.json
```

---

## 6. Build and deploy the smart contract

```bash
cd contracts

# Build the program and generate the IDL
anchor build

# Deploy to localnet
anchor deploy
```

After deploying, copy the program ID printed to the terminal and set it as
`PROGRAM_ID` and `NEXT_PUBLIC_PROGRAM_ID` in your `.env`.

```bash
# Verify the program is deployed
solana program show <PROGRAM_ID>
```

### Run contract tests

```bash
anchor test
```

This spins up a local validator, deploys the program, and runs all tests in
`contracts/tests/`. Expect all tests to pass before moving on.

---

## 7. Start development servers

From the repo root, start everything with Turborepo:

```bash
bun run dev
```

This starts `apps/web`, `apps/api`, and `apps/keeper` in parallel. Each app logs with
a coloured prefix.

Or start individual apps:

```bash
bun run dev --filter=web      # Next.js on http://localhost:3000
bun run dev --filter=api      # Express on http://localhost:3001
bun run dev --filter=keeper   # Bun worker (logs to stdout)
```

---

## 8. Verify the setup

Once all services are running, run through this checklist:

- [ ] `http://localhost:3000` loads the Next.js merchant portal.
- [ ] `http://localhost:3001/health` returns `{ "status": "ok" }`.
- [ ] Keeper logs show `[keeper] starting cron scheduler` on boot.
- [ ] `solana-test-validator` is running with the program deployed.
- [ ] `bunx prisma studio` (in `packages/db/`) opens the database browser.

---

## Common issues

### `anchor build` fails with a version mismatch

Ensure the `anchor-lang` version in `contracts/programs/recur/Cargo.toml` matches the
installed Anchor CLI version:

```bash
anchor --version          # e.g. anchor-cli 0.30.1
cargo search anchor-lang  # should match
```

### `prisma migrate dev` fails with connection refused

Check PostgreSQL is running:

```bash
docker ps                       # if using Docker
pg_isready -h localhost -p 5432 # if using local install
```

### `bun install` is slow or fails on first run

Try clearing the Bun cache:

```bash
bun pm cache rm
bun install
```

### Keeper exits immediately with `KEEPER_KEYPAIR_PATH not found`

Ensure the path in `.env` points to an existing `.json` keypair file and the file is
readable:

```bash
cat $KEEPER_KEYPAIR_PATH | head -c 20
```

### Port conflicts

Default ports: Next.js `3000`, API `3001`. If these are taken, override in `.env`:

```
PORT=3002                       # changes the API port
```

For Next.js, set the port in `apps/web/package.json`:

```json
"dev": "next dev -p 3005"
```

---

## Useful commands

```bash
# Rebuild all packages from scratch
bun run build

# Type-check the entire monorepo
bun run typecheck

# Lint everything
bun run lint

# Run all tests
bun run test

# Open Prisma Studio (database browser)
cd packages/db && bunx prisma studio

# Reset the database and re-run all migrations
cd packages/db && bunx prisma migrate reset

# Watch for Anchor IDL changes and regenerate types
cd contracts && anchor build --watch
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
