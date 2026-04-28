export interface Plan {
  id: string;
  name: string;
  description: string | null;
  amountBaseUnits: string;
  intervalSeconds: number;
  isActive: boolean;
  planSeed: string;
  createdAt: string;
}

export interface AppDetail {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  amountGross: string;
  platformFee: string;
  amountNet: string;
  status: string;
  txSignature: string | null;
  fromWallet: string | null;
  toWallet: string | null;
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  isActive: boolean;
  createdAt: string;
}

export type Tab = "plans" | "transactions" | "webhooks";

export const INTERVAL_OPTIONS = [
  { label: "Weekly", seconds: 604800 },
  { label: "Monthly", seconds: 2592000 },
  { label: "Quarterly", seconds: 7776000 },
  { label: "Yearly", seconds: 31536000 },
];

export function formatAmount(baseUnits: string | number): string {
  return `$${(Number(baseUnits) / 1_000_000).toFixed(2)}`;
}

export function formatInterval(seconds: number): string {
  const match = INTERVAL_OPTIONS.find((o) => o.seconds === seconds);
  if (match) return match.label;
  const days = Math.round(seconds / 86400);
  return `${days}d`;
}

export function truncateWallet(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}
