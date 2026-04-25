"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RecurClient } from "@recur/sdk";
import type { PlanInfo } from "@recur/sdk";

const APP_ID = process.env.NEXT_PUBLIC_RECUR_APP_ID ?? "";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

const client = new RecurClient({ rpcUrl: RPC_URL, apiBaseUrl: API_URL });

// Format USDC amount: base units (6 decimals) → "$X"
function formatUsdc(baseUnits: string): string {
  const n = Number(baseUnits) / 1_000_000;
  return n === 0 ? "Free" : `$${n % 1 === 0 ? n : n.toFixed(2)}`;
}

// Format interval seconds → human-readable
function formatInterval(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 2_592_000) return `${Math.round(seconds / 86400)}d`;
  return `${Math.round(seconds / 2_592_000)} mo`;
}

const comparisonRows = [
  { feature: "Per-Tx Fee", stripe: "1.5%", gocardless: "$0.20 + 2%", boomfi: "1% - 2%", recur: "$0.05 + 0.25%", recurHighlight: true },
  { feature: "$5/Mo Sub Cost", stripe: "~$0.08", gocardless: "~$0.30", boomfi: "~$0.10", recur: "~$0.06", recurHighlight: true },
  { feature: "$100/Mo Cost", stripe: "$1.50", gocardless: "$2.20", boomfi: "$1.00+", recur: "$0.30", recurHighlight: true },
  { feature: "Settlement", stripe: "Fiat (USD)", gocardless: "Fiat", boomfi: "Crypto/Fiat", recur: "USDC Direct", recurHighlight: false },
  { feature: "Chain", stripe: "EVM Only", gocardless: "N/A", boomfi: "Multi EVM", recur: "Solana Native", recurHighlight: false },
  { feature: "Finality", stripe: "~2s", gocardless: "2-5 Days", boomfi: "2-15s", recur: "400ms", recurHighlight: true },
  { feature: "KYC Required", stripe: "Yes", gocardless: "Yes", boomfi: "KYB", recur: "No", recurHighlight: true },
  { feature: "Integration", stripe: "Sessions + Webhooks", gocardless: "API + Redirect", boomfi: "Paylink/API", recur: "3 Lines of React", recurHighlight: false },
  { feature: "Approvals", stripe: "Uncapped", gocardless: "Bank Mandate", boomfi: "SC Permit", recur: "Capped SPL Delegate", recurHighlight: true },
];

// Default plan features for known Harmis Cloud plan names, with generic fallback
function getPlanFeatures(planName: string): string[] {
  const name = planName.toLowerCase();
  if (name.includes("starter")) {
    return ["50 GB storage", "100 GB bandwidth", "Webhook notifications", "On-chain transparency", "Cancel anytime"];
  }
  if (name.includes("pro")) {
    return ["500 GB storage", "1 TB bandwidth", "Everything in Starter", "Priority keeper execution", "Dedicated support"];
  }
  return ["Unlimited subscriptions", "SDK + React component", "Webhook notifications", "On-chain transparency", "Cancel anytime"];
}

interface PlanCardProps {
  plan: PlanInfo;
  highlight: boolean;
}

function LivePlanCard({ plan, highlight }: PlanCardProps) {
  const features = getPlanFeatures(plan.name);
  const price = formatUsdc(plan.amountBaseUnits);
  const interval = formatInterval(plan.intervalSeconds);

  if (highlight) {
    return (
      <div className="bg-recur-surface border-2 border-recur-primary rounded-[14px] p-6 relative animate-glow-pulse">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-recur-primary px-3 py-1 rounded-full">
          RECOMMENDED
        </div>
        <div className="text-[11px] font-semibold text-recur-light uppercase tracking-wider mb-3">
          {plan.name}
        </div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-[32px] font-[900] text-recur-text-heading">{price}</span>
          {price !== "Free" && (
            <span className="text-[14px] text-recur-text-muted">/{interval}</span>
          )}
        </div>
        {plan.description && (
          <p className="text-[13px] text-recur-text-muted mb-5">{plan.description}</p>
        )}
        <div className="space-y-2 mb-6">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2 text-[13px] text-recur-text-body">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7l3 3 5-6" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {f}
            </div>
          ))}
        </div>
        <Link
          href="#developers"
          className="block w-full text-center text-[13px] font-bold text-white bg-recur-primary rounded-[10px] py-2.5 hover:brightness-110 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary focus-visible:ring-offset-2 focus-visible:ring-offset-recur-base"
        >
          View integration
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-recur-surface border border-recur-border rounded-[14px] p-6">
      <div className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-3">
        {plan.name}
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-[32px] font-[900] text-recur-text-heading">{price}</span>
        {price !== "Free" && (
          <span className="text-[14px] text-recur-text-muted">/{interval}</span>
        )}
      </div>
      {plan.description && (
        <p className="text-[13px] text-recur-text-muted mb-5">{plan.description}</p>
      )}
      <div className="space-y-2 mb-6">
        {features.map((f) => (
          <div key={f} className="flex items-center gap-2 text-[13px] text-recur-text-body">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7l3 3 5-6" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {f}
          </div>
        ))}
      </div>
      <Link
        href="#developers"
        className="block w-full text-center text-[13px] font-semibold text-recur-light border border-recur-border-light rounded-[10px] py-2.5 hover:border-recur-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary focus-visible:ring-offset-2 focus-visible:ring-offset-recur-base"
      >
        View integration
      </Link>
    </div>
  );
}

