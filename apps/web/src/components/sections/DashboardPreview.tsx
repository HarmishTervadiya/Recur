"use client";

import { useState, useRef, useEffect } from "react";

const PAYMENTS = [
  { addr: "7xKX...4mPQ", amount: "+$5.00 USDC", time: "2s ago", status: "success" as const },
  { addr: "3rLM...8vXZ", amount: "+$5.00 USDC", time: "1m ago", status: "success" as const },
  { addr: "9tNB...2kRW", amount: "+$5.00 USDC", time: "3m ago", status: "success" as const },
  { addr: "5sQE...7hYP", amount: "Failed: Low Balance", time: "5m ago", status: "error" as const },
  { addr: "2pFA...9nJK", amount: "+$5.00 USDC", time: "8m ago", status: "success" as const },
];

export function DashboardPreview() {
  const [dashPayments, setDashPayments] = useState<number[]>([]);
  const triggered = useRef(false);

  useEffect(() => {
    const el = document.getElementById("dashboard-section");
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          entry.target.classList.add("visible");
          [0, 1, 2, 3, 4].forEach((i) => {
            setTimeout(
              () => setDashPayments((prev) => [...prev, i]),
              i * 300,
            );
          });
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="dashboard-section" className="section-animate py-24 px-6">
      <div className="max-w-container mx-auto">
        <div className="text-center mb-12">
          <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-recur-primary mb-2">
            Merchant Dashboard
          </div>
          <h2 className="text-[clamp(24px,3.5vw,32px)] font-[800] tracking-[-0.02em] mb-3">
            See Every Payment. In Real Time.
          </h2>
          <p className="text-[15px] text-recur-text-body max-w-[480px] mx-auto">
            MRR, subscribers, collection rate, live payment feed. The complete
            picture, always on-chain.
          </p>
        </div>

        <div className="bg-recur-base border border-recur-border rounded-[16px] p-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="text-[15px] font-bold text-recur-text-heading">
              ItsU Premium Pass
            </div>
            <div className="text-[10px] font-semibold text-recur-success bg-recur-success/10 border border-recur-success/20 px-3 py-1 rounded-full">
              Live on Devnet
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-recur-surface border border-recur-border rounded-[12px] p-4">
              <div className="text-[24px] font-[900] text-recur-text-heading font-mono">$2,400</div>
              <div className="text-[11px] text-recur-text-muted mt-0.5">Monthly MRR</div>
              <div className="text-[11px] text-recur-success font-medium mt-1">+12.4% This Month</div>
            </div>
            <div className="bg-recur-surface border border-recur-border rounded-[12px] p-4">
              <div className="text-[24px] font-[900] text-recur-text-heading font-mono">480</div>
              <div className="text-[11px] text-recur-text-muted mt-0.5">Active Subscribers</div>
              <div className="text-[11px] text-recur-success font-medium mt-1">+34 This Week</div>
            </div>
            <div className="bg-recur-surface border border-recur-border rounded-[12px] p-4">
              <div className="text-[24px] font-[900] text-recur-text-heading font-mono">98.2%</div>
              <div className="text-[11px] text-recur-text-muted mt-0.5">Collection Rate</div>
              <div className="text-[11px] text-recur-success font-medium mt-1">Last 30 Days</div>
            </div>
          </div>

          <div className="bg-recur-surface border border-recur-border rounded-[12px] p-4">
            <div className="text-[10px] font-semibold text-recur-text-muted uppercase tracking-wider mb-3">
              Recent Payments
            </div>
            <div>
              {PAYMENTS.map((payment, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between text-[12px] py-2 ${i < 4 ? "border-b border-recur-card" : ""} transition-all duration-500 ${
                    dashPayments.includes(i)
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 -translate-y-2"
                  }`}
                >
                  <span className="text-recur-text-body font-mono text-[11px]">
                    {payment.addr}
                  </span>
                  <span
                    className={`font-semibold ${
                      payment.status === "success"
                        ? "text-recur-success"
                        : "text-recur-error"
                    }`}
                  >
                    {payment.amount}
                  </span>
                  <span className="text-recur-text-dim text-[11px]">
                    {payment.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
