import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";
const p = new PrismaClient();

const txs = await p.merchantTransaction.findMany({
  orderBy: { createdAt: "desc" },
  take: 10,
  select: { id: true, txSignature: true, status: true, amountGross: true, createdAt: true, subscriptionId: true },
});
console.log("MerchantTransactions:", JSON.stringify(txs, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));

const subs = await p.subscription.findMany({
  where: { status: "active" },
  select: { id: true, subscriptionPda: true, status: true, lastPaymentAt: true, nextPaymentDue: true },
});
console.log("\nActive Subscriptions:", JSON.stringify(subs, null, 2));

await p.$disconnect();
