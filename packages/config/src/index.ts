import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SOLANA_CLUSTER: z
    .enum(["localnet", "devnet", "mainnet-beta"])
    .default("devnet"),
  SOLANA_RPC_URL: z.string().url().optional(),
  PROGRAM_ID: z
    .string()
    .default("3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx"),
  /// USDC mint address. Override with a localnet mock mint when running
  /// against solana-test-validator. Defaults to the devnet USDC mint.
  USDC_MINT: z.string().default("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  DATABASE_URL: z.string().default("postgresql://localhost:5432/recur"),
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  /// Short-lived access token TTL (default 15 minutes).
  JWT_ACCESS_TTL: z.string().default("15m"),
  /// Refresh token TTL (default 7 days).
  JWT_REFRESH_TTL: z.string().default("7d"),
  KEEPER_SECRET: z
    .string()
    .min(8, "KEEPER_SECRET must be at least 8 characters"),
  KEEPER_KEYPAIR: z.string().optional(),
  API_URL: z.string().url().default("http://localhost:3001"),
  /// Batch size for keeper processing jobs.
  KEEPER_BATCH_SIZE: z.coerce.number().default(20),
});

export type Env = z.infer<typeof envSchema> & { SOLANA_RPC_URL: string };

const CLUSTER_RPC_DEFAULTS: Record<string, string> = {
  localnet: "http://127.0.0.1:8899",
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

function parseEnv(): Env {
  // In development/test, provide insecure defaults so devs can start quickly.
  // In production these MUST be set explicitly via environment variables.
  const isDev = (process.env["NODE_ENV"] ?? "development") !== "production";

  if (isDev) {
    process.env["JWT_SECRET"] =
      process.env["JWT_SECRET"] ?? "dev-secret-at-least-16-chars";
    process.env["JWT_REFRESH_SECRET"] =
      process.env["JWT_REFRESH_SECRET"] ?? "dev-refresh-secret-16-chars";
    process.env["KEEPER_SECRET"] =
      process.env["KEEPER_SECRET"] ?? "dev-keeper-secret";
  }

  const parsed = envSchema.parse(process.env);

  // Resolve RPC URL: explicit env var > cluster default
  const cluster = parsed.SOLANA_CLUSTER;
  const rpcUrl: string =
    parsed.SOLANA_RPC_URL ?? CLUSTER_RPC_DEFAULTS[cluster] ?? CLUSTER_RPC_DEFAULTS["devnet"]!;

  return { ...parsed, SOLANA_RPC_URL: rpcUrl };
}

export const env: Env = parseEnv();
