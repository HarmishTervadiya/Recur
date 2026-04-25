import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";
const p = new PrismaClient();

// Find subscriptions with fake/invalid PDAs
const subs = await p.subscription.findMany({
  where: { subscriptionPda: { startsWith: "Fake" } },
  select: { id: true, subscriptionPda: true, status: true },
});

console.log(`Found ${subs.length} fake PDA subscriptions:`);
for (const s of subs) console.log(`  ${s.id} — ${s.subscriptionPda} (${s.status})`);

if (subs.length > 0) {
  // Delete their transactions first, then the subscriptions
  for (const s of subs) {
    await p.merchantTransaction.deleteMany({ where: { subscriptionId: s.id } });
    await p.subscriptionEvent.deleteMany({ where: { subscriptionId: s.id } });
  }
  const deleted = await p.subscription.deleteMany({
    where: { subscriptionPda: { startsWith: "Fake" } },
  });
  console.log(`Deleted ${deleted.count} fake subscriptions`);
}

await p.$disconnect();
