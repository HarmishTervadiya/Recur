import { notFound } from "next/navigation";
import { RecurClient } from "@recur/sdk";
import { SubscribeFlow } from "../../../components/subscribe/SubscribeFlow";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

const client = new RecurClient({ rpcUrl: RPC_URL, apiBaseUrl: API_URL });

interface SubscribePageProps {
  params: Promise<{ planId: string }>;
}

export default async function SubscribePage({ params }: SubscribePageProps) {
  const { planId } = await params;

  const res = await client.getPlan(planId);

  if (!res.success || !res.data) {
    notFound();
  }

  return <SubscribeFlow plan={res.data} />;
}

export async function generateMetadata({ params }: SubscribePageProps) {
  const { planId } = await params;
  const res = await client.getPlan(planId);
  const plan = res.data;
  return {
    title: plan ? `Subscribe to ${plan.name} — Recur` : "Subscribe — Recur",
    description: plan?.description ?? "Subscribe to a Recur Protocol plan on Solana.",
  };
}
