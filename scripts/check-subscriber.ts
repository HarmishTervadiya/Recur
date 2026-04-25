import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";
const p = new PrismaClient();

const subs = await p.subscription.findMany({
  where: { subscriber: { walletAddress: "9uUYYvkEjEQTd7T5VgqEFkiWgFnTsRfiDqVEdwz5BEDS" } },
  include: { plan: true, transactions: { orderBy: { createdAt: "desc" }, take: 5 } },
});
console.log(JSON.stringify(subs, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));

await p.$disconnect();
