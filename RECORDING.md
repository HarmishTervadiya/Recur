# Week 2 Recording — Complete Setup

## One-time setup (already done if you followed SIMULATION.md)

- Docker postgres with named volume (`recur-postgres-data`)
- Schema pushed (7 tables)
- `.env` configured with `KEEPER_KEYPAIR`, `SOLANA_RPC_URL=http://127.0.0.1:8899`

---

## Every time you record

### Terminal 1 — Solana validator (leave running)

```bash
solana-test-validator --reset \
  --bpf-program Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj \
  contracts/target/deploy/recur.so
```

### Terminal 2 — API server (leave running)

```powershell
bun run apps/api/src/index.ts
```

Wait for: `Recur API running on http://localhost:3001`

### Terminal 3 — Seed (run once per session)

```powershell
bun run demo:seed
```

Wait for: `DEMO SEED COMPLETE`

> If the seed fails with `INTERNAL_ERROR` on `/auth/nonce`, restart the API
> (it has a stale DB connection). Then re-run the seed.

### Terminal 4 — Keeper (leave running)

```powershell
bun run apps/keeper/src/index.ts
```

Wait for: `Recur Keeper started — jobs registered`

### Terminal 5 — Balance watcher (leave running, RIGHT pane)

```powershell
bun run demo:watch
```

No arguments needed — reads from `.env` automatically.

---

## On camera — the only command you paste

```powershell
bun run demo:show
```

### What happens:

1. Deactivates old subscriptions (clean slate)
2. Creates fresh merchant (0 USDC) + subscriber (100 USDC)
3. Registers $10 plan, initialises subscription on-chain
4. Prints BEFORE table:
   ```
   Subscriber       100.00 USDC
   Merchant           0.00 USDC
   Treasury           0.00 USDC
   ```
5. Keeper fires automatically every 15s — each payment prints a new row:
   ```
   #   Subscriber   Merchant   Treasury   Recur Fee
   0       100.00       0.00       0.00       —
   1        90.00       9.93       0.07      0.075
   2        80.00      19.85       0.15      0.075
   ...
   ```
6. After 10 payments (subscriber drained), shows final summary
7. Stays alive — Ctrl+C to exit

The `demo:watch` pane on the right updates live in sync.

---

## Terminal layout during recording

```
┌─────────────────────────┬─────────────────────────┐
│  LEFT — demo:show       │  RIGHT — demo:watch      │
│  (payment table rows    │  (live balance box        │
│   scrolling down)       │   refreshing every 2s)   │
└─────────────────────────┴─────────────────────────┘
```

Keeper runs in terminal 4 (minimised or behind).

---

## Fee maths (know cold)

```
Gross:              $10.00
Flat fee:            $0.05
Percent fee (0.25%): $0.025
Total Recur fee:     $0.075
Net to merchant:     $9.925
```

---

## If something breaks

| Problem | Fix |
|---|---|
| `demo:seed` fails: `INTERNAL_ERROR` on auth | Restart API server, then re-run seed |
| `demo:seed` fails: `Program not deployed` | Validator not running or missing `--bpf-program` flag |
| `demo:seed` fails: `TransactionExpiredBlockheightExceeded` | Just re-run it — stale blockhash, scripts handle retries |
| `demo:show` times out waiting for Keeper | Check keeper terminal — is it running? Restart if needed |
| `demo:watch` shows `-.--` or wrong numbers | Run `demo:show` first — it writes ATAs to `.env` |
| Treasury delta is wrong (too high) | Old subscriptions still active. `demo:show` deactivates them, but if keeper already processed them mid-cycle, re-run `demo:show` |
| Docker postgres gone | `docker start recur-postgres` (volume persists, no db:push needed) |
| Validator was reset | Re-run `demo:seed`, then restart keeper |

---

## Full command summary

```powershell
# 1 — Validator (leave running)
solana-test-validator --reset --bpf-program Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj contracts/target/deploy/recur.so

# 2 — API (leave running)
bun run apps/api/src/index.ts

# 3 — Seed (once per session)
bun run demo:seed

# 4 — Keeper (leave running)
bun run apps/keeper/src/index.ts

# 5 — Balance watcher (leave running)
bun run demo:watch

# ON CAMERA
bun run demo:show
```

If you restart the validator (`--reset`), repeat from step 3.
If you restart Docker, repeat from step 2.
If you only restart keeper, no re-seed needed.
