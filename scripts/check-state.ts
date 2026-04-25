import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";
const p = new PrismaClient();
const subs = await p.subscription.findMany({
  include: { plan: true, transactions: true, subscriber: true },
  orderBy: { createdAt: "desc" },
});
console.log(JSON.stringify(subs, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));
await p.$disconnect();
