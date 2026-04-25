import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";
import crypto from "crypto";

const p = new PrismaClient();
const APP_ID = "cmoef7yz9000q12vlls362oe1";
const WEBHOOK_URL = "http://localhost:4000/webhooks/recur";
const secret = crypto.randomBytes(32).toString("hex");

const endpoint = await p.webhookEndpoint.create({
  data: {
    appId: APP_ID,
    url: WEBHOOK_URL,
    secret,
    events: ["payment_success", "payment_failed", "cancel_requested", "cancel_finalized", "cancel_forced"],
  },
});

console.log(`Webhook ID: ${endpoint.id}`);
console.log(`Webhook URL: ${endpoint.url}`);
console.log(`Webhook secret: ${secret}`);
console.log(`\nAdd to your .env files:\n  RECUR_WEBHOOK_SECRET=${secret}`);

await p.$disconnect();
