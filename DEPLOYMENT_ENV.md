# Recur — Deployment Environment Variables

> Each service (API, Keeper, Web) is deployed **separately**. Below are the exact `.env` variables each one needs, what they do, and where to get them.

---

## 1. API Server (`apps/api`)

The backend REST API — handles auth, merchant CRUD, plans, subscriptions, and webhooks.

```env
# ─── Core ─────────────────────────────────────────────────
NODE_ENV=production
PORT=3001

# ─── Database ─────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/recur?sslmode=require

# ─── Solana ───────────────────────────────────────────────
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
PROGRAM_ID=5HFL1agQqg6wHeLEsLuJVKdLZbMzAC2rGRQkEWk8smLk
USDC_MINT=4ynuJ6AbbtnriMcQmBWKVviBJNcPEMG8UBLM2LaB5xYb

# ─── Auth / JWT ───────────────────────────────────────────
JWT_SECRET=your-random-secret-min-16-chars
JWT_REFRESH_SECRET=your-random-refresh-secret-min-16-chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# ─── Keeper Auth ──────────────────────────────────────────
KEEPER_SECRET=your-random-keeper-secret-min-8-chars

# ─── Internal ─────────────────────────────────────────────
API_URL=https://your-deployed-api-url.com
```

### Variable Reference

| Variable | Required | What it is | Where to get it |
|---|---|---|---|
| `NODE_ENV` | ✅ | Set to `production` for deployed environments. Controls error verbosity and disables dev defaults. | Set manually to `production` |
| `PORT` | ⚙️ | Port the API server listens on. Defaults to `3001`. Most hosting platforms (Railway, Render) inject this automatically. | Your hosting platform sets it, or use `3001` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string. The API uses Prisma ORM. | **Neon** → project dashboard → connection string. **Supabase** → Settings → Database → URI. **Railway** → Postgres plugin → `DATABASE_URL` |
| `SOLANA_CLUSTER` | ✅ | Which Solana cluster to use: `devnet` or `mainnet-beta` | Set `devnet` for testing, `mainnet-beta` for production |
| `SOLANA_RPC_URL` | ⚠️ | Solana RPC endpoint. If omitted, falls back to public RPC (rate-limited). **Use a private RPC for production.** | **Helius** → dashboard → API key → copy devnet/mainnet URL. **Triton** or **QuickNode** also work. |
| `PROGRAM_ID` | ⚙️ | Your deployed Recur Anchor program address. Has a default for devnet. | From your `anchor deploy` output, or use the default |
| `USDC_MINT` | ⚙️ | SPL token mint address for USDC. Devnet uses a mock mint. | Devnet mock: `4ynuJ6AbbtnriMcQmBWKVviBJNcPEMG8UBLM2LaB5xYb`. Mainnet USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| `JWT_SECRET` | ✅ | Signs subscriber access tokens. **Must be ≥ 16 chars. No default in production.** | Generate: `openssl rand -hex 32` or use a password manager |
| `JWT_REFRESH_SECRET` | ✅ | Signs refresh tokens. **Must be ≥ 16 chars. No default in production.** | Generate: `openssl rand -hex 32` |
| `JWT_ACCESS_TTL` | ⚙️ | Access token expiry duration. Defaults to `15m`. | Use default or customize (e.g. `30m`, `1h`) |
| `JWT_REFRESH_TTL` | ⚙️ | Refresh token expiry duration. Defaults to `7d`. | Use default or customize |
| `KEEPER_SECRET` | ✅ | A shared secret that authenticates the Keeper when it calls the API (e.g. to report payment results). Think of it like an internal API key between your two services. **You generate this yourself** — it's not from any external service. Must be ≥ 8 chars. | **Generate yourself:** `openssl rand -hex 16` — then paste the same value into both the API and Keeper `.env` files. They must match exactly. |
| `API_URL` | ⚙️ | The API's own public URL. Used for internal references. Defaults to `http://localhost:3001`. | Your deployed API URL (e.g. `https://recur-api.railway.app`) |

---

## 2. Keeper (`apps/keeper`)

