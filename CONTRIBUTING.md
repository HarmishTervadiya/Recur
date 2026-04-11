# Contributing to Recur

Thank you for your interest in contributing. This guide covers everything you need to
know before opening a pull request — from branching conventions to how we review code.

---

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Branch and commit conventions](#branch-and-commit-conventions)
- [Development workflow](#development-workflow)
- [Coding standards](#coding-standards)
- [Testing](#testing)
- [Pull request process](#pull-request-process)
- [Package conventions](#package-conventions)
- [Smart contract contributions](#smart-contract-contributions)
- [Asking for help](#asking-for-help)

---

## Code of conduct

Be respectful. Critique code, not people. We are a small team building fast — patience and
clarity in communication go a long way.

---

## Getting started

1. Fork the repository and clone your fork.
2. Follow [SETUP.md](SETUP.md) to get your local environment running.
3. Create a branch for your work (see [branch conventions](#branch-and-commit-conventions)).
4. Make your changes, write tests, and open a PR against `main`.

---

## Project structure

Before contributing, read [SETUP.md](SETUP.md) and familiarise yourself with the
[master project prompt](PROMPT.md) — it describes the architecture, domain concepts,
and all coding conventions in detail.

The short version: this is a **Turborepo + Bun** monorepo. Work is divided into `apps/`
(runnable services) and `packages/` (shared libraries). The Anchor smart contract lives
in `contracts/`.

---

## Branch and commit conventions

### Branch naming

```
<type>/<short-description>
```

| Type | When to use |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `chore/` | Tooling, config, dependency updates |
| `refactor/` | Code restructuring with no behaviour change |
| `docs/` | Documentation only |
| `test/` | Adding or fixing tests |
| `contract/` | Changes to the Anchor program |

Examples:
```
feat/keeper-preflight-balance-check
fix/subscription-pda-clock-drift
docs/sdk-readme
contract/force-cancel-instruction
```

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

The `scope` should be the app or package name:

```
feat(keeper): add exponential backoff for dropped transactions
fix(api): validate webhook URL format on plan creation
chore(db): add PaymentEvent migration
contract(recur): enforce 60s clock drift buffer in process_payment
```

Keep the subject line under 72 characters. Write in the imperative mood ("add", "fix",
"remove" — not "added", "fixes", "removed").

---

## Development workflow

### Running everything

```bash
bun install          # install all workspace dependencies
bun run dev          # start all apps and watch packages simultaneously
```

Turborepo runs `dev` across all apps in parallel. Each app logs with its name prefix.

### Running a single app or package

```bash
bun run dev --filter=web      # only the Next.js app
bun run dev --filter=api      # only the Express API
bun run dev --filter=keeper   # only the Keeper worker
```

### Building

```bash
bun run build                 # full monorepo build (respects dependency order)
bun run build --filter=@recur/sdk   # build a single package
```

### Linting and type checking

```bash
bun run lint        # ESLint across all packages
bun run typecheck   # tsc --noEmit across all packages
```

Both run as part of CI. Fix lint errors before pushing.

---

## Coding standards

All standards are defined in detail in [PROMPT.md](PROMPT.md). The key rules:

**TypeScript**
- Strict mode everywhere. No `any`.
- Parse external data with Zod at the boundary; pass typed values down.
- All exported functions have explicit return types.

**Zod schemas**
- Defined in `@recur/types`. Never duplicated across apps.
- Route handlers validate with Zod, then pass typed data to service functions.

**Express**
- Route handlers are thin (validate → call service → respond).
- Business logic lives in service files.
- Errors are thrown as `AppError` and caught by the central `errorHandler` middleware.

**Imports**
- Cross-package imports use `@recur/<package>` — never relative paths across package boundaries.
- Within a package, use relative imports.

**Naming**
- Files: `kebab-case`
- TypeScript: `camelCase` for vars/functions, `PascalCase` for types/classes, `SCREAMING_SNAKE_CASE` for constants
- Rust: `snake_case` per Rust convention
- Database columns: `snake_case` (Prisma maps to `camelCase` in TypeScript automatically)

---

## Testing

### TypeScript tests

We use **Vitest** for unit and integration tests.

```bash
bun run test              # run all tests
bun run test --filter=api # run tests for a specific app/package
```

Test files live alongside source files: `src/modules/subscription/subscription.service.test.ts`.

**What to test:**
- Service functions (pure logic, mock the Prisma client)
- Zod schema validation edge cases
- Keeper pre-flight checks

**What not to unit test:**
- Route handler wiring (covered by integration tests)
- Prisma model definitions

### Anchor (smart contract) tests

Tests live in `contracts/tests/`. We use **Bankrun** for fast local testing without a
full validator.

```bash
cd contracts
anchor test         # runs all Anchor tests against localnet
```

Every new instruction needs at minimum:
- A happy path test
- A test for each custom error condition
- An edge case test for the 60-second clock drift buffer

---

## Pull request process

1. **Keep PRs focused.** One logical change per PR. If you're fixing a bug and refactoring
   related code, split them into two PRs.

2. **Fill out the PR template.** Describe what changed and why. Link the relevant issue
   if one exists.

3. **All CI checks must pass** before review:
   - `bun run typecheck`
   - `bun run lint`
   - `bun run test`
   - `anchor test` (if `contracts/` was touched)

4. **Request review** from at least one team member. Don't merge your own PR without review
   unless it's a trivial docs fix.

5. **Squash and merge.** We prefer a clean linear history. Squash your commits into one
   (or a small number of logical commits) before merging.

---

## Package conventions

### Adding a new shared package

1. Create `packages/<name>/` with a `package.json` using `"name": "@recur/<name>"`.
2. Add a `tsconfig.json` that extends `@recur/config/tsconfig.base.json`.
3. Export everything from a single `src/index.ts` barrel file.
4. Add the package to the `workspaces` build graph in `turbo.json` if it has a build step.

### Adding a dependency

```bash
# Add to a specific app or package
bun add <package> --cwd apps/api

# Add to a shared package
bun add <package> --cwd packages/types

# Add a dev dependency to the root
bun add -d <package>
```

Never add runtime dependencies to the root `package.json` — it is for tooling only.

---

## Smart contract contributions

Changes to `contracts/` have the highest bar for review because deployed programs are
immutable on Solana mainnet.

Before submitting a contract PR:

- [ ] All new instructions have corresponding Bankrun tests.
- [ ] All account constraints are validated with Anchor's `#[account]` macro — never
      assume accounts are valid.
- [ ] Custom errors in `errors.rs` have descriptive names and doc comments.
- [ ] The 60-second clock drift buffer is preserved in all time-based checks.
- [ ] You have run `anchor build` and committed the updated IDL in `contracts/idl/`.
- [ ] If the instruction changes the `Subscription` PDA layout, you have documented the
      migration path.

---

## Asking for help

Open a GitHub Discussion if you're unsure where something belongs or want to propose a
larger change before writing code. For small questions, add a comment to the relevant
issue or PR.
