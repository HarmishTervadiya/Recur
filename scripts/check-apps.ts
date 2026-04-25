import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";
const p = new PrismaClient();

const apps = await p.app.findMany({ include: { plans: true, webhookEndpoints: true } });
console.log(JSON.stringify(apps, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));

await p.$disconnect();
