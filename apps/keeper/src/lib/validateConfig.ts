import { PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { createLogger } from "@recur/logger";
import { env } from "@recur/config";
import { connection, keeperKeypair } from "../solana.js";
import { findTreasuryVaultPda } from "@recur/solana-client";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const logger = createLogger("boot");

/**
 * Boot-time checks to catch misconfigurations before the keeper starts
 * processing payments. Throws on fatal issues, warns on non-fatal ones.
 */
export async function validateConfig(): Promise<void> {
  const USDC_MINT = new PublicKey(env.USDC_MINT);

  // 1. Verify USDC_MINT is a valid mint on-chain
  try {
    const mint = await getMint(connection, USDC_MINT);
    logger.info(
      { mint: USDC_MINT.toBase58(), decimals: mint.decimals, supply: mint.supply.toString() },
      "USDC_MINT verified on-chain",
    );
  } catch (err) {
    logger.fatal(
      { mint: env.USDC_MINT, err },
      "USDC_MINT is not a valid SPL token mint — check your .env",
    );
    process.exit(1);
  }

  // 2. Verify keeper has SOL for transaction fees
  const balance = await connection.getBalance(keeperKeypair.publicKey);
  const balanceSol = balance / 1e9;
  if (balanceSol < 0.01) {
    logger.fatal(
      { keeper: keeperKeypair.publicKey.toBase58(), balanceSol },
      "Keeper wallet has insufficient SOL for transaction fees",
    );
    process.exit(1);
  }
  logger.info(
    { keeper: keeperKeypair.publicKey.toBase58(), balanceSol: balanceSol.toFixed(4) },
    "Keeper wallet balance OK",
  );

  // 3. Log derived treasury vault ATA
  const [treasuryVault] = findTreasuryVaultPda();
  const treasuryAta = getAssociatedTokenAddressSync(USDC_MINT, treasuryVault, true);
  logger.info(
    { treasuryVault: treasuryVault.toBase58(), treasuryAta: treasuryAta.toBase58() },
    "Treasury vault config",
  );

  // 4. Verify RPC is reachable (we already called getBalance above, so this is confirmed)
  logger.info({ rpc: env.SOLANA_RPC_URL.replace(/api-key=.*/, "api-key=***") }, "RPC connected");
}
