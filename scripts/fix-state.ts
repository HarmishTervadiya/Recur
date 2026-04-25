import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";
const p = new PrismaClient();

// Fix: PDA 4Cem9 is active on-chain but cancelled in DB
await p.subscription.update({
  where: { subscriptionPda: "4Cem9WP9kkPedPFo7q6Ahap7GiTvjjwxtsStEiiXhWTH" },
  data: {
    status: "active",
    cancelledAt: null,
    cancelRequestedAt: null,
    lastPaymentAt: new Date(1777129684 * 1000), // from on-chain lastPayTs
    nextPaymentDue: new Date((1777129684 + 10) * 1000), // lastPayTs + interval
  },
});

// Create the missing transaction record
await p.merchantTransaction.create({
  data: {
    subscriptionId: "cmoegie5w000410op5p9bcfit",
    txSignature: "3wnPGVrSHBDgu89sRLSRQbFJ8zLZDMGuiBRLSqQF984CstFxezjJA7gEoJgHmWaPNuVXk41MZRMnPTffBsAKWzAt",
    status: "success",
    amountGross: "5000000",
    platformFee: "50000",
    amountNet: "4950000",
    fromWallet: "9uUYYvkEjEQTd7T5VgqEFkiWgFnTsRfiDqVEdwz5BEDS",
    toWallet: "jHvTLkiejNcaY7bBpvv5EBV3fh5ooAW2VWgTfLdknx7",
  },
});

console.log("Fixed: PDA 4Cem9 restored to active with payment recorded");
await p.$disconnect();
