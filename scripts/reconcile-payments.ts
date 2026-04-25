/**
 * reconcile-payments.ts — One-off script to reconcile on-chain payment state
 * with the DB for subscriptions where the keeper failed to report.
 */
import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";
import { Connection, PublicKey } from "@solana/web3.js";

const p = new PrismaClient();
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const PROGRAM_ID = new PublicKey("3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx");

// Subscriptions that had on-chain payments but keeper never reported
const TARGET_PDAS = [
  "2fRWQm1259MpzbmQsTmuK5bunCGhGTT7VcoFueuXvdvL",
  "ArRxMUF68M5wxEcL4sjtoDAE4EriWwFuAg9dHq2dsm9a",
  "3jbJL3xTiFNm2U6Q4zJdL4tf95LzrxLFGkrcGwF5r4mf",
];

for (const pdaStr of TARGET_PDAS) {
  const info = await conn.getAccountInfo(new PublicKey(pdaStr));
  if (!info) {
    console.log(`${pdaStr}: NOT FOUND on-chain, skipping`);
    continue;
  }

  const d = Buffer.from(info.data);
  const o = 8;
  const lastPayTs = d.readBigUInt64LE(o + 88);
  const cancelReq = d.readBigUInt64LE(o + 104);
  const interval = d.readBigUInt64LE(o + 80);

  const sub = await p.subscription.findFirst({ where: { subscriptionPda: pdaStr }, include: { plan: true } });
  if (!sub) {
    console.log(`${pdaStr}: NOT FOUND in DB, skipping`);
    continue;
  }

  console.log(`\n${pdaStr}:`);
  console.log(`  DB status: ${sub.status}, lastPaymentAt: ${sub.lastPaymentAt}`);
  console.log(`  On-chain lastPayTs: ${lastPayTs}, cancelReq: ${cancelReq}`);

  const updates: Record<string, unknown> = {};

  // Update lastPaymentAt if on-chain shows payment was made
  if (lastPayTs > 0n && !sub.lastPaymentAt) {
    const payDate = new Date(Number(lastPayTs) * 1000);
    const nextDue = new Date(payDate.getTime() + Number(interval) * 1000);
    updates.lastPaymentAt = payDate;
    updates.nextPaymentDue = nextDue;
    console.log(`  -> Setting lastPaymentAt: ${payDate.toISOString()}`);

    // Also create a synthetic transaction record
    await p.merchantTransaction.create({
      data: {
        subscriptionId: sub.id,
        txSignature: `reconciled-${pdaStr.slice(0, 20)}-${Date.now()}`,
        status: "success",
        amountGross: sub.plan.amountBaseUnits,
        platformFee: "0",
        amountNet: sub.plan.amountBaseUnits,
        fromWallet: "reconciled",
        toWallet: "reconciled",
      },
    });
    console.log(`  -> Created synthetic transaction record`);
  }

  // Update cancel status if on-chain shows cancel requested
  if (cancelReq > 0n && !sub.cancelRequestedAt) {
    const cancelDate = new Date(Number(cancelReq) * 1000);
    updates.cancelRequestedAt = cancelDate;
    updates.status = "cancelled";
    updates.cancelledAt = cancelDate;
    console.log(`  -> Setting cancelled at: ${cancelDate.toISOString()}`);
  }

  if (Object.keys(updates).length > 0) {
    await p.subscription.update({ where: { id: sub.id }, data: updates });
    console.log(`  -> Updated`);
  } else {
    console.log(`  -> No updates needed`);
  }
}

await p.$disconnect();
console.log("\nDone!");
