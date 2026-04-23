"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { RecurLogoIcon } from "../icons/RecurLogoIcon";

export function Hero() {
  const [counts, setCounts] = useState({ fee: 0, finality: 0, countries: 0 });
  const [demoState, setDemoState] = useState<
    "idle" | "connecting" | "approving" | "success"
  >("idle");
  const heroStatsTriggered = useRef(false);

  useEffect(() => {
    const el = document.getElementById("hero-stats");
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !heroStatsTriggered.current) {
          heroStatsTriggered.current = true;
          entry.target.classList.add("visible");
          const duration = 800;
          const start = performance.now();
          const updateCounter = (time: number) => {
            const p = Math.min((time - start) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            setCounts({
              fee: ease * 0.001,
              finality: ease * 400,
              countries: ease * 195,
            });
            if (p < 1) requestAnimationFrame(updateCounter);
          };
          requestAnimationFrame(updateCounter);
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const simulateSubscribe = useCallback(() => {
    if (demoState !== "idle") return;
    setDemoState("connecting");
    setTimeout(() => {
      setDemoState("approving");
      setTimeout(() => {
        setDemoState("success");
        setTimeout(() => setDemoState("idle"), 3000);
      }, 1500);
    }, 1200);
  }, [demoState]);

  return (
    <section className="relative min-h-screen flex items-center pt-14 overflow-hidden">
      <div className="absolute inset-0 dot-grid opacity-30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-recur-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-container mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Messaging */}
          <div>
            <div className="section-animate inline-flex items-center gap-2 text-[12px] text-recur-light bg-recur-purple-tint border border-recur-border-light rounded-full px-4 py-[5px] font-medium mb-6">
              <span className="w-[7px] h-[7px] rounded-full bg-recur-success keeper-dot" />
              Built on Solana &middot; Colosseum Frontier 2026
            </div>

            <h1 className="section-animate text-[clamp(36px,5.5vw,64px)] font-[900] text-recur-text-heading leading-[1.08] tracking-[-0.03em] mb-4">
              Recurring Billing.
              <br />
              <span className="text-gradient-purple">On-Chain. Once.</span>
            </h1>

            <p className="section-animate text-[16px] text-recur-text-body leading-relaxed mb-8 max-w-[460px]">
              Users sign one transaction. Keepers collect every billing cycle
              automatically. Merchants get USDC direct to wallet:{" "}
              <span className="squiggly-highlight">No Bank</span>,{" "}
              <span className="squiggly-highlight">No KYC</span>,{" "}
              <span className="squiggly-highlight">No EVM</span>.
            </p>

            <div className="section-animate flex gap-3 flex-wrap">
              <button className="btn-primary text-[14px]">
                Start Building
              </button>
              <button className="btn-secondary text-[14px]">View Docs</button>
            </div>

            <div
              id="hero-stats"
              className="section-animate flex gap-8 mt-10 pt-8 border-t border-recur-border flex-wrap"
            >
              <div className="stat-block">
                <div className="stat-value">${counts.fee.toFixed(3)}</div>
                <div className="stat-label">Per Execution</div>
              </div>
              <div className="stat-block">
                <div className="stat-value">
                  {Math.round(counts.finality)}ms
                </div>
                <div className="stat-label">Finality</div>
              </div>
              <div className="stat-block">
                <div className="stat-value">3 Lines</div>
                <div className="stat-label">To Integrate</div>
              </div>
              <div className="stat-block">
                <div className="stat-value">
                  {Math.round(counts.countries)}+
                </div>
                <div className="stat-label">Countries</div>
              </div>
            </div>
          </div>

          {/* Right: Interactive RecurButton Demo */}
          <div className="hidden lg:flex justify-center">
            <div className="relative animate-float">
              <div className="bg-recur-surface border border-recur-border rounded-[16px] p-6 w-[380px] animate-glow-pulse">
                <div className="flex items-center justify-between mb-5">
                  <div className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider">
                    Subscription Preview
                  </div>
                  <div className="text-[10px] font-semibold text-recur-success bg-recur-success/10 border border-recur-success/20 px-2 py-0.5 rounded-full">
                    Live Demo
                  </div>
                </div>

                <div className="bg-recur-card border border-recur-border rounded-[12px] p-4 mb-4">
                  <div className="text-[15px] font-bold text-recur-text-heading mb-1">
                    Premium Pass
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[28px] font-[900] text-recur-text-heading font-mono">
                      $5
                    </span>
                    <span className="text-[13px] text-recur-text-muted font-mono">
                      /month
                    </span>
                  </div>
                  <div className="text-[12px] text-recur-text-muted mt-2">
                    USDC on Solana &middot; Cancel Anytime
                  </div>
                </div>

                <div className="bg-recur-purple-tint/50 border border-recur-border-light/30 rounded-[10px] p-3 mb-4">
                  <div className="text-[10px] font-semibold text-recur-light uppercase tracking-wider mb-2">
                    SPL Delegate Approval
                  </div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-recur-text-muted">Max Per Cycle</span>
                    <span className="text-recur-text-heading font-mono font-semibold">
                      5.00 USDC
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-recur-text-muted">
                      Billing Interval
                    </span>
                    <span className="text-recur-text-heading font-mono font-semibold">
                      30 Days
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-recur-text-muted">Network Fee</span>
                    <span className="text-recur-text-heading font-mono font-semibold">
                      ~$0.001
                    </span>
                  </div>
                </div>

                <button
                  onClick={simulateSubscribe}
                  className={`recur-demo-btn w-full text-[14px] font-bold py-3 rounded-[10px] text-white flex items-center justify-center gap-2 transition-all ${
                    demoState === "success"
                      ? "bg-emerald-600"
                      : "bg-recur-primary"
                  } ${demoState !== "idle" && demoState !== "success" ? "opacity-80" : ""}`}
                >
                  {demoState === "idle" && (
                    <>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M8 1v14M1 8h14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      Subscribe with Phantom
                    </>
                  )}
                  {demoState === "connecting" && (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connecting to Phantom...
                    </>
                  )}
                  {demoState === "approving" && (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Approving SPL Delegate...
                    </>
                  )}
                  {demoState === "success" && (
                    <>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 8l4 4 6-8"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Subscribed! PDA Created
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <RecurLogoIcon size={14} />
                  <span className="text-[10px] text-recur-text-dim font-mono">
                    Powered by Recur Protocol
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