The automated cron worker — processes payments, finalizes cancellations, scans the chain, and handles grace periods. **Needs a funded Solana wallet.**

```env
# ─── Core ─────────────────────────────────────────────────
NODE_ENV=production

# ─── Database ─────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/recur?sslmode=require

# ─── Solana ───────────────────────────────────────────────
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
PROGRAM_ID=5HFL1agQqg6wHeLEsLuJVKdLZbMzAC2rGRQkEWk8smLk
USDC_MINT=4ynuJ6AbbtnriMcQmBWKVviBJNcPEMG8UBLM2LaB5xYb

# ─── Keeper Wallet ────────────────────────────────────────
KEEPER_KEYPAIR=[your,solana,keypair,as,json,array]
KEEPER_SECRET=your-random-keeper-secret-min-8-chars

# ─── Tuning ───────────────────────────────────────────────
KEEPER_BATCH_SIZE=20
KEEPER_POLL_MS=15000

# ─── API Connection ───────────────────────────────────────
API_URL=https://your-deployed-api-url.com

# ─── Pro Plan (optional) ─────────────────────────────────
RECUR_PLATFORM_WALLET=
RECUR_PRO_GRACE_DAYS=7
RECUR_PRO_PRICE_BASE_UNITS=49000000
```

### Variable Reference

| Variable | Required | What it is | Where to get it |
|---|---|---|---|
| `NODE_ENV` | ✅ | Set to `production`. | Set manually |
| `DATABASE_URL` | ✅ | **Same database** as the API — the Keeper reads/writes subscription state directly. | Same connection string as the API |
| `SOLANA_CLUSTER` | ✅ | Must match the API's cluster. | Same as API |
| `SOLANA_RPC_URL` | ✅ | **Critical for Keeper** — it sends transactions on every billing cycle. Use a reliable private RPC. | Same as API (Helius, Triton, QuickNode) |
| `PROGRAM_ID` | ⚙️ | Must match the API's program ID. | Same as API |
| `USDC_MINT` | ⚙️ | Must match the API's USDC mint. | Same as API |
| `KEEPER_KEYPAIR` | ✅ | **The Solana wallet that signs and pays for payment transactions.** Must have SOL for gas fees (≥ 0.01 SOL). Provide as a JSON array `[n1,n2,...,n64]` or a base58 private key. | Run `solana-keygen new -o keeper.json` → paste the JSON array contents. **Fund it with SOL on devnet:** `solana airdrop 2 <address> --url devnet` |
| `KEEPER_SECRET` | ✅ | The same shared secret as the API's `KEEPER_SECRET`. This is how the Keeper proves its identity to the API. **You generate this yourself.** | **Must be identical to the API's `KEEPER_SECRET`.** Generate once with `openssl rand -hex 16`, paste into both services. |
| `KEEPER_BATCH_SIZE` | ⚙️ | Max subscriptions to process per job tick. Defaults to `20`. | Increase for higher volume (e.g. `50`) |
| `KEEPER_POLL_MS` | ⚙️ | How often (in ms) the Keeper checks for due payments. Defaults to `15000` (15s). | Lower = more responsive but more RPC calls. `10000`–`30000` recommended |
| `API_URL` | ✅ | The deployed API URL so the Keeper can call it. | Your deployed API URL |
| `RECUR_PLATFORM_WALLET` | Optional | Recur platform's own wallet for Pro billing. | Only needed if you use Recur Pro tier |
| `RECUR_PRO_GRACE_DAYS` | Optional | Days before downgrading a past-due Pro merchant. Defaults to `7`. | Use default |
| `RECUR_PRO_PRICE_BASE_UNITS` | Optional | Pro plan price in USDC base units (6 decimals). `49000000` = $49. | Use default or customize |

> ⚠️ **Important:** The Keeper wallet (`KEEPER_KEYPAIR`) needs to be funded with SOL for transaction fees. On devnet, airdrop SOL. On mainnet, transfer real SOL.

---

## 3. Web Frontend (`apps/web`)

