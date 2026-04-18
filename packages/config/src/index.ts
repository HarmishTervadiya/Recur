import { z } from "zod";

const envSchema = z.object({
  SOLANA_RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  PROGRAM_ID: z
    .string()
    .default("Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj"),
  /// USDC mint address. Override with a localnet mock mint when running
  /// against solana-test-validator. Defaults to the devnet USDC mint.
  USDC_MINT: z
    .string()
    .default("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  DATABASE_URL: z.string().default("postgresql://localhost:5432/recur"),
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().default("dev-secret"),
  KEEPER_SECRET: z.string().default("dev-keeper-secret"),
  KEEPER_KEYPAIR: z.string().optional(),
  API_URL: z.string().url().default("http://localhost:3001"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
