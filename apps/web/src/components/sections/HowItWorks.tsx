"use client";

import { useEffect, useState } from "react";

export function HowItWorks() {
  const [billingWidth, setBillingWidth] = useState(58);

  useEffect(() => {
    const interval = setInterval(() => {
      setBillingWidth((prev) => {
        const next = prev + 0.01;
        return next > 100 ? 58 : next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="how-it-works" className="section-animate py-24 px-6">
      <div className="max-w-container mx-auto">
        <div className="text-center mb-14">
          <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-recur-primary mb-2">
            How It Works
          </div>
          <h2 className="text-[clamp(24px,3.5vw,32px)] font-[800] tracking-[-0.02em] mb-3">
            Four Steps. One Transaction.
          </h2>
          <p className="text-[15px] text-recur-text-body max-w-[480px] mx-auto">
            From approval to payment in 400ms. No intermediaries. No redirect
            URLs. Pure Solana.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <div className="step-connector bg-recur-surface border border-recur-border rounded-[14px] p-5 relative">
            <div className="text-[11px] font-bold text-recur-primary font-mono mb-3">01</div>
            <div className="w-9 h-9 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1v6l4 2" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="7" stroke="#A78BFA" strokeWidth="1.5" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold mb-1.5">SPL Approve</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              User signs one transaction. SPL delegate approval with capped amount per billing cycle.
            </p>
          </div>

          <div className="step-connector bg-recur-surface border border-recur-border rounded-[14px] p-5 relative">
            <div className="text-[11px] font-bold text-recur-primary font-mono mb-3">02</div>
            <div className="w-9 h-9 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="#A78BFA" strokeWidth="1.5" />
                <path d="M5 8h6M8 5v6" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold mb-1.5">PDA Created</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              Subscription account stored on-chain via Program Derived Address. Immutable and transparent.
            </p>
          </div>

          <div className="step-connector bg-recur-surface border border-recur-border rounded-[14px] p-5 relative">
            <div className="text-[11px] font-bold text-recur-primary font-mono mb-3">03</div>
            <div className="w-9 h-9 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 8h12" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M9 4l5 4-5 4" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold mb-1.5">Keeper Fires</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              Automated Keeper triggers payment every billing cycle. No user action needed. Ever.
            </p>
          </div>

          <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 relative">
            <div className="text-[11px] font-bold text-recur-primary font-mono mb-3">04</div>
            <div className="w-9 h-9 rounded-[10px] bg-recur-success/10 border border-recur-success/20 flex items-center justify-center mb-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8l4 4 6-8" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold mb-1.5">Merchant Receives USDC</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              USDC lands in merchant wallet + webhook fires. No bank. No intermediary. 400ms.
            </p>
          </div>
        </div>

        <div className="mt-10 bg-recur-surface border border-recur-border rounded-[14px] p-5 max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold text-recur-text-heading">
              Next Billing Cycle
            </div>
            <div className="text-[12px] font-mono text-recur-light">
              12d 04h 32m
            </div>
          </div>
          <div className="w-full h-2 bg-recur-card rounded-full overflow-hidden">
            <div
              className="h-full bg-recur-primary rounded-full transition-all duration-1000"
              style={{ width: `${billingWidth}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-recur-text-dim font-mono">
            <span>Apr 1, 2026</span>
            <span>May 1, 2026</span>
          </div>
        </div>
      </div>
    </section>
  );
}