export function Pricing() {
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!APP_ID) { setLoading(false); return; }
    client.getPlans(APP_ID)
      .then((res) => { if (res.success && res.data) setPlans(res.data); })
      .catch(() => {/* silently fall through to static fallback */})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="pricing" className="section-animate py-24 px-6">
      <div className="max-w-container mx-auto">
        <div className="text-center mb-12">
          <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-recur-primary mb-2">
            Pricing
          </div>
          <h2 className="text-[clamp(24px,3.5vw,32px)] font-[800] tracking-[-0.02em] mb-3">
            The Numbers Speak for Themselves
          </h2>
          <p className="text-[15px] text-recur-text-body max-w-[480px] mx-auto">
            Transparent pricing. No hidden fees. No asterisks. Compare us to anyone.
          </p>
        </div>

        {/* Plan cards — live from API, skeleton while loading */}
        <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-14">
          {loading ? (
            <>
              <div className="animate-pulse bg-recur-border rounded-[14px] h-[340px]" />
              <div className="animate-pulse bg-recur-border rounded-[14px] h-[340px]" />
            </>
          ) : plans.length > 0 ? (
            plans.map((plan, i) => (
              <LivePlanCard key={plan.id} plan={plan} highlight={i === plans.length - 1} />
            ))
          ) : (
            /* Static fallback when API is unreachable or APP_ID not set */
            <>
              <div className="bg-recur-surface border border-recur-border rounded-[14px] p-6">
                <div className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-3">Starter</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-[32px] font-[900] text-recur-text-heading">Free</span>
                </div>
                <p className="text-[13px] text-recur-text-muted mb-5">For developers testing on Devnet</p>
                <div className="space-y-2 mb-6">
                  {["$0.05 flat + 0.25% per tx", "Unlimited Subscriptions", "SDK + React Component", "Webhook Notifications"].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-[13px] text-recur-text-body">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M3 7l3 3 5-6" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {f}
                    </div>
                  ))}
                </div>
                <button className="w-full text-center text-[13px] font-semibold text-recur-light border border-recur-border-light rounded-[10px] py-2.5 hover:border-recur-primary transition-colors">
                  Get Started
                </button>
              </div>
              <div className="bg-recur-surface border-2 border-recur-primary rounded-[14px] p-6 relative animate-glow-pulse">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-recur-primary px-3 py-1 rounded-full">RECOMMENDED</div>
                <div className="text-[11px] font-semibold text-recur-light uppercase tracking-wider mb-3">Pro</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-[32px] font-[900] text-recur-text-heading">$49</span>
                  <span className="text-[14px] text-recur-text-muted">/month</span>
                </div>
                <p className="text-[13px] text-recur-text-muted mb-5">For production merchants</p>
                <div className="space-y-2 mb-6">
                  {["Everything in Starter", "Merchant Dashboard", "Priority Keeper Execution", "Custom Branding", "Dedicated Support"].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-[13px] text-recur-text-body">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M3 7l3 3 5-6" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {f}
                    </div>
                  ))}
                </div>
                <button className="w-full text-center text-[13px] font-bold text-white bg-recur-primary rounded-[10px] py-2.5">
                  Start Free Trial
                </button>
              </div>
            </>
          )}
        </div>

        {/* Comparison table — always static */}
        <div className="text-center mb-6">
          <h3 className="text-[18px] font-bold text-recur-text-heading">How Recur Compares</h3>
        </div>
        <div className="bg-recur-surface border border-recur-border rounded-[14px] overflow-x-auto">
          <table className="w-full pricing-grid">
            <thead>
              <tr className="border-b border-recur-border">
                <th className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider">Feature</th>
                <th className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider">Stripe</th>
                <th className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider">GoCardless</th>
                <th className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider">BoomFi</th>
                <th className="text-[11px] font-semibold text-recur-light uppercase tracking-wider recur-col">Recur</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr key={i} className={i < comparisonRows.length - 1 ? "border-b border-recur-card" : ""}>
                  <td className="font-semibold text-recur-text-heading">{row.feature}</td>
                  <td className="text-recur-text-muted">{row.stripe}</td>
                  <td className="text-recur-text-muted">{row.gocardless}</td>
                  <td className="text-recur-text-muted">{row.boomfi}</td>
                  <td className={`recur-col font-semibold ${row.recurHighlight ? "text-recur-success font-bold" : "text-recur-light"}`}>
                    {row.recur}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
