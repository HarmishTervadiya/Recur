"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "Do customers have to lock up tokens in a vault?",
    a: "No. Unlike streaming protocols, Recur does not escrow funds. Tokens stay in the user's wallet, earning yield and fully liquid, until the Keeper executes the charge at the exact billing interval.",
  },
  {
    q: "Does Recur have custody over any funds?",
    a: "Never. Payments flow directly from the user's wallet to the merchant's treasury wallet. Keepers are execution triggers, not routing proxies. Fully non-custodial by design.",
  },
  {
    q: "What tokens are supported?",
    a: "Recur is token-agnostic. Merchants can accept USDC, USDT, SOL, or any SPL token. We recommend stablecoins for predictable MRR, but the protocol supports any token with a mint.",
  },
  {
    q: "What happens if the user's wallet runs out of funds?",
    a: "The Keeper transaction fails safely on-chain. Your webhook endpoint captures the failure event, letting you limit access and notify the customer through your UI. No partial charges, no broken state.",
  },
  {
    q: "How is this different from Stripe's crypto billing?",
    a: "Stripe requires a US bank account, supports EVM-only, and doesn't touch Solana. Recur is permissionless, borderless, settles in USDC directly to your wallet, and ships as a single React component. No bank required.",
  },
  {
    q: "Can I use Recur for one-time payments too?",
    a: "The protocol is optimised for recurring billing, but you can set a subscription with a single cycle for one-time charges. We're building a dedicated one-time payment flow for a future release.",
  },
];

export function FAQ() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 px-6">
      <div className="max-w-[760px] mx-auto">
        <div className="section-animate text-center mb-16">
          <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-recur-primary mb-2">
            FAQ
          </div>
          <h2 className="text-[clamp(24px,3.5vw,32px)] font-[800] tracking-[-0.02em]">
            Common Questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className="section-animate bg-recur-surface border border-recur-border rounded-[14px] overflow-hidden transition-colors hover:border-recur-primary/20"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                className="w-full flex items-center justify-between p-5 md:p-6 text-left cursor-pointer"
              >
                <h3 className="text-[15px] font-bold text-recur-light pr-4">
                  {item.q}
                </h3>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6B6B8A"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                  className={`shrink-0 transition-transform duration-300 ${openFaq === i ? "rotate-45" : ""}`}
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openFaq === i ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <p className="px-5 md:px-6 pb-5 md:pb-6 text-[14px] leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
