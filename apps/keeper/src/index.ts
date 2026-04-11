import { createLogger } from "@recur/logger";

const logger = createLogger("keeper");

logger.info("🔄 Recur Keeper starting...");

setInterval(() => {
  logger.debug("Heartbeat — checking for due subscriptions...");
}, 60_000);
