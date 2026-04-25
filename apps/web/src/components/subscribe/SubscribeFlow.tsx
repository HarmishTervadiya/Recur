"use client";

import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import Link from "next/link";
import { RecurClient } from "@recur/sdk";
import type { PlanInfo } from "@recur/sdk";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

const recurClient = new RecurClient({ rpcUrl: RPC_URL, apiBaseUrl: API_URL });

type Step = "connect" | "signin" | "subscribe" | "success";

interface SubscribeFlowProps {
  plan: PlanInfo;
}

// Format USDC amount: base units → "$X"
function formatUsdc(baseUnits: string): string {
  const n = Number(baseUnits) / 1_000_000;
  return n === 0 ? "Free" : `$${n % 1 === 0 ? n : n.toFixed(2)}`;
}

// Format interval seconds → human-readable
function formatInterval(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr`;
  if (seconds < 2_592_000) return `${Math.round(seconds / 86400)} days`;
  return `${Math.round(seconds / 2_592_000)} mo`;
}

export function SubscribeFlow({ plan }: SubscribeFlowProps) {
  const { publicKey, signMessage, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [step, setStep] = useState<Step>(connected ? "signin" : "connect");
  const [subscriberToken, setSubscriberToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // ── Step 1: Wallet connected → move past connect step ──────────────────────
  // The WalletMultiButton handles the actual connect; we detect it via `connected`
  const walletAddress = publicKey?.toBase58() ?? null;

  // ── Step 2: Sign in as subscriber ──────────────────────────────────────────
  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage || !walletAddress) return;
    setIsLoading(true);
    setError(null);
    try {
      const nonceRes = await fetch(`${API_URL}/auth/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, role: "subscriber" }),
      });
      const nonceJson = await nonceRes.json();
      if (!nonceJson.success) throw new Error(nonceJson.error?.message ?? "Failed to get nonce");

      const { nonce, message } = nonceJson.data as { nonce: string; message: string };
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = await signMessage(msgBytes);
      const signature = bs58.encode(sigBytes);

      const verifyRes = await fetch(`${API_URL}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, role: "subscriber", nonce, signature }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyJson.success) throw new Error(verifyJson.error?.message ?? "Sign-in failed");

      setSubscriberToken(verifyJson.data.accessToken as string);
      setStep("subscribe");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, signMessage, walletAddress]);

  // ── Step 3: Build + send subscribe transaction ──────────────────────────────
  const subscribe = useCallback(async () => {
    if (!publicKey || !subscriberToken || !plan.app?.merchant.walletAddress) return;
    setIsLoading(true);
    setError(null);
    try {
      // Build transaction instructions via SDK
      const { instructions, subscriptionPda } = recurClient.buildSubscribeTransaction(publicKey, {
        planId: plan.id,
        merchantWallet: plan.app.merchant.walletAddress,
        planSeed: plan.planSeed,
        amount: Number(plan.amountBaseUnits),
        intervalSeconds: plan.intervalSeconds,
        delegationCycles: 12,
      });

      // Assemble and send transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight });
      tx.add(...instructions);

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

      // Register with Recur API
      const regRes = await recurClient.registerSubscription(
        { planId: plan.id, subscriptionPda: subscriptionPda.toBase58() },
        subscriberToken,
      );
      if (!regRes.success) throw new Error(regRes.error?.message ?? "Failed to register subscription");

      setTxSignature(sig);
      setStep("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, subscriberToken, plan, connection, sendTransaction]);

  const merchantMissing = !plan.app?.merchant.walletAddress;

  return (
    <div className="min-h-screen bg-recur-base px-6 py-16 flex items-start justify-center">
      <div className="w-full max-w-lg">

        {/* Back link */}
        <Link
          href="/#pricing"
          className="inline-flex items-center gap-1.5 text-[13px] text-recur-text-muted hover:text-recur-text-body transition-colors mb-8"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to pricing
        </Link>

        {/* Plan summary card */}
        <div className="bg-recur-surface border border-recur-border rounded-[14px] p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1">
                Subscribing to
              </div>
              <h1 className="text-[22px] font-bold text-recur-text-heading">{plan.name}</h1>
              {plan.description && (
                <p className="text-[13px] text-recur-text-muted mt-1">{plan.description}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-[26px] font-[900] text-recur-text-heading">
                {formatUsdc(plan.amountBaseUnits)}
              </div>
              <div className="text-[12px] text-recur-text-muted">
                every {formatInterval(plan.intervalSeconds)}
              </div>
            </div>
          </div>
        </div>

        {/* Step flow */}
        <div className="bg-recur-surface border border-recur-border rounded-[14px] p-6 space-y-6">

          {/* Error banner */}
          {error && (
            <div className="bg-recur-error/10 border border-recur-error/30 rounded-[10px] px-4 py-3">
              <p className="text-[13px] text-recur-error">{error}</p>
            </div>
          )}

          {/* STEP: Connect wallet */}
          {(step === "connect" || !connected) && (
            <div>
              <StepHeader n={1} label="Connect your wallet" active />
              <p className="text-[13px] text-recur-text-muted mb-4">
                Connect a Solana wallet to subscribe on-chain. No email required.
              </p>
              <WalletMultiButton
                style={{}}
                className="!bg-recur-primary !text-white !font-semibold !text-[13px] !rounded-[10px] !py-2.5 !px-5 hover:!brightness-110 !transition-all !duration-200 !h-auto"
                onClick={() => connected && setStep("signin")}
              />
              {connected && (
                <button
                  onClick={() => setStep("signin")}
                  className="mt-3 block text-[13px] text-recur-light hover:text-recur-glow transition-colors"
                >
                  Wallet connected — continue →
                </button>
              )}
            </div>
          )}

          {/* STEP: Sign in */}
          {step === "signin" && connected && (
            <div>
              <StepHeader n={2} label="Sign in" active />
              <p className="text-[13px] text-recur-text-muted mb-1">
                Sign a message with your wallet to authenticate.
              </p>
              <p className="text-[11px] text-recur-text-dim mb-4 font-mono break-all">{walletAddress}</p>
              <button
                onClick={signIn}
                disabled={isLoading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Signing…" : "Sign message"}
              </button>
            </div>
          )}

          {/* STEP: Subscribe */}
          {step === "subscribe" && (
            <div>
              <StepHeader n={3} label="Subscribe on-chain" active />
              {merchantMissing ? (
                <div className="bg-recur-warning/10 border border-recur-warning/30 rounded-[10px] px-4 py-3">
                  <p className="text-[13px] text-recur-warning">
                    Merchant wallet address not available. Cannot build transaction.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[13px] text-recur-text-muted mb-4">
                    This will approve a USDC delegation and create your subscription on-chain.
                    Two wallet prompts: one for the token approval, one for the subscription instruction.
                  </p>
                  <button
                    onClick={subscribe}
                    disabled={isLoading}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Confirming on-chain…" : `Subscribe · ${formatUsdc(plan.amountBaseUnits)} / ${formatInterval(plan.intervalSeconds)}`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* STEP: Success */}
          {step === "success" && txSignature && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-recur-success/10 border border-recur-success/30 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                  <path d="M5 11l4.5 4.5L17 7" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-[18px] font-bold text-recur-text-heading mb-2">Subscription active</h2>
              <p className="text-[13px] text-recur-text-muted mb-6">
                Your {plan.name} subscription is live on-chain. The keeper will process your first payment automatically.
              </p>
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-recur-light hover:text-recur-glow transition-colors"
              >
                View on Solana Explorer
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M3 9L9 3M9 3H5M9 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Step progress indicators */}
        <div className="flex items-center justify-center gap-3 mt-6">
          {(["connect", "signin", "subscribe", "success"] as Step[]).map((s, i) => {
            const stepIndex = ["connect", "signin", "subscribe", "success"].indexOf(step);
            const thisIndex = i;
            const done = thisIndex < stepIndex;
            const active = thisIndex === stepIndex;
            return (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  done ? "bg-recur-success w-6" :
                  active ? "bg-recur-primary w-6" :
                  "bg-recur-border w-4"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Small helper — step header with number badge
function StepHeader({ n, label, active }: { n: number; label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
        active ? "bg-recur-primary text-white" : "bg-recur-border text-recur-text-muted"
      }`}>
        {n}
      </div>
      <span className={`text-[15px] font-semibold ${active ? "text-recur-text-heading" : "text-recur-text-muted"}`}>
        {label}
      </span>
    </div>
  );
}
