"use client";

import { useEffect, useState, useRef, useCallback } from "react";

/* ── Logo SVG Components ── */

function RecurLogoIcon({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>
        <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <path
        d="M 30 102 L 30 26 C 30 20.477 34.477 16 40 16 L 60 16 C 76.569 16 90 29.431 90 46 C 90 62.569 76.569 76 60 76 L 30 76"
        fill="none"
        stroke="url(#purpleGrad)"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 50 76 L 72 98"
        fill="none"
        stroke="url(#purpleGrad)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <circle
        cx="76"
        cy="102"
        r="10"
        fill="url(#greenGrad)"
        filter="url(#glow)"
      />
    </svg>
  );
}

function RecurLogoWordmark({
  height = 32,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  const width = Math.round((400 / 120) * height);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 120"
      width={width}
      height={height}
      className={className}
    >
      <defs>
        <linearGradient id="purpleGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>
        <linearGradient id="greenGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
        <filter id="glow2" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <g transform="translate(10, 0)">
        <path
          d="M 30 102 L 30 26 C 30 20.477 34.477 16 40 16 L 60 16 C 76.569 16 90 29.431 90 46 C 90 62.569 76.569 76 60 76 L 30 76"
          fill="none"
          stroke="url(#purpleGrad2)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 50 76 L 72 98"
          fill="none"
          stroke="url(#purpleGrad2)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <circle
          cx="76"
          cy="102"
          r="10"
          fill="url(#greenGrad2)"
          filter="url(#glow2)"
        />
      </g>
      <text
        x="130"
        y="86"
        fontFamily="'Inter', -apple-system, sans-serif"
        fontWeight="800"
        fontSize="76"
        fill="#F8F8FF"
        letterSpacing="-0.04em"
      >
        Recur
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Section order (matches index.html reference):
   01  Nav           – pill capsule, sticky (UNCHANGED)
   02  Hero          – split: left messaging, right RecurButton demo card
   03  Trust strip   – inline items with dot separators
   04  Problem       – 3 red-icon pain cards with "Recur fix:" footers
   05  How it works  – 4 steps with dashed connectors + billing countdown bar
   06  SDK code      – side-by-side, tab switcher, typewriter code
   07  Dashboard     – card-style stats, 5 payment rows
   08  Pricing       – two pricing cards + expanded comparison table
   09  Vs Stripe     – 4 advantage cards + social proof quote
   10  Use cases     – 4 cards (SaaS, Gaming, Creators, DeFi)
   11  FAQ           – accordion (kept from previous)
   12  CTA footer    – Powered by Solana badge
   13  Footer        – gradient logo, tagline, Discord
   ───────────────────────────────────────────── */

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [counts, setCounts] = useState({ fee: 0, finality: 0, countries: 0 });
  const [dashPayments, setDashPayments] = useState<number[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [codeTyped, setCodeTyped] = useState<number[]>([]);
  const [demoState, setDemoState] = useState<
    "idle" | "connecting" | "approving" | "success"
  >("idle");
  const [billingWidth, setBillingWidth] = useState(58);
  const [activeTab, setActiveTab] = useState<"npm" | "yarn" | "pnpm">("npm");
  const [copied, setCopied] = useState(false);
  const heroStatsTriggered = useRef(false);
  const dashboardTriggered = useRef(false);
  const codeTriggered = useRef(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");

            // Hero stat counter animation
            if (
              entry.target.id === "hero-stats" &&
              !heroStatsTriggered.current
            ) {
              heroStatsTriggered.current = true;
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

            // Dashboard payment stream animation
            if (
              entry.target.id === "dashboard-section" &&
              !dashboardTriggered.current
            ) {
              dashboardTriggered.current = true;
              [0, 1, 2, 3, 4].forEach((i) => {
                setTimeout(
                  () => setDashPayments((prev) => [...prev, i]),
                  i * 300,
                );
              });
            }

            // Code typewriter animation
            if (entry.target.id === "code-block" && !codeTriggered.current) {
              codeTriggered.current = true;
              const totalLines = 14;
              for (let i = 0; i < totalLines; i++) {
                setTimeout(() => setCodeTyped((prev) => [...prev, i]), i * 60);
              }
            }
          }
        });
      },
      { threshold: 0.15 },
    );

    document
      .querySelectorAll(".section-animate")
      .forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  // Billing bar slow animation
  useEffect(() => {
    const interval = setInterval(() => {
      setBillingWidth((prev) => {
        const next = prev + 0.01;
        return next > 100 ? 58 : next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Demo subscribe simulation
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

  // Copy code
  const handleCopy = useCallback(() => {
    const installCmd =
      activeTab === "npm"
        ? "npm install"
        : activeTab === "yarn"
          ? "yarn add"
          : "pnpm add";
    const code = `${installCmd} @recur/react

import { RecurButton } from '@recur/react'

export default function PricingPage() {
  return (
    <RecurButton
      planId="premium_pass"
      amount={5}
      interval="monthly"
      token="USDC"
    />
  )
}`;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [activeTab]);

  const installCmd =
    activeTab === "npm"
      ? "npm install"
      : activeTab === "yarn"
        ? "yarn add"
        : "pnpm add";

  return (
    <>
      {/* ═══════════════════════ 01. NAV (UNCHANGED) ═══════════════════════ */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-recur-base/95 backdrop-blur-md border-b border-recur-border py-3"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-container mx-auto px-6 flex justify-between items-center">
          <RecurLogoIcon size={28} />
          <div className="hidden md:flex items-center bg-recur-surface/80 border border-recur-border rounded-full px-1.5 py-1.5 gap-1 backdrop-blur-sm">
            <a
              href="#how-it-works"
              className="text-[13px] text-recur-text-subheading font-medium hover:text-recur-text-heading hover:bg-recur-card px-4 py-1.5 rounded-full transition-all"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              className="text-[13px] text-recur-text-subheading font-medium hover:text-recur-text-heading hover:bg-recur-card px-4 py-1.5 rounded-full transition-all"
            >
              Pricing
            </a>
            <a
              href="#developers"
              className="text-[13px] text-recur-text-subheading font-medium hover:text-recur-text-heading hover:bg-recur-card px-4 py-1.5 rounded-full transition-all"
            >
              Developers
            </a>
            <a
              href="#faq"
              className="text-[13px] text-recur-text-subheading font-medium hover:text-recur-text-heading hover:bg-recur-card px-4 py-1.5 rounded-full transition-all"
            >
              FAQ
            </a>
          </div>
          <button className="btn-primary text-[12px] px-4 py-2">
            Launch App
          </button>
        </div>
      </nav>

      {/* ═══════════════════════ 02. HERO (SPLIT LAYOUT) ═══════════════════════ */}
      <section className="relative min-h-screen flex items-center pt-14 overflow-hidden">
        {/* Background dot grid */}
        <div className="absolute inset-0 dot-grid opacity-30" />
        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-recur-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-container mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Messaging */}
            <div>
              {/* Badge */}
              <div className="section-animate inline-flex items-center gap-2 text-[12px] text-recur-light bg-recur-purple-tint border border-recur-border-light rounded-full px-4 py-[5px] font-medium mb-6">
                <span className="w-[7px] h-[7px] rounded-full bg-recur-success keeper-dot" />
                Built on Solana &middot; Colosseum Frontier 2026
              </div>

              {/* H1 */}
              <h1 className="section-animate text-[clamp(36px,5.5vw,64px)] font-[900] text-recur-text-heading leading-[1.08] tracking-[-0.03em] mb-4">
                Recurring Billing.
                <br />
                <span className="text-gradient-purple">On-Chain. Once.</span>
              </h1>

              {/* Subhead */}
              <p className="section-animate text-[16px] text-recur-text-body leading-relaxed mb-8 max-w-[460px]">
                Users sign one transaction. Keepers collect every billing cycle
                automatically. Merchants get USDC direct to wallet:{" "}
                <span className="squiggly-highlight">No Bank</span>,{" "}
                <span className="squiggly-highlight">No KYC</span>,{" "}
                <span className="squiggly-highlight">No EVM</span>.
              </p>

              {/* CTAs */}
              <div className="section-animate flex gap-3 flex-wrap">
                <button className="btn-primary text-[14px]">
                  Start Building
                </button>
                <button className="btn-secondary text-[14px]">View Docs</button>
              </div>

              {/* Stats */}
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
                  {/* Demo card header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider">
                      Subscription Preview
                    </div>
                    <div className="text-[10px] font-semibold text-recur-success bg-recur-success/10 border border-recur-success/20 px-2 py-0.5 rounded-full">
                      Live Demo
                    </div>
                  </div>

                  {/* Plan info */}
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

                  {/* Approval details */}
                  <div className="bg-recur-purple-tint/50 border border-recur-border-light/30 rounded-[10px] p-3 mb-4">
                    <div className="text-[10px] font-semibold text-recur-light uppercase tracking-wider mb-2">
                      SPL Delegate Approval
                    </div>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="text-recur-text-muted">
                        Max Per Cycle
                      </span>
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

                  {/* Subscribe button */}
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

                  {/* Powered by */}
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

      {/* ═══════════════════════ 03. TRUST STRIP ═══════════════════════ */}
      <section className="section-animate border-y border-recur-border py-4">
        <div className="max-w-container mx-auto px-6">
          <div className="flex items-center justify-center gap-6 flex-wrap text-[12px] text-recur-text-muted">
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle
                  cx="7"
                  cy="7"
                  r="6"
                  stroke="#7C3AED"
                  strokeWidth="1.5"
                />
                <path
                  d="M4.5 7L6.5 9L9.5 5"
                  stroke="#7C3AED"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Built at Frontier Hackathon 2026
            </span>
            <span className="text-recur-text-dim">&middot;</span>
            <span>Backed by Superteam</span>
            <span className="text-recur-text-dim">&middot;</span>
            <span className="flex items-center gap-1.5">
              <span className="w-[6px] h-[6px] rounded-full bg-recur-success keeper-dot" />
              Live on Devnet
            </span>
            <span className="text-recur-text-dim">&middot;</span>
            <span>Solana Native</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ 04. PROBLEM ═══════════════════════ */}
      <section className="section-animate py-24 px-6" id="problem">
        <div className="max-w-container mx-auto">
          <div className="text-center mb-12">
            <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-recur-primary mb-2">
              The Problem
            </div>
            <h2 className="text-[clamp(24px,3.5vw,32px)] font-[800] tracking-[-0.02em] mb-3">
              Crypto Recurring Payments Are Broken
            </h2>
            <p className="text-[15px] text-recur-text-body max-w-[520px] mx-auto">
              GoCardless literally says &ldquo;Cryptocurrency systems don&apos;t
              inherently lend themselves to recurring billing.&rdquo; We fixed
              that.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {/* Pain 1 */}
            <div className="dark-card hover:border-recur-border-light transition-colors">
              <div className="w-10 h-10 rounded-[10px] bg-recur-error/10 border border-recur-error/20 flex items-center justify-center mb-4">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M4 14L14 4M14 4H6M14 4v8"
                    stroke="#F87171"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-[15px] font-bold mb-2">
                Manual Signing Every Cycle
              </h3>
              <p className="text-[13px] text-recur-text-body leading-relaxed">
                Users must approve every single payment. Miss one? Subscription
                cancelled. Churn rate: catastrophic.
              </p>
              <div className="mt-4 pt-3 border-t border-recur-border">
                <div className="text-[11px] font-semibold text-recur-light">
                  Recur fix: Sign once, Keepers auto-collect
                </div>
              </div>
            </div>

            {/* Pain 2 */}
            <div className="dark-card hover:border-recur-border-light transition-colors">
              <div className="w-10 h-10 rounded-[10px] bg-recur-error/10 border border-recur-error/20 flex items-center justify-center mb-4">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect
                    x="3"
                    y="3"
                    width="12"
                    height="12"
                    rx="2"
                    stroke="#F87171"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M7 7l4 4M11 7l-4 4"
                    stroke="#F87171"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="text-[15px] font-bold mb-2">
                Uncapped Token Approvals
              </h3>
              <p className="text-[13px] text-recur-text-body leading-relaxed">
                Smart contracts with uncapped withdrawal rights. Users give
                infinite access. One exploit = total loss.
              </p>
              <div className="mt-4 pt-3 border-t border-recur-border">
                <div className="text-[11px] font-semibold text-recur-light">
                  Recur fix: Capped SPL delegate per cycle
                </div>
              </div>
            </div>

            {/* Pain 3 */}
            <div className="dark-card hover:border-recur-border-light transition-colors">
              <div className="w-10 h-10 rounded-[10px] bg-recur-error/10 border border-recur-error/20 flex items-center justify-center mb-4">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M9 2v14M2 9h14"
                    stroke="#F87171"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M5 5l8 8"
                    stroke="#F87171"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="text-[15px] font-bold mb-2">
                No Solana SDK Exists
              </h3>
              <p className="text-[13px] text-recur-text-body leading-relaxed">
                Stripe is EVM-only. BoomFi is multi-chain generic. Nobody built
                native recurring billing for Solana. Until now.
              </p>
              <div className="mt-4 pt-3 border-t border-recur-border">
                <div className="text-[11px] font-semibold text-recur-light">
                  Recur fix: 3-line React SDK, Solana native
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ 05. HOW IT WORKS ═══════════════════════ */}
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
            {/* Step 1 */}
            <div className="step-connector bg-recur-surface border border-recur-border rounded-[14px] p-5 relative">
              <div className="text-[11px] font-bold text-recur-primary font-mono mb-3">
                01
              </div>
              <div className="w-9 h-9 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 1v6l4 2"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="8"
                    cy="8"
                    r="7"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold mb-1.5">SPL Approve</h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                User signs one transaction. SPL delegate approval with capped
                amount per billing cycle.
              </p>
            </div>

            {/* Step 2 */}
            <div className="step-connector bg-recur-surface border border-recur-border rounded-[14px] p-5 relative">
              <div className="text-[11px] font-bold text-recur-primary font-mono mb-3">
                02
              </div>
              <div className="w-9 h-9 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect
                    x="2"
                    y="2"
                    width="12"
                    height="12"
                    rx="2"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M5 8h6M8 5v6"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold mb-1.5">PDA Created</h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                Subscription account stored on-chain via Program Derived
                Address. Immutable and transparent.
              </p>
            </div>

            {/* Step 3 */}
            <div className="step-connector bg-recur-surface border border-recur-border rounded-[14px] p-5 relative">
              <div className="text-[11px] font-bold text-recur-primary font-mono mb-3">
                03
              </div>
              <div className="w-9 h-9 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 8h12"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9 4l5 4-5 4"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold mb-1.5">Keeper Fires</h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                Automated Keeper triggers payment every billing cycle. No user
                action needed. Ever.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 relative">
              <div className="text-[11px] font-bold text-recur-primary font-mono mb-3">
                04
              </div>
              <div className="w-9 h-9 rounded-[10px] bg-recur-success/10 border border-recur-success/20 flex items-center justify-center mb-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8l4 4 6-8"
                    stroke="#34D399"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold mb-1.5">
                Merchant Receives USDC
              </h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                USDC lands in merchant wallet + webhook fires. No bank. No
                intermediary. 400ms.
              </p>
            </div>
          </div>

          {/* Sablier-inspired billing countdown bar */}
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

      {/* ═══════════════════════ 06. SDK CODE BLOCK ═══════════════════════ */}
      <section id="developers" className="section-animate py-24 px-6">
        <div className="max-w-container mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Left: explanation */}
            <div>
              <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-recur-primary mb-2">
                Developer SDK
              </div>
              <h2 className="text-[clamp(24px,3.5vw,32px)] font-[800] tracking-[-0.02em] mb-3">
                Three Lines. That&apos;s It.
              </h2>
              <p className="text-[15px] text-recur-text-body leading-relaxed mb-8 max-w-[440px]">
                Install the SDK, import the component, drop it into any Solana
                dApp. No checkout sessions, no redirect URLs, no 30-minute
                setup.
              </p>

              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <div className="step-badge mt-0.5">1</div>
                  <div>
                    <div className="text-[13px] font-bold text-recur-text-heading">
                      Install
                    </div>
                    <div className="text-[12px] text-recur-text-muted font-mono mt-0.5">
                      npm install @recur/react
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="step-badge mt-0.5">2</div>
                  <div>
                    <div className="text-[13px] font-bold text-recur-text-heading">
                      Import
                    </div>
                    <div className="text-[12px] text-recur-text-muted font-mono mt-0.5">
                      {"import { RecurButton } from '@recur/react'"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="step-badge mt-0.5">3</div>
                  <div>
                    <div className="text-[13px] font-bold text-recur-text-heading">
                      Render
                    </div>
                    <div className="text-[12px] text-recur-text-muted font-mono mt-0.5">
                      {'<RecurButton planId="..." amount={5} />'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: code block with tabs */}
            <div>
              {/* Tab switcher */}
              <div className="flex gap-1 mb-2">
                {(["npm", "yarn", "pnpm"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-t-[8px] border transition-colors ${
                      activeTab === tab
                        ? "text-recur-light bg-recur-purple-tint border-recur-border-light border-b-0"
                        : "text-recur-text-dim border-transparent hover:text-recur-text-muted"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  className="ml-auto text-[11px] font-medium text-recur-text-dim hover:text-recur-light px-3 py-1.5 transition-colors flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2 6l3 3 5-6"
                          stroke="#34D399"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-recur-success">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <rect
                          x="4"
                          y="4"
                          width="7"
                          height="7"
                          rx="1.5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <path
                          d="M8 4V2.5A1.5 1.5 0 006.5 1h-4A1.5 1.5 0 001 2.5v4A1.5 1.5 0 002.5 8H4"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>

              <div
                id="code-block"
                className="section-animate bg-recur-surface border border-recur-border rounded-[14px] rounded-tl-none p-6 font-mono text-[13px] leading-[1.9] overflow-x-auto"
              >
                {[
                  {
                    content: (
                      <span className="text-recur-text-dim">
                        {"// install"}
                      </span>
                    ),
                  },
                  {
                    content: (
                      <>
                        <span className="text-recur-text-heading">
                          {installCmd}
                        </span>{" "}
                        <span className="text-recur-success">@recur/react</span>
                      </>
                    ),
                  },
                  { content: <br /> },
                  {
                    content: (
                      <span className="text-recur-text-dim">
                        {"// drop into any Solana dApp"}
                      </span>
                    ),
                  },
                  {
                    content: (
                      <>
                        <span className="text-recur-glow">import</span>{" "}
                        <span className="text-recur-text-heading">
                          {"{ RecurButton }"}
                        </span>{" "}
                        <span className="text-recur-glow">from</span>{" "}
                        <span className="text-recur-success">
                          &apos;@recur/react&apos;
                        </span>
                      </>
                    ),
                  },
                  { content: <br /> },
                  {
                    content: (
                      <>
                        <span className="text-recur-glow">
                          export default function
                        </span>{" "}
                        <span className="text-recur-warning">PricingPage</span>
                        <span className="text-recur-text-heading">
                          {"() {"}
                        </span>
                      </>
                    ),
                  },
                  {
                    content: (
                      <span className="pl-6">
                        <span className="text-recur-glow">return</span>{" "}
                        <span className="text-recur-text-heading">(</span>
                      </span>
                    ),
                  },
                  {
                    content: (
                      <span className="pl-12">
                        <span className="text-recur-text-heading">&lt;</span>
                        <span className="text-recur-warning">RecurButton</span>
                      </span>
                    ),
                  },
                  {
                    content: (
                      <span className="pl-16">
                        <span className="text-recur-success">planId</span>
                        <span className="text-recur-text-heading">
                          =&quot;premium_pass&quot;
                        </span>
                      </span>
                    ),
                  },
                  {
                    content: (
                      <span className="pl-16">
                        <span className="text-recur-success">amount</span>
                        <span className="text-recur-text-heading">{`={5}`}</span>
                      </span>
                    ),
                  },
                  {
                    content: (
                      <span className="pl-16">
                        <span className="text-recur-success">interval</span>
                        <span className="text-recur-text-heading">
                          =&quot;monthly&quot;
                        </span>
                      </span>
                    ),
                  },
                  {
                    content: (
                      <span className="pl-16">
                        <span className="text-recur-success">token</span>
                        <span className="text-recur-text-heading">
                          =&quot;USDC&quot;
                        </span>
                      </span>
                    ),
                  },
                  {
                    content: (
                      <span className="pl-12">
                        <span className="text-recur-text-heading">/&gt;</span>
                      </span>
                    ),
                  },
                  {
                    content: (
                      <span className="pl-6">
                        <span className="text-recur-text-heading">)</span>
                      </span>
                    ),
                  },
                  {
                    content: (
                      <span className="text-recur-text-heading">{"}"}</span>
                    ),
                  },
                ].map((line, i) => (
                  <div
                    key={i}
                    className={`code-line ${codeTyped.includes(i) ? "typed" : ""}`}
                  >
                    {line.content}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ 07. DASHBOARD PREVIEW ═══════════════════════ */}
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
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="text-[15px] font-bold text-recur-text-heading">
                ItsU Premium Pass
              </div>
              <div className="text-[10px] font-semibold text-recur-success bg-recur-success/10 border border-recur-success/20 px-3 py-1 rounded-full">
                Live on Devnet
              </div>
            </div>

            {/* Stats as cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-recur-surface border border-recur-border rounded-[12px] p-4">
                <div className="text-[24px] font-[900] text-recur-text-heading font-mono">
                  $2,400
                </div>
                <div className="text-[11px] text-recur-text-muted mt-0.5">
                  Monthly MRR
                </div>
                <div className="text-[11px] text-recur-success font-medium mt-1">
                  +12.4% This Month
                </div>
              </div>
              <div className="bg-recur-surface border border-recur-border rounded-[12px] p-4">
                <div className="text-[24px] font-[900] text-recur-text-heading font-mono">
                  480
                </div>
                <div className="text-[11px] text-recur-text-muted mt-0.5">
                  Active Subscribers
                </div>
                <div className="text-[11px] text-recur-success font-medium mt-1">
                  +34 This Week
                </div>
              </div>
              <div className="bg-recur-surface border border-recur-border rounded-[12px] p-4">
                <div className="text-[24px] font-[900] text-recur-text-heading font-mono">
                  98.2%
                </div>
                <div className="text-[11px] text-recur-text-muted mt-0.5">
                  Collection Rate
                </div>
                <div className="text-[11px] text-recur-success font-medium mt-1">
                  Last 30 Days
                </div>
              </div>
            </div>

            {/* Recent payments */}
            <div className="bg-recur-surface border border-recur-border rounded-[12px] p-4">
              <div className="text-[10px] font-semibold text-recur-text-muted uppercase tracking-wider mb-3">
                Recent Payments
              </div>
              <div>
                {[
                  {
                    addr: "7xKX...4mPQ",
                    amount: "+$5.00 USDC",
                    time: "2s ago",
                    status: "success" as const,
                  },
                  {
                    addr: "3rLM...8vXZ",
                    amount: "+$5.00 USDC",
                    time: "1m ago",
                    status: "success" as const,
                  },
                  {
                    addr: "9tNB...2kRW",
                    amount: "+$5.00 USDC",
                    time: "3m ago",
                    status: "success" as const,
                  },
                  {
                    addr: "5sQE...7hYP",
                    amount: "Failed: Low Balance",
                    time: "5m ago",
                    status: "error" as const,
                  },
                  {
                    addr: "2pFA...9nJK",
                    amount: "+$5.00 USDC",
                    time: "8m ago",
                    status: "success" as const,
                  },
                ].map((payment, i) => (
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

      {/* ═══════════════════════ 08. PRICING ═══════════════════════ */}
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
              Transparent pricing. No hidden fees. No asterisks. Compare us to
              anyone.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-14">
            {/* Starter */}
            <div className="bg-recur-surface border border-recur-border rounded-[14px] p-6">
              <div className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-3">
                Starter
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[32px] font-[900] text-recur-text-heading">
                  Free
                </span>
              </div>
              <p className="text-[13px] text-recur-text-muted mb-5">
                For developers testing on Devnet
              </p>
              <div className="space-y-2 mb-6">
                {[
                  "$0.05 flat + 0.25% per tx",
                  "Unlimited Subscriptions",
                  "SDK + React Component",
                  "Webhook Notifications",
                ].map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 text-[13px] text-recur-text-body"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 7l3 3 5-6"
                        stroke="#34D399"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {feature}
                  </div>
                ))}
              </div>
              <button className="w-full text-center text-[13px] font-semibold text-recur-light border border-recur-border-light rounded-[10px] py-2.5 hover:border-recur-primary transition-colors cursor-pointer">
                Get Started
              </button>
            </div>

            {/* Pro */}
            <div className="bg-recur-surface border-2 border-recur-primary rounded-[14px] p-6 relative animate-glow-pulse">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-recur-primary px-3 py-1 rounded-full">
                RECOMMENDED
              </div>
              <div className="text-[11px] font-semibold text-recur-light uppercase tracking-wider mb-3">
                Pro
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[32px] font-[900] text-recur-text-heading">
                  $49
                </span>
                <span className="text-[14px] text-recur-text-muted">
                  /month
                </span>
              </div>
              <p className="text-[13px] text-recur-text-muted mb-5">
                For production merchants
              </p>
              <div className="space-y-2 mb-6">
                {[
                  "Everything in Starter",
                  "Merchant Dashboard",
                  "Priority Keeper Execution",
                  "Custom Branding + White-Label",
                  "Dedicated Support",
                ].map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 text-[13px] text-recur-text-body"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 7l3 3 5-6"
                        stroke="#34D399"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {feature}
                  </div>
                ))}
              </div>
              <button className="recur-demo-btn w-full text-center text-[13px] font-bold text-white bg-recur-primary rounded-[10px] py-2.5 cursor-pointer">
                Start Free Trial
              </button>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="text-center mb-6">
            <h3 className="text-[18px] font-bold text-recur-text-heading">
              How Recur Compares
            </h3>
          </div>
          <div className="bg-recur-surface border border-recur-border rounded-[14px] overflow-x-auto">
            <table className="w-full pricing-grid">
              <thead>
                <tr className="border-b border-recur-border">
                  <th className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider">
                    Feature
                  </th>
                  <th className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider">
                    Stripe
                  </th>
                  <th className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider">
                    GoCardless
                  </th>
                  <th className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider">
                    BoomFi
                  </th>
                  <th className="text-[11px] font-semibold text-recur-light uppercase tracking-wider recur-col">
                    Recur
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    feature: "Per-Tx Fee",
                    stripe: "1.5%",
                    gocardless: "$0.20 + 2%",
                    boomfi: "1% - 2%",
                    recur: "$0.05 + 0.25%",
                    recurHighlight: true,
                  },
                  {
                    feature: "$5/Mo Sub Cost",
                    stripe: "~$0.08",
                    gocardless: "~$0.30",
                    boomfi: "~$0.10",
                    recur: "~$0.06",
                    recurHighlight: true,
                  },
                  {
                    feature: "$100/Mo Cost",
                    stripe: "$1.50",
                    gocardless: "$2.20",
                    boomfi: "$1.00+",
                    recur: "$0.30",
                    recurHighlight: true,
                  },
                  {
                    feature: "Settlement",
                    stripe: "Fiat (USD)",
                    gocardless: "Fiat",
                    boomfi: "Crypto/Fiat",
                    recur: "USDC Direct",
                    recurHighlight: false,
                  },
                  {
                    feature: "Chain",
                    stripe: "EVM Only",
                    gocardless: "N/A",
                    boomfi: "Multi EVM",
                    recur: "Solana Native",
                    recurHighlight: false,
                  },
                  {
                    feature: "Finality",
                    stripe: "~2s",
                    gocardless: "2-5 Days",
                    boomfi: "2-15s",
                    recur: "400ms",
                    recurHighlight: true,
                  },
                  {
                    feature: "KYC Required",
                    stripe: "Yes",
                    gocardless: "Yes",
                    boomfi: "KYB",
                    recur: "No",
                    recurHighlight: true,
                  },
                  {
                    feature: "Integration",
                    stripe: "Sessions + Webhooks",
                    gocardless: "API + Redirect",
                    boomfi: "Paylink/API",
                    recur: "3 Lines of React",
                    recurHighlight: false,
                  },
                  {
                    feature: "Approvals",
                    stripe: "Uncapped",
                    gocardless: "Bank Mandate",
                    boomfi: "SC Permit",
                    recur: "Capped SPL Delegate",
                    recurHighlight: true,
                  },
                ].map((row, i) => (
                  <tr
                    key={i}
                    className={i < 8 ? "border-b border-recur-card" : ""}
                  >
                    <td className="font-semibold text-recur-text-heading">
                      {row.feature}
                    </td>
                    <td className="text-recur-text-muted">{row.stripe}</td>
                    <td className="text-recur-text-muted">{row.gocardless}</td>
                    <td className="text-recur-text-muted">{row.boomfi}</td>
                    <td
                      className={`recur-col font-semibold ${
                        row.recurHighlight
                          ? "text-recur-success font-bold"
                          : "text-recur-light"
                      }`}
                    >
                      {row.recur}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ 09. VS STRIPE ═══════════════════════ */}
      <section id="vs-stripe" className="section-animate py-24 px-6">
        <div className="max-w-container mx-auto">
          <div className="text-center mb-12">
            <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-recur-primary mb-2">
              Why Not Stripe?
            </div>
            <h2 className="text-[clamp(24px,3.5vw,32px)] font-[800] tracking-[-0.02em] mb-3">
              Stripe Validated the Market.
              <br />
              We Built It Better.
            </h2>
            <p className="text-[15px] text-recur-text-body max-w-[520px] mx-auto">
              Stripe entering stablecoin subscriptions proves this is real.
              Here&apos;s what they can&apos;t do.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors">
              <div className="mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M12 6v12M6 12h12"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold text-recur-light mb-2">
                Solana Native
              </h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                Stripe is EVM-only (Polygon, Base). No Solana. Recur: 400ms
                finality, $0.001 gas, no bridge complexity.
              </p>
            </div>

            <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors">
              <div className="mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="4"
                    y="4"
                    width="16"
                    height="16"
                    rx="3"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M8 12l3 3 5-6"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold text-recur-light mb-2">
                Capped Approvals
              </h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                Stripe&apos;s Bridge contracts allow uncapped withdrawals. Recur
                uses SPL delegate with per-cycle caps. Users see exactly what
                they approve.
              </p>
            </div>

            <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors">
              <div className="mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M8 14c0-2.2 1.8-4 4-4s4 1.8 4 4"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="9" cy="10" r="1" fill="#A78BFA" />
                  <circle cx="15" cy="10" r="1" fill="#A78BFA" />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold text-recur-light mb-2">
                Any Country, No KYC
              </h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                Stripe requires US-registered merchants. Recur: 195+ countries,
                wallet-to-wallet, no bank account needed.
              </p>
            </div>

            <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors">
              <div className="mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 17l6-6 4 4 6-8"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold text-recur-light mb-2">
                Developer-First SDK
              </h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                Stripe: checkout sessions, redirect URLs, webhook endpoints.
                Recur:{" "}
                <span className="font-mono text-recur-glow text-[11px]">
                  npm install @recur/react
                </span>
                , done.
              </p>
            </div>
          </div>

          {/* Social proof quote */}
          <div className="mt-8 bg-recur-purple-tint/30 border border-recur-border-light/40 rounded-[14px] p-6 max-w-2xl mx-auto text-center">
            <p className="text-[14px] text-recur-text-body italic leading-relaxed mb-3">
              &ldquo;This looks like uncapped ability to withdraw tokens.&rdquo;
            </p>
            <p className="text-[12px] text-recur-text-muted">
              Jess Houlgrave, WalletConnect, on Stripe&apos;s stablecoin
              approach
            </p>
            <p className="text-[12px] text-recur-light font-semibold mt-2">
              Recur&apos;s SPL delegate with explicit amount caps per cycle is
              the answer.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ 10. USE CASES ═══════════════════════ */}
      <section className="section-animate py-24 px-6" id="use-cases">
        <div className="max-w-container mx-auto">
          <div className="text-center mb-12">
            <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-recur-primary mb-2">
              Use Cases
            </div>
            <h2 className="text-[clamp(24px,3.5vw,32px)] font-[800] tracking-[-0.02em] mb-3">
              Built for Builders
            </h2>
            <p className="text-[15px] text-recur-text-body max-w-[480px] mx-auto">
              From SaaS to gaming to DeFi. Anywhere users pay recurring, Recur
              powers it.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* SaaS */}
            <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors group">
              <div className="w-10 h-10 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-4 group-hover:bg-recur-primary/20 transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect
                    x="2"
                    y="3"
                    width="14"
                    height="12"
                    rx="2"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                  />
                  <path d="M2 7h14" stroke="#A78BFA" strokeWidth="1.5" />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold mb-1.5">SaaS</h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                Monthly tooling subscriptions. Dev tools, analytics, APIs.
                Accept USDC, skip Stripe&apos;s 2.9%.
              </p>
            </div>

            {/* Gaming */}
            <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors group">
              <div className="w-10 h-10 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-4 group-hover:bg-recur-primary/20 transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M9 2l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4l2-4z"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold mb-1.5">Gaming</h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                Battle passes, season passes, premium memberships. Auto-renew in
                USDC, keep players engaged.
              </p>
            </div>

            {/* Creators */}
            <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors group">
              <div className="w-10 h-10 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-4 group-hover:bg-recur-primary/20 transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle
                    cx="9"
                    cy="6"
                    r="3"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold mb-1.5">Creators</h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                Content subscriptions, Patreon-style memberships, NFT access
                passes. Direct to creator wallet.
              </p>
            </div>

            {/* DeFi */}
            <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors group">
              <div className="w-10 h-10 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-4 group-hover:bg-recur-primary/20 transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M9 2v14M2 9h14"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="9"
                    cy="9"
                    r="7"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold mb-1.5">DeFi</h3>
              <p className="text-[12px] text-recur-text-body leading-relaxed">
                Auto-DCA, recurring deposits, protocol fees. Programmable money
                flows on Solana rails.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ 11. FAQ ═══════════════════════ */}
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
            {[
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
            ].map((item, i) => (
              <div
                key={i}
                className="section-animate bg-recur-surface border border-recur-border rounded-[14px] overflow-hidden transition-colors hover:border-recur-primary/20"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
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

      {/* ═══════════════════════ 12. CTA FOOTER ═══════════════════════ */}
      <section className="section-animate py-[120px] px-6" id="cta">
        <div className="max-w-container mx-auto text-center">
          <h2 className="text-[clamp(28px,4vw,42px)] font-[900] tracking-[-0.03em] mb-4">
            Start Building in 5 Minutes.
          </h2>
          <p className="text-[16px] text-recur-text-body max-w-[440px] mx-auto mb-8">
            Three lines of code. One transaction. Recurring revenue on Solana.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button className="btn-primary text-[14px] px-8 py-3.5">
              Connect Wallet
            </button>
            <button className="btn-secondary text-[14px] px-8 py-3.5">
              Read the Docs
            </button>
          </div>

          {/* Powered by Solana badge */}
          <div className="mt-10 flex items-center justify-center gap-2 text-[11px] text-recur-text-dim">
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <path d="M2.3 9.2h9l1.4-1.4H3.7L2.3 9.2z" fill="#14F195" />
              <path d="M2.3 2.8h9l1.4 1.4H3.7L2.3 2.8z" fill="#14F195" />
              <path d="M2.3 6h9l1.4-1.4H3.7L2.3 6z" fill="#9945FF" />
            </svg>
            Powered by Solana
          </div>
        </div>
      </section>

      {/* ═══════════════════════ 13. FOOTER ═══════════════════════ */}
      <footer className="border-t border-recur-border py-8 px-6">
        <div className="max-w-container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <RecurLogoWordmark height={28} />
              <span className="text-[12px] text-recur-text-dim">
                On-chain billing infrastructure for Solana
              </span>
            </div>
            <div className="flex items-center gap-6 text-[12px] text-recur-text-muted">
              <a href="#" className="hover:text-recur-light transition-colors">
                Docs
              </a>
              <a href="#" className="hover:text-recur-light transition-colors">
                GitHub
              </a>
              <a href="#" className="hover:text-recur-light transition-colors">
                Twitter
              </a>
              <a href="#" className="hover:text-recur-light transition-colors">
                Discord
              </a>
            </div>
          </div>
          <div className="text-center mt-6 text-[11px] text-recur-text-dim">
            Colosseum Frontier Hackathon 2026
          </div>
        </div>
      </footer>
    </>
  );
}
