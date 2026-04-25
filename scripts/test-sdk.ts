/**
 * @recur/sdk — Verification test script.
 *
 * Run: bun run scripts/test-sdk.ts
 *
 * Tests:
 *   1. Import verification — all exports resolve
 *   2. RecurClient instantiation
 *   3. PDA derivation consistency (matches solana-client)
 *   4. Subscribe transaction builder — correct instruction count + accounts
 *   5. Cancel transaction builder — correct instruction count + accounts
 *   6. Webhook signature verification (sign + verify round-trip)
 *   7. Webhook verification rejects tampered payloads
 *   8. Webhook verification rejects expired timestamps
 *   9. API fetch methods exist and are callable (no server needed — just type check)
 */

import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import crypto from "crypto";

// Import everything from the SDK
import {
  RecurClient,
  verifyWebhookSignature,
  parseWebhookPayload,
  PROGRAM_ID,
  USDC_MINT_DEVNET,
  findSubscriptionPda,
  planSeedToBuffer,
  planSeedToArray,
} from "../packages/sdk/src/index.js";

import type {
  RecurConfig,
  OnChainSubscription,
  SubscribeOptions,
  SubscribeTransaction,
  CancelOptions,
  CancelTransaction,
  PlanInfo,
  SubscriptionInfo,
  TransactionInfo,
  ApiResponse,
  CreatePlanOptions,
  ListOptions,
} from "../packages/sdk/src/index.js";

import type { EventType, SubscriptionStatus, WebhookPayload } from "@recur/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}`);
    failed++;
  }
}