Next.js dashboard — merchant UI, wallet connection, subscription management. All env vars are `NEXT_PUBLIC_*` (exposed to the browser).

```env
# ─── API Connection ───────────────────────────────────────
NEXT_PUBLIC_API_URL=https://your-deployed-api-url.com

# ─── Solana ───────────────────────────────────────────────
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_PROGRAM_ID=5HFL1agQqg6wHeLEsLuJVKdLZbMzAC2rGRQkEWk8smLk
NEXT_PUBLIC_USDC_MINT=4ynuJ6AbbtnriMcQmBWKVviBJNcPEMG8UBLM2LaB5xYb

# ─── App ──────────────────────────────────────────────────
NEXT_PUBLIC_RECUR_APP_ID=your_app_id
```

### Variable Reference

| Variable | Required | What it is | Where to get it |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API base URL. The dashboard calls this for all data. | Your deployed API URL (e.g. `https://recur-api.railway.app`) |
| `NEXT_PUBLIC_SOLANA_NETWORK` | ✅ | Solana network for the wallet adapter: `devnet` or `mainnet-beta`. | Must match API & Keeper |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | ⚠️ | RPC URL used by the frontend for wallet interactions. Falls back to public RPC if omitted. | Same Helius/Triton key. **Note:** this is client-side exposed, so consider using a separate key with restricted rate limits. |
| `NEXT_PUBLIC_PROGRAM_ID` | ⚙️ | Recur program address for client-side transaction building. | Same as API/Keeper |
| `NEXT_PUBLIC_USDC_MINT` | ⚙️ | USDC mint address for client-side token operations. | Same as API/Keeper |
| `NEXT_PUBLIC_RECUR_APP_ID` | ⚙️ | Default app ID for the subscribe/pricing flow on the landing page. | Created via the dashboard → Apps → copy the app ID |

---

## Quick Checklist

### Shared values (must be identical across all 3 services)

| Variable | API | Keeper | Web |
|---|---|---|---|
| Database | `DATABASE_URL` | `DATABASE_URL` *(same DB)* | — |
| Solana cluster | `SOLANA_CLUSTER` | `SOLANA_CLUSTER` | `NEXT_PUBLIC_SOLANA_NETWORK` |
| RPC URL | `SOLANA_RPC_URL` | `SOLANA_RPC_URL` | `NEXT_PUBLIC_SOLANA_RPC_URL` |
| Program ID | `PROGRAM_ID` | `PROGRAM_ID` | `NEXT_PUBLIC_PROGRAM_ID` |
| USDC Mint | `USDC_MINT` | `USDC_MINT` | `NEXT_PUBLIC_USDC_MINT` |
| Keeper secret | `KEEPER_SECRET` | `KEEPER_SECRET` | — |
| API URL | `API_URL` | `API_URL` | `NEXT_PUBLIC_API_URL` |

### Where to get external services

| Service | What you need | Where to sign up |
|---|---|---|
| **PostgreSQL** | `DATABASE_URL` | [Neon](https://neon.tech) (free tier), [Supabase](https://supabase.com), or [Railway](https://railway.app) |
| **Solana RPC** | `SOLANA_RPC_URL` | [Helius](https://helius.dev) (free tier, 100k requests/day), [Triton](https://triton.one), or [QuickNode](https://quicknode.com) |
| **Hosting** | Deploy API + Keeper | [Railway](https://railway.app), [Render](https://render.com), or [Fly.io](https://fly.io) |
| **Frontend Hosting** | Deploy Web | [Vercel](https://vercel.com) (recommended for Next.js), or [Netlify](https://netlify.com) |
| **Solana Keypair** | `KEEPER_KEYPAIR` | Run `solana-keygen new -o keeper.json` locally |

### Generating secrets

```bash
# JWT_SECRET
openssl rand -hex 32

# JWT_REFRESH_SECRET
openssl rand -hex 32

# KEEPER_SECRET
openssl rand -hex 16

# KEEPER_KEYPAIR (generates a new Solana wallet)
solana-keygen new -o keeper.json --no-bip39-passphrase
cat keeper.json
# Copy the JSON array output
```
