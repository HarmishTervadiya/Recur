# Agentic Engineering Grant Application

Submit here: https://superteam.fun/earn/grants/agentic-engineering

## Step 1: Basics

**Project Title**
> Recur

**One Line Description**
> Recur is a Solana recurring payments protocol that lets merchants run USDC subscriptions with one-time user approval, automated keeper execution, and webhook-based merchant tooling.

**TG username**
> t.me/HarmisTervadiya

**Wallet Address**
> 9KuYdUTKEE1BFyn8spRk8urbuXcMyMB33fP6Q2eE6kSh

## Step 2: Details

**Project Details**
> Recur is building subscription infrastructure for Solana. Today, onchain recurring billing is either manual, where users must re-sign every cycle and churn when they miss a payment window, or capital-inefficient, where funds are locked in escrow up front. That makes recurring billing hard for wallets, SaaS products, games, creator memberships, and DAO tooling that want predictable revenue without breaking self-custody.
>
> Recur solves this with a smart allowance model. A subscriber signs a single SPL token approval that grants a time-locked Anchor program permission to pull a fixed USDC amount at a fixed interval. Funds remain in the user's wallet until each billing event. An offchain keeper checks allowance, balance, and interval eligibility before submitting the payment transaction, so the flow remains automated without requiring repeated signatures or pre-funded escrow.
>
> The current implementation is a full-stack monorepo with an Anchor smart contract, a keeper worker, an Express API, a Next.js merchant dashboard, and an SDK for merchant integrations. Recent work includes a devnet migration with deployed program `3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx`, webhook dispatch and testing, merchant dashboard flows, transaction tracking, API key management, validation and auth fixes, and local/devnet demo scripts.
>
> This grant would support polishing the developer and merchant experience around recurring payments on Solana: hardening the end-to-end billing flow, improving merchant integrations, validating usage on devnet, and turning the current hackathon-stage system into a tighter production-oriented product surface.

**Deadline**
> May 4, 2026 (Asia/Calcutta)

**Proof of Work**
> GitHub repo: https://github.com/HarmishTervadiya/Recur
>
> AI-assisted session transcripts exported to project root:
> `./claude-session.jsonl`
> `./codex-session.jsonl`
>
> README and codebase show a working monorepo spanning:
> Anchor program in `contracts/`
> Next.js merchant dashboard in `apps/web`
> Express API in `apps/api`
> Bun keeper in `apps/keeper`
> Shared SDK and Solana client packages in `packages/`
>
> Devnet deployment evidence:
> Anchor config references deployed program `3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx`
>
> Recent git history demonstrates active shipping:
> `2bbb215` add webhook test script
> `59848b8` implement webhook dispatch pipeline
> `37b6e06` fix webhook UX and tsconfig issues
> `685f4b6` enforce one webhook endpoint per app
> `1f5f6eb` polish dashboard UX and validation
> `442eb1d` devnet migration and program deployment
> `0ac7be4` transactions and webhooks tabs
> `afa1847` merchant dashboard CRUD
> `8db519c` wallet auth infrastructure
>
> Demo and validation artifacts present in repo:
> `scripts/e2e-smoke.ts` for end-to-end localnet smoke testing
> `scripts/test-webhooks.ts` for keeper-to-webhook pipeline verification
> `scripts/seed-localnet.ts` and `scripts/watch-balances.ts` for recurring billing demos
> `RECORDING.md`, `SIMULATION.md`, and `PLAN.md` for implementation and demo context
>
> README states the project was built for the Solana Colosseum Frontier Hackathon.

**Personal X Profile**
> x.com/HarmisTervadiya

**Personal GitHub Profile**
> github.com/HarmishTervadiya

**Colosseum Crowdedness Score**
> Based on Colosseum Copilot results pulled on April 25, 2026, the closest recurring-subscription comparables for Recur cluster around a crowdedness score of **202**. The nearest direct analogs were LinkWave and Aeon Protocol, both focused on subscription or recurring payment infrastructure on Solana and both returning a crowdedness of **202**.

**AI Session Transcript**
> Attach:
> `./claude-session.jsonl`
> `./codex-session.jsonl`

## Step 3: Milestones

**Goals and Milestones**
> Milestone 1: Stabilize recurring billing core on devnet
> Target date: April 28, 2026
> Deliverables: validate end-to-end subscription creation, keeper execution, cancellation, and webhook dispatch on devnet with documented smoke-test coverage.
>
> Milestone 2: Improve merchant product surface
> Target date: April 30, 2026
> Deliverables: complete dashboard flows for plans, transactions, webhook management, and API key handling, with UX fixes for auth, validation, and loading states.
>
> Milestone 3: Harden integrations and developer tooling
> Target date: May 2, 2026
> Deliverables: improve SDK usage flow, integration documentation, local/devnet demo scripts, and operator setup so merchants can trial Recur with minimal setup friction.
>
> Milestone 4: Ship submission-grade proof and public artifacts
> Target date: May 4, 2026
> Deliverables: clean demo recording, public repo updates, devnet proof, and any required Colosseum and grant submission links.

**Primary KPI**
> 25 successfully processed recurring devnet payments across active test subscriptions by May 4, 2026.

**Final tranche checkbox**
> I understand that to receive the final tranche, I must submit the Colosseum project link, GitHub repo link, and AI subscription receipt.
