/**
 * Seed the Recur Platform merchant, app, and Pro plans.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   bun run scripts/seed-platform-merchant.ts
 *
 * Requires DATABASE_URL in environment (loaded from .env).
 */

import { PrismaClient } from "../packages/db/node_modules/@prisma/client";
import { Keypair } from "@solana/web3.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

/**
 * Resolve the platform wallet address:
 * 1. Use RECUR_PLATFORM_WALLET env var if set
 * 2. Otherwise, generate a keypair and save to keys/platform-wallet.json
 */
function resolvePlatformWallet(): string {
  const envWallet = process.env["RECUR_PLATFORM_WALLET"];
  if (envWallet && envWallet.length >= 32) {
    return envWallet;
  }

  const keyPath = path.resolve(__dirname, "../keys/platform-wallet.json");

  // If keypair already exists, load it
  if (fs.existsSync(keyPath)) {
    const keyData = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keyData));
    console.log(`  Using existing platform keypair: ${keypair.publicKey.toBase58()}`);
    return keypair.publicKey.toBase58();
  }

  // Generate new keypair
  const keypair = Keypair.generate();
  fs.writeFileSync(keyPath, JSON.stringify(Array.from(keypair.secretKey)));
  console.log(`  Generated new platform keypair: ${keypair.publicKey.toBase58()}`);
  console.log(`  Saved to: ${keyPath}`);
  return keypair.publicKey.toBase58();
}

const PLATFORM_WALLET = resolvePlatformWallet();

async function main() {
  console.log("Seeding Recur Platform merchant...\n");

  // 1. Merchant — upsert by wallet address
  // Also clean up any old invalid platform merchant
  const oldMerchant = await prisma.merchant.findFirst({
    where: { businessName: "Recur Protocol" },
  });
  if (oldMerchant && oldMerchant.walletAddress !== PLATFORM_WALLET) {
    // Migrate old platform merchant to new wallet address
    await prisma.merchant.update({
      where: { id: oldMerchant.id },
      data: { walletAddress: PLATFORM_WALLET },
    });
    console.log(`  Migrated platform merchant from ${oldMerchant.walletAddress} to ${PLATFORM_WALLET}`);
  }

  const merchant = await prisma.merchant.upsert({
    where: { walletAddress: PLATFORM_WALLET },
    update: {},
    create: {
      walletAddress: PLATFORM_WALLET,
      name: "Recur Platform",
      businessName: "Recur Protocol",
      businessUrl: "https://recur.so",
      tier: "free", // The platform merchant itself isn't a Pro user
    },
  });
  console.log(`  Merchant: ${merchant.id} (${merchant.walletAddress})`);

  // 2. App
  let app = await prisma.app.findFirst({
    where: { merchantId: merchant.id, name: "Recur Platform" },
  });
  if (!app) {
    app = await prisma.app.create({
      data: {
        merchantId: merchant.id,
        name: "Recur Platform",
        description: "Recur's own platform billing",
      },
    });
  }
  console.log(`  App: ${app.id}`);

  // 3. Monthly Pro plan ($49/mo)
  const monthlyPlanSeed = crypto.randomBytes(8).toString("hex");
  let monthlyPlan = await prisma.plan.findFirst({
    where: { appId: app.id, name: "Recur Pro" },
  });
  if (!monthlyPlan) {
    monthlyPlan = await prisma.plan.create({
      data: {
        appId: app.id,
        name: "Recur Pro",
        description: "Pro tier — $49/mo USDC",
        planSeed: monthlyPlanSeed,
        amountBaseUnits: BigInt(49_000_000), // $49.00 USDC (6 decimals)
        intervalSeconds: 2_592_000, // 30 days
        currency: "USDC",
      },
    });
  }
  console.log(`  Monthly Plan: ${monthlyPlan.id} (seed: ${monthlyPlan.planSeed})`);

  // 4. Annual Pro plan ($490/yr — 2 months free)
  const annualPlanSeed = crypto.randomBytes(8).toString("hex");
  let annualPlan = await prisma.plan.findFirst({
    where: { appId: app.id, name: "Recur Pro Annual" },
  });
  if (!annualPlan) {
    annualPlan = await prisma.plan.create({
      data: {
        appId: app.id,
        name: "Recur Pro Annual",
        description: "Pro tier — $490/yr USDC (2 months free)",
        planSeed: annualPlanSeed,
        amountBaseUnits: BigInt(490_000_000), // $490.00 USDC
        intervalSeconds: 31_536_000, // 365 days
        currency: "USDC",
      },
    });
  }
  console.log(`  Annual Plan: ${annualPlan.id} (seed: ${annualPlan.planSeed})`);

  // 5. Store in GlobalConfig for API / frontend lookups
  const configs: Record<string, string> = {
    "platform.appId": app.id,
    "platform.merchantId": merchant.id,
    "platform.proPlanId": monthlyPlan.id,
    "platform.proPlanSeed": monthlyPlan.planSeed,
    "platform.annualPlanId": annualPlan.id,
    "platform.annualPlanSeed": annualPlan.planSeed,
  };

  for (const [key, value] of Object.entries(configs)) {
    await prisma.globalConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  console.log("\n  GlobalConfig entries written:");
  for (const [key, value] of Object.entries(configs)) {
    console.log(`    ${key} = ${value}`);
  }

  console.log("\nPlatform merchant seeded successfully.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
