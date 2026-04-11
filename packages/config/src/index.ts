import { z } from "zod";

const envSchema = z.object({
  SOLANA_RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  PROGRAM_ID: z.string().optional(),
  DATABASE_URL: z.string().default("postgresql://localhost:5432/recur"),
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().default("dev-secret"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
