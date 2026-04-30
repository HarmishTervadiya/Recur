/**
 * Cluster-keyed default endpoints for the Recur SDK.
 *
 * Single source of truth for `cluster -> { rpcUrl, programId, usdcMint }`.
 * Consumed by `@recur/sdk` `RecurClient` and by `@recur/react` `<RecurProvider>`.
 */

export type Cluster = "devnet" | "mainnet";

export interface ClusterDefaults {
  rpcUrl: string;
  programId: string;
  usdcMint: string;
}

const DEVNET: ClusterDefaults = {
  rpcUrl: "https://api.devnet.solana.com",
  programId: "3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx",
  usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};

const MAINNET: ClusterDefaults = {
  rpcUrl: "https://api.mainnet-beta.solana.com",
  programId: "3pQTZk5w2AJLpB8zVLPxgU33PkyYZAfwgMoQzZRLoAxx",
  usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

export function getClusterDefaults(cluster: Cluster): ClusterDefaults {
  return cluster === "mainnet" ? MAINNET : DEVNET;
}
