/**
 * Webhook Dispatch Integration Test
 *
 * Does NOT require solana-test-validator or devnet funds.
 * Tests the keeper → dispatchWebhook → merchant endpoint pipeline end-to-end.
 *
 * Prerequisites:
 *   1. PostgreSQL running (docker or Neon)
 *   2. API server running: cd apps/api && bun run src/index.ts
 *
 * Usage:
 *   bun run scripts/test-webhooks.ts
 */

import http from "http";
import crypto from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

const API_URL = "http://localhost:3001";
const KEEPER_SECRET = "localnet-keeper-secret";
const RECEIVER_PORT = 9999;

// Fake PDA — just needs to be 32+ chars and unique per run
const FAKE_PDA = `FakePDA${Date.now()}xxxxxxxxxxxxxxxxxxxxxxxxxxx`.slice(0, 44);
const FAKE_TX_SIG = `FakeTxSig${Date.now()}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.slice(0, 88);

// ─── Received webhook log ────────────────────────────────────────────────────

interface ReceivedWebhook {
  headers: Record<string, string>;
  body: string;
  parsedBody: unknown;
}
const received: ReceivedWebhook[] = [];

// ─── Local webhook receiver ──────────────────────────────────────────────────

function startReceiver(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        let parsedBody: unknown;
        try { parsedBody = JSON.parse(body); } catch { parsedBody = body; }
        received.push({
          headers: req.headers as Record<string, string>,
          body,
          parsedBody,
        });
        console.log(`  [receiver] POST ${req.url} — ${body.slice(0, 120)}`);
        res.writeHead(200).end("ok");
      });
    });
    server.listen(RECEIVER_PORT, () => resolve(server));
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`\n  FAIL: ${msg}\n`);
    process.exit(1);
  }
}

function pass(msg: string) {
  console.log(`  ✓  ${msg}`);
}

async function authenticateWallet(kp: Keypair, role: "merchant" | "subscriber"): Promise<string> {
  const walletAddress = kp.publicKey.toBase58();
  const nonceRes = await api("POST", "/auth/nonce", { walletAddress, role });
  assert(nonceRes.json["success"] === true, `nonce failed: ${JSON.stringify(nonceRes.json)}`);
  const { message, nonce } = nonceRes.json["data"] as Record<string, string>;
  const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
  const verifyRes = await api("POST", "/auth/verify", {
    walletAddress, role, nonce, signature: bs58.encode(sig),
  });
  assert(verifyRes.json["success"] === true, `verify failed: ${JSON.stringify(verifyRes.json)}`);
  return ((verifyRes.json["data"] as Record<string, string>)["accessToken"]);
}

function verifyHmac(body: string, secret: string, sigHeader: string): boolean {
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  return sigHeader === expected;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Webhook Dispatch Integration Test");
  console.log("═══════════════════════════════════════════════\n");

  // ── Step 1: Start local webhook receiver ──────────────────────────────────
  console.log("[1] Starting local webhook receiver on port", RECEIVER_PORT);
  const server = await startReceiver();
  pass(`Receiver listening at http://localhost:${RECEIVER_PORT}`);

  // ── Step 2: Auth as merchant ──────────────────────────────────────────────
  console.log("\n[2] Authenticating merchant");
  const merchantKp = Keypair.generate();
  const merchantToken = await authenticateWallet(merchantKp, "merchant");
  const auth = { Authorization: `Bearer ${merchantToken}` };
  pass(`Merchant: ${merchantKp.publicKey.toBase58()}`);

  // ── Step 3: Create app + plan ─────────────────────────────────────────────
  console.log("\n[3] Creating app and plan");
  const appRes = await api("POST", "/merchant/apps", { name: `WebhookTest-${Date.now()}` }, auth);
  assert(appRes.json["success"] === true, `create app: ${JSON.stringify(appRes.json)}`);
  const appId = (appRes.json["data"] as Record<string, string>)["id"];
  pass(`App: ${appId}`);

  const planRes = await api("POST", `/merchant/apps/${appId}/plans`, {
    name: "Test Plan",
    amountBaseUnits: "5000000",
    intervalSeconds: 2592000,
  }, auth);
  assert(planRes.json["success"] === true, `create plan: ${JSON.stringify(planRes.json)}`);
  const planId = (planRes.json["data"] as Record<string, string>)["id"];
  pass(`Plan: ${planId}`);

  // ── Step 4: Register webhook endpoint ────────────────────────────────────
  console.log("\n[4] Registering webhook endpoint");
  const whRes = await api("POST", `/merchant/apps/${appId}/webhooks`, {
    url: `http://localhost:${RECEIVER_PORT}/webhook`,
    events: [],
  }, auth);
  assert(whRes.json["success"] === true, `create webhook: ${JSON.stringify(whRes.json)}`);
  const whData = whRes.json["data"] as Record<string, string>;
  const webhookSecret = whData["secret"];
  const webhookId = whData["id"];
  assert(!!webhookSecret, "webhook secret should be returned");
  assert(webhookSecret.length > 10, "webhook secret should be a real value, not a hash");
  pass(`Webhook endpoint: ${webhookId}`);
  pass(`Secret (raw): ${webhookSecret.slice(0, 16)}...`);

  // ── Step 5: Register a fake subscription ─────────────────────────────────
  console.log("\n[5] Registering subscriber and fake subscription");
  const subscriberKp = Keypair.generate();
  const subscriberToken = await authenticateWallet(subscriberKp, "subscriber");
  const subAuth = { Authorization: `Bearer ${subscriberToken}` };

  const regRes = await api("POST", "/subscriber/subscriptions", {
    appId,
    planId,
    subscriptionPda: FAKE_PDA,
  }, subAuth);
  assert(regRes.json["success"] === true, `register sub: ${JSON.stringify(regRes.json)}`);
  const subscriptionId = (regRes.json["data"] as Record<string, string>)["id"];
  pass(`Subscription: ${subscriptionId} (PDA: ${FAKE_PDA})`);

  // ── Step 6: Fire keeper payment event ────────────────────────────────────
  console.log("\n[6] Firing keeper payment_success event");
  const beforeCount = received.length;
  const keeperHeaders = { "X-Keeper-Secret": KEEPER_SECRET };
  const payRes = await api("POST", "/keeper/payment", {
    subscriptionPda: FAKE_PDA,
    txSignature: FAKE_TX_SIG,
    amountGross: "5000000",
    platformFee: "52500",
    amountNet: "4947500",
    confirmedAt: new Date().toISOString(),
  }, keeperHeaders);
  assert(payRes.json["success"] === true, `keeper payment: ${JSON.stringify(payRes.json)}`);
  pass("Keeper returned 200");

  // ── Step 7: Wait for async dispatch to complete ───────────────────────────
  console.log("\n[7] Waiting for webhook dispatch (up to 8s)...");
  let waited = 0;
  while (received.length === beforeCount && waited < 8000) {
    await new Promise((r) => setTimeout(r, 200));
    waited += 200;
  }

  assert(received.length > beforeCount, `No webhook received after ${waited}ms`);
  const wh = received[received.length - 1]!;
  pass(`Webhook received after ~${waited}ms`);

  // ── Step 8: Verify payload ────────────────────────────────────────────────
  console.log("\n[8] Verifying webhook payload");
  const payload = wh.parsedBody as Record<string, unknown>;
  assert(payload["event"] === "payment_success", `event should be payment_success, got: ${payload["event"]}`);
  assert(typeof payload["timestamp"] === "string", "timestamp should be a string");
  const data = payload["data"] as Record<string, unknown>;
  assert(data["subscriptionPda"] === FAKE_PDA, `PDA mismatch: ${data["subscriptionPda"]}`);
  assert(data["txSignature"] === FAKE_TX_SIG, `txSig mismatch: ${data["txSignature"]}`);
  pass(`event: ${payload["event"]}`);
  pass(`data.subscriptionPda matches`);
  pass(`data.txSignature matches`);

  // ── Step 9: Verify HMAC signature ────────────────────────────────────────
  console.log("\n[9] Verifying HMAC-SHA256 signature");
  const sigHeader = wh.headers["x-recur-signature"] ?? "";
  const tsHeader = wh.headers["x-recur-timestamp"] ?? "";
  assert(sigHeader.startsWith("sha256="), `missing/bad X-Recur-Signature: ${sigHeader}`);
  assert(tsHeader.length > 0, "missing X-Recur-Timestamp");
  const hmacValid = verifyHmac(wh.body, webhookSecret, sigHeader);
  assert(hmacValid, `HMAC verification FAILED. sig=${sigHeader}`);
  pass(`X-Recur-Signature: ${sigHeader.slice(0, 24)}...`);
  pass(`X-Recur-Timestamp: ${tsHeader}`);
  pass("HMAC-SHA256 signature verified ✓");

  // ── Step 10: Verify WebhookDelivery row in DB (via API listing) ───────────
  console.log("\n[10] Checking WebhookDelivery status via DB query");
  // Give a moment for the DB write to commit
  await new Promise((r) => setTimeout(r, 500));
  const { prisma } = await import("../packages/db/src/index.ts");
  const delivery = await prisma.webhookDelivery.findFirst({
    where: { endpointId: webhookId },
    orderBy: { createdAt: "desc" },
  });
  assert(delivery !== null, "No WebhookDelivery row found");
  assert(delivery!.status === "delivered", `Expected status=delivered, got: ${delivery!.status}`);
  assert(delivery!.attempts === 1, `Expected attempts=1, got: ${delivery!.attempts}`);
  assert(delivery!.httpStatusCode === 200, `Expected httpStatusCode=200, got: ${delivery!.httpStatusCode}`);
  pass(`WebhookDelivery.status = ${delivery!.status}`);
  pass(`WebhookDelivery.attempts = ${delivery!.attempts}`);
  pass(`WebhookDelivery.httpStatusCode = ${delivery!.httpStatusCode}`);

  // ── Step 11: Test cancel event dispatch ──────────────────────────────────
  console.log("\n[11] Firing keeper cancel_requested event");
  const beforeCancel = received.length;
  const cancelRes = await api("POST", "/keeper/cancel", {
    subscriptionPda: FAKE_PDA,
    cancelType: "request",
    confirmedAt: new Date().toISOString(),
  }, keeperHeaders);
  assert(cancelRes.json["success"] === true, `keeper cancel: ${JSON.stringify(cancelRes.json)}`);
  pass("Keeper cancel returned 200");

  waited = 0;
  while (received.length === beforeCancel && waited < 8000) {
    await new Promise((r) => setTimeout(r, 200));
    waited += 200;
  }
  assert(received.length > beforeCancel, `No cancel webhook received after ${waited}ms`);
  const cancelWh = received[received.length - 1]!;
  const cancelPayload = cancelWh.parsedBody as Record<string, unknown>;
  assert(cancelPayload["event"] === "cancel_requested", `event should be cancel_requested, got: ${cancelPayload["event"]}`);
  pass(`cancel webhook received: event=${cancelPayload["event"]}`);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("  ALL TESTS PASSED");
  console.log("═══════════════════════════════════════════════\n");

  await prisma.$disconnect();
  server.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("\nTEST FAILED:", err);
  process.exit(1);
});
