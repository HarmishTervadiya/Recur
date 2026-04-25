import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";
const p = new PrismaClient();

await p.subscription.update({
  where: { subscriptionPda: "4Cem9WP9kkPedPFo7q6Ahap7GiTvjjwxtsStEiiXhWTH" },
  data: {
    status: "active",
    lastPaymentAt: null,
    nextPaymentDue: new Date(Date.now() + 10 * 1000),
    cancelRequestedAt: null,
    cancelledAt: null,
  },
});
console.log("Fixed: PDA 4Cem9 reactivated");
await p.$disconnect();
