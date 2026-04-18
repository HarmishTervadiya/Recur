import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";
const p = new PrismaClient();
const subs = await p.subscription.findMany({
  where: { isActive: true },
  include: { plan: true },
});
for (const s of subs) {
  console.log(`Sub ${s.id.slice(0,8)} | plan=$${Number(s.plan.price)} interval=${s.plan.intervalSeconds}s | lastPay=${s.lastPaymentAt?.toISOString() ?? "never"}`);
}
console.log(`Total active: ${subs.length}`);
await p.$disconnect();