function section(name: string): void {
  console.log(`\n─── ${name} ───`);
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TEST_SUBSCRIBER = new PublicKey("HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH");
const TEST_MERCHANT = new PublicKey("Cm4LcfF5N8Whu1pV3mYcLUuzdjhUhbhNt5GHz62vPGDM");
const TEST_PLAN_SEED = "a1b2c3d4e5f60718"; // 16 hex chars = 8 bytes

const config: RecurConfig = {
  rpcUrl: "https://api.devnet.solana.com",
  apiBaseUrl: "http://localhost:3001",
  programId: PROGRAM_ID.toBase58(),
  usdcMint: USDC_MINT_DEVNET.toBase58(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     @recur/sdk — Verification Test   ║");
  console.log("╚══════════════════════════════════════╝");

  // 1. Import verification
  section("1. Import verification");
  assert(typeof RecurClient === "function", "RecurClient is a constructor");
  assert(typeof verifyWebhookSignature === "function", "verifyWebhookSignature is a function");
  assert(typeof parseWebhookPayload === "function", "parseWebhookPayload is a function");
  assert(PROGRAM_ID instanceof PublicKey, "PROGRAM_ID is a PublicKey");
  assert(USDC_MINT_DEVNET instanceof PublicKey, "USDC_MINT_DEVNET is a PublicKey");
  assert(typeof findSubscriptionPda === "function", "findSubscriptionPda is a function");
  assert(typeof planSeedToBuffer === "function", "planSeedToBuffer is a function");
  assert(typeof planSeedToArray === "function", "planSeedToArray is a function");

  // 2. RecurClient instantiation
  section("2. RecurClient instantiation");
  const client = new RecurClient(config);
  assert(client.connection !== undefined, "connection created");
  assert(client.programId.equals(PROGRAM_ID), "programId matches");
  assert(client.usdcMint.equals(USDC_MINT_DEVNET), "usdcMint matches");
  assert(client.apiBaseUrl === "http://localhost:3001", "apiBaseUrl set correctly");

  // Also test default config (no programId/usdcMint)
  const defaultClient = new RecurClient({
    rpcUrl: "https://api.devnet.solana.com",
    apiBaseUrl: "http://localhost:3001",
  });
  assert(defaultClient.programId.equals(PROGRAM_ID), "default programId matches");
  assert(defaultClient.usdcMint.equals(USDC_MINT_DEVNET), "default usdcMint matches");

  // 3. PDA derivation
  section("3. PDA derivation consistency");
  const seedBuf = planSeedToBuffer(TEST_PLAN_SEED);
  assert(seedBuf.length === 8, "planSeedToBuffer returns 8 bytes");

  const seedArr = planSeedToArray(TEST_PLAN_SEED);
  assert(seedArr.length === 8, "planSeedToArray returns 8 elements");
  assert(seedArr.every((b, i) => b === seedBuf[i]), "array matches buffer");

  const [pdaDirect, bumpDirect] = findSubscriptionPda(
    TEST_SUBSCRIBER,
    TEST_MERCHANT,
    seedBuf,
  );
  const { pda: pdaClient, bump: bumpClient } = client.deriveSubscriptionPda(
    TEST_SUBSCRIBER,
    TEST_MERCHANT,
    TEST_PLAN_SEED,
  );
  assert(pdaDirect.equals(pdaClient), "PDA from solana-client matches SDK client");
  assert(bumpDirect === bumpClient, "Bump matches");
  assert(PublicKey.isOnCurve(pdaDirect) === false, "PDA is off-curve (valid PDA)");

  // 4. Subscribe transaction builder
  section("4. Subscribe transaction builder");
  const subscribeOpts: SubscribeOptions = {
    planId: "test-plan-id",
    merchantWallet: TEST_MERCHANT.toBase58(),
    planSeed: TEST_PLAN_SEED,
    amount: 10_000_000, // $10 USDC
    intervalSeconds: 2_592_000, // 30 days
    delegationCycles: 6,
  };

  const subscribeTx = client.buildSubscribeTransaction(TEST_SUBSCRIBER, subscribeOpts);
  assert(subscribeTx.instructions.length === 2, "2 instructions (approve + initialize)");
  assert(subscribeTx.subscriptionPda.equals(pdaClient), "subscription PDA matches derived PDA");
  assert(subscribeTx.bump === bumpClient, "bump matches");

  // Check approve instruction (first)
  const approveIx = subscribeTx.instructions[0]!;
  assert(approveIx.programId.equals(TOKEN_PROGRAM_ID), "approve ix uses TOKEN_PROGRAM_ID");

  // Check initialize instruction (second)
  const initIx = subscribeTx.instructions[1]!;
  assert(initIx.programId.equals(PROGRAM_ID), "init ix uses PROGRAM_ID");
  assert(initIx.keys.length === 4, "init ix has 4 accounts");
  assert(initIx.keys[0]!.pubkey.equals(pdaClient), "init ix account[0] = subscription PDA");
  assert(initIx.keys[1]!.pubkey.equals(TEST_SUBSCRIBER), "init ix account[1] = subscriber");
  assert(initIx.keys[1]!.isSigner === true, "subscriber is signer");
  assert(initIx.keys[2]!.pubkey.equals(TEST_MERCHANT), "init ix account[2] = merchant");
  assert(initIx.keys[2]!.isSigner === false, "merchant is NOT signer");
  assert(initIx.keys[3]!.pubkey.equals(SystemProgram.programId), "init ix account[3] = system program");

  // Verify instruction data layout: discriminator(8) + amount(8) + interval(8) + planSeed(8)
  assert(initIx.data.length === 32, "init ix data is 32 bytes");
  const ixAmount = initIx.data.readBigUInt64LE(8);
  const ixInterval = initIx.data.readBigUInt64LE(16);
  assert(ixAmount === BigInt(10_000_000), "ix data amount = 10,000,000");
  assert(ixInterval === BigInt(2_592_000), "ix data interval = 2,592,000");

  // Default delegation cycles
  const defaultTx = client.buildSubscribeTransaction(TEST_SUBSCRIBER, {
    ...subscribeOpts,
    delegationCycles: undefined,
  });
  assert(defaultTx.instructions.length === 2, "default cycles: 2 instructions");

  // 5. Cancel transaction builder
  section("5. Cancel transaction builder");
  const cancelOpts: CancelOptions = {
    subscriptionPda: pdaClient.toBase58(),
    subscriberWallet: TEST_SUBSCRIBER.toBase58(),
    merchantWallet: TEST_MERCHANT.toBase58(),
    planSeed: TEST_PLAN_SEED,
  };

  const cancelTx = client.buildCancelTransaction(TEST_SUBSCRIBER, cancelOpts);
  assert(cancelTx.instructions.length === 1, "1 instruction (request_cancel)");

  const cancelIx = cancelTx.instructions[0]!;
  assert(cancelIx.programId.equals(PROGRAM_ID), "cancel ix uses PROGRAM_ID");
  assert(cancelIx.keys.length === 4, "cancel ix has 4 accounts");
  assert(cancelIx.keys[0]!.pubkey.equals(pdaClient), "cancel ix account[0] = subscription PDA");
  assert(cancelIx.keys[0]!.isWritable === true, "subscription PDA is writable");
  assert(cancelIx.keys[1]!.pubkey.equals(TEST_SUBSCRIBER), "cancel ix account[1] = authority");
  assert(cancelIx.keys[1]!.isSigner === true, "authority is signer");
  assert(cancelIx.data.length === 8, "cancel ix data is 8 bytes (discriminator only)");

  // 6. Webhook signature — round-trip
  section("6. Webhook signature verification");
  const webhookSecret = "test_webhook_secret_1234567890abcdef";
  const webhookBody = JSON.stringify({
    event: "payment_success",
    timestamp: new Date().toISOString(),
    data: { subscriptionId: "sub_123", amount: "10000000" },
  });
  const webhookTimestamp = Math.floor(Date.now() / 1000).toString();

  // Sign the same way the dispatcher does
  const expectedHmac = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${webhookTimestamp}.${webhookBody}`)
    .digest("hex");
  const signature = `sha256=${expectedHmac}`;

  const isValid = verifyWebhookSignature(
    webhookBody,
    signature,
    webhookTimestamp,
    webhookSecret,
  );
  assert(isValid === true, "valid signature verifies correctly");

  // 7. Webhook rejects tampered payload
  section("7. Webhook rejects tampered payload");
  const tamperedBody = webhookBody.replace("payment_success", "payment_failed");
  const isTamperedValid = verifyWebhookSignature(
    tamperedBody,
    signature,
    webhookTimestamp,
    webhookSecret,
  );
  assert(isTamperedValid === false, "tampered body is rejected");

  const wrongSecret = verifyWebhookSignature(
    webhookBody,
    signature,
    webhookTimestamp,
    "wrong_secret",
  );
  assert(wrongSecret === false, "wrong secret is rejected");

  const wrongTimestamp = verifyWebhookSignature(
    webhookBody,
    signature,
    "9999999999",
    webhookSecret,
  );
  assert(wrongTimestamp === false, "wrong timestamp in HMAC is rejected");

  // 8. Webhook rejects expired timestamps
  section("8. Webhook timestamp tolerance");
  const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 min ago
  const oldHmac = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${oldTimestamp}.${webhookBody}`)
    .digest("hex");
  const oldSig = `sha256=${oldHmac}`;

  const isExpiredValid = verifyWebhookSignature(
    webhookBody,
    oldSig,
    oldTimestamp,
    webhookSecret,
    300, // 5 min tolerance
  );
  assert(isExpiredValid === false, "expired timestamp (10min old, 5min tolerance) is rejected");

  // Within tolerance
  const recentTimestamp = (Math.floor(Date.now() / 1000) - 60).toString(); // 1 min ago
  const recentHmac = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${recentTimestamp}.${webhookBody}`)
    .digest("hex");
  const recentSig = `sha256=${recentHmac}`;

  const isRecentValid = verifyWebhookSignature(
    webhookBody,
    recentSig,
    recentTimestamp,
    webhookSecret,
    300,
  );
  assert(isRecentValid === true, "recent timestamp (1min old, 5min tolerance) is accepted");

  // 9. parseWebhookPayload
  section("9. parseWebhookPayload");
  const parsed = parseWebhookPayload(webhookBody);
  assert(parsed !== null, "valid payload parses successfully");
  assert(parsed?.event === "payment_success", "event type is correct");
  assert(typeof parsed?.data === "object", "data is an object");

  const badParsed = parseWebhookPayload("not json");
  assert(badParsed === null, "invalid JSON returns null");

  const emptyParsed = parseWebhookPayload('{"foo":"bar"}');
  assert(emptyParsed === null, "missing event/timestamp/data returns null");

  // 10. API methods exist
  section("10. API methods type-check");
  assert(typeof client.getPlans === "function", "getPlans exists");
  assert(typeof client.getPlan === "function", "getPlan exists");
  assert(typeof client.createPlan === "function", "createPlan exists");
  assert(typeof client.listPlans === "function", "listPlans exists");
  assert(typeof client.listSubscriptions === "function", "listSubscriptions exists");
  assert(typeof client.getPaymentHistory === "function", "getPaymentHistory exists");
  assert(typeof client.getSubscriptionAccount === "function", "getSubscriptionAccount exists");
  assert(typeof client.deriveSubscriptionPda === "function", "deriveSubscriptionPda exists");
  assert(typeof client.buildSubscribeTransaction === "function", "buildSubscribeTransaction exists");
  assert(typeof client.buildCancelTransaction === "function", "buildCancelTransaction exists");

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n══════════════════════════════════════");
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log("══════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
