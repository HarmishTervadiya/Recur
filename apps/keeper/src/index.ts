import { createLogger } from "@recur/logger";
import cron from "node-cron";
import { processPayments } from "./jobs/processPayments.js";
import { finalizeCancel } from "./jobs/finalizeCancel.js";
import { forceCancel } from "./jobs/forceCancel.js";

const logger = createLogger("keeper");

let paymentRunning = false;
let cancelRunning = false;
let forceRunning = false;

const PAYMENT_INTERVAL_MS = parseInt(process.env["KEEPER_POLL_MS"] ?? "15000", 10);

setInterval(async () => {
  if (paymentRunning) return;
  paymentRunning = true;
  try {
    await processPayments();
  } catch (err) {
    logger.error({ err }, "processPayments job crashed");
  } finally {
    paymentRunning = false;
  }
}, PAYMENT_INTERVAL_MS);

setInterval(async () => {
  if (cancelRunning) return;
  cancelRunning = true;
  try {
    await finalizeCancel();
  } catch (err) {
    logger.error({ err }, "finalizeCancel job crashed");
  } finally {
    cancelRunning = false;
  }
}, PAYMENT_INTERVAL_MS);

cron.schedule("*/5 * * * *", async () => {
  if (forceRunning) return;
  forceRunning = true;
  try {
    await forceCancel();
  } catch (err) {
    logger.error({ err }, "forceCancel job crashed");
  } finally {
    forceRunning = false;
  }
});

logger.info(
  { paymentPollMs: PAYMENT_INTERVAL_MS },
  "Recur Keeper started — jobs registered",
);
