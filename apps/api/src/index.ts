import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { createLogger } from "@recur/logger";

const logger = createLogger("api");
const app: Express = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info(`🚀 Recur API running on http://localhost:${PORT}`);
});

export default app;
