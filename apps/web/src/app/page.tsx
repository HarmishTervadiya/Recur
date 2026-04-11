"use client";

import { useEffect, useState, useRef } from "react";

/* ─────────────────────────────────────────────
   Section order & UX rationale:
   01  Nav          – sticky, minimal, transparent → solid on scroll
   02  Hero         – full-viewport, badge, headline, sub, CTAs, stats
   03  Trust strip  – credibility before education (hackathon, Solana)
   04  Problem      – 3 pain-point cards (create tension)
   05  How it works – 4-step horizontal pipeline (resolve tension)
   06  SDK code     – backend-in-a-box, developer hook
   07  Dashboard    – live-looking merchant dashboard mockup
   08  Comparison   – pricing table, devastating numbers
   09  Use cases    – 3 audience cards (SaaS, Gaming, API)
   10  FAQ          – objection handling at point of commitment
   11  CTA footer   – single clear action
   ───────────────────────────────────────────── */

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [counts, setCounts] = useState({ fee: 0, finality: 0, countries: 0 });
  const [dashPayments, setDashPayments] = useState<number[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const heroStatsTriggered = useRef(false);
  const dashboardTriggered = useRef(false);

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
                const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
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
              [0, 1, 2, 3].forEach((i) => {
                setTimeout(
                  () => setDashPayments((prev) => [...prev, i]),
                  i * 600,
                );
              });
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

  return (
    <>
      {/* ═══════════════════════════════ 01. NAV ═══════════════════════════════ */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-recur-base/95 backdrop-blur-md border-b border-recur-border py-3"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-container mx-auto px-6 flex justify-between items-center">
          <div className="text-[15px] font-extrabold text-recur-light tracking-[0.08em]">
            RECUR
          </div>
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

      {/* ═══════════════════════════════ 02. HERO ═══════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col justify-center items-center text-center px-6 overflow-hidden">
        {/* Subtle grid + radial glow background */}
        <div className="absolute inset-0 hero-grid-bg" />
        <div className="absolute inset-0 hero-radial-glow" />

        <div className="relative max-w-container mx-auto flex flex-col items-center pt-24 pb-16">
          {/* Badge pill */}
          <div className="section-animate inline-flex items-center gap-2.5 text-[11px] font-medium text-recur-light bg-recur-purple-tint/60 border border-[#3D2D70] rounded-full py-1.5 px-4 mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-recur-sgreen opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-recur-sgreen" />
            </span>
            Built on Solana &middot; Colosseum Frontier 2026
          </div>

          {/* H1 */}
          <h1 className="section-animate text-[40px] md:text-[64px] font-extrabold tracking-[-0.03em] leading-[1.08] mb-6 max-w-[720px]">
            Recurring Payments.{" "}
            <span className="text-gradient-purple">Natively on Solana.</span>
          </h1>

          {/* Subhead with highlighted differentiators */}
          <p className="section-animate text-[16px] md:text-[18px] text-recur-text-body leading-[1.8] max-w-[560px] mb-10">
            One signature. Automatic collection every billing cycle. USDC direct
            to your treasury:{" "}
            <span className="squiggly-highlight">No Bank</span>,{" "}
            <span className="squiggly-highlight">No KYC</span>,{" "}
            <span className="squiggly-highlight">No EVM</span>.
          </p>

          {/* CTAs */}
          <div className="section-animate flex flex-wrap gap-4 justify-center">
            <button className="btn-primary">Start Building</button>
            <button className="btn-secondary">Read the Docs</button>
          </div>

          {/* Stats bar */}
          <div
            id="hero-stats"
            className="section-animate grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mt-16 pt-10 border-t border-recur-border/60 w-full max-w-[640px]"
          >
            <div className="stat-block">
              <div className="stat-value">${counts.fee.toFixed(3)}</div>
              <div className="stat-label">Per Execution</div>
            </div>
            <div className="stat-block">
              <div className="stat-value">{Math.round(counts.finality)}ms</div>
              <div className="stat-label">Finality</div>
            </div>
            <div className="stat-block">
              <div className="stat-value">3 Lines</div>
              <div className="stat-label">To Integrate</div>
            </div>
            <div className="stat-block">
              <div className="stat-value">{Math.round(counts.countries)}+</div>
              <div className="stat-label">Countries</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ 03. TRUST STRIP ═══════════════════════════════ */}
      <section className="py-10 border-y border-recur-border/40 bg-recur-surface/50">
        <div className="max-w-container mx-auto px-6">
          <div className="section-animate flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 text-[12px] text-recur-text-muted">
            <span className="uppercase tracking-wider font-semibold text-recur-text-muted/60">
              Built at
            </span>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-recur-spurple" />
              <span className="text-recur-text-subheading font-semibold">
                Colosseum Frontier Hackathon 2026
              </span>
            </div>
            <div className="hidden md:block w-px h-4 bg-recur-border" />
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-recur-sgreen" />
              <span className="text-recur-text-subheading font-semibold">
                Solana Ecosystem
              </span>
            </div>
            <div className="hidden md:block w-px h-4 bg-recur-border" />
            <div className="flex items-center gap-3">
              <span className="font-mono text-recur-light font-bold">USDC</span>
              <span className="text-recur-text-subheading font-semibold">
                Native Settlement
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ 04. PROBLEM ═══════════════════════════════ */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-container mx-auto">
          <div className="section-animate text-center mb-16">
            <p className="text-[12px] font-semibold text-recur-primary uppercase tracking-wider mb-3">
              The problem
            </p>
            <h2 className="text-[28px] md:text-[36px] font-extrabold tracking-tight mb-4">
              Crypto Billing Is Broken
            </h2>
            <p className="text-[16px] text-recur-text-body max-w-[520px] mx-auto">
              Stripe proved the market. Recurring billing in crypto is real. But
              their version leaves most of the world behind.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1 */}
            <div className="section-animate dark-card group hover:border-recur-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-recur-purple-tint flex items-center justify-center mb-5 border border-[#3D2D70]">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#A78BFA"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3 className="text-[17px] font-bold mb-2">US-Only, EVM-Only</h3>
              <p className="text-[14px] leading-relaxed">
                Stripe&apos;s crypto billing requires a US bank account and only
                supports EVM chains.
                <span className="text-recur-text-muted">
                  {" "}
                  Billions of users on Solana, SEA, LATAM and Africa are
                  excluded.
                </span>
              </p>
            </div>

            {/* Card 2 */}
            <div className="section-animate dark-card group hover:border-recur-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-recur-purple-tint flex items-center justify-center mb-5 border border-[#3D2D70]">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#A78BFA"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <h3 className="text-[17px] font-bold mb-2">Capital Lockups</h3>
              <p className="text-[14px] leading-relaxed">
                Token streaming protocols force users to escrow their entire
                balance upfront.
                <span className="text-recur-text-muted">
                  {" "}
                  Dead capital sitting in vaults instead of earning yield.
                </span>
              </p>
            </div>

            {/* Card 3 */}
            <div className="section-animate dark-card group hover:border-recur-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-recur-purple-tint flex items-center justify-center mb-5 border border-[#3D2D70]">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#A78BFA"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                  <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 4" />
                </svg>
              </div>
              <h3 className="text-[17px] font-bold mb-2">No Developer SDK</h3>
              <p className="text-[14px] leading-relaxed">
                Game studios and dApps must write custom smart contracts for
                every billing flow.
                <span className="text-recur-text-muted">
                  {" "}
                  Months of Anchor code for what should be a single component.
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ 05. HOW IT WORKS ═══════════════════════════════ */}
      <section
        id="how-it-works"
        className="py-20 md:py-28 px-6 bg-recur-surface/30"
      >
        <div className="max-w-container mx-auto">
          <div className="section-animate text-center mb-16">
            <p className="text-[12px] font-semibold text-recur-primary uppercase tracking-wider mb-3">
              How it works
            </p>
            <h2 className="text-[28px] md:text-[36px] font-extrabold tracking-tight mb-4">
              Four Steps. Fully Automated.
            </h2>
            <p className="text-[16px] text-recur-text-body max-w-[480px] mx-auto">
              User signs once. Keepers handle every cycle after that. Merchants
              get paid without lifting a finger.
            </p>
          </div>

          {/* 4 horizontal pipeline cards */}
          <div className="section-animate grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                num: "01",
                title: "Authorise",
                desc: "User signs a single SPL token-delegate approval matching your subscription parameters.",
                tag: "One tx",
              },
              {
                num: "02",
                title: "Delegate",
                desc: "A program-derived account (PDA) is created on Solana, locking in the recurring conditions immutably.",
                tag: "On-chain",
              },
              {
                num: "03",
                title: "Execute",
                desc: "Recur Keepers monitor state and fire the collection transaction precisely when each billing cycle hits.",
                tag: "Automated",
              },
              {
                num: "04",
                title: "Settle",
                desc: "USDC lands in the merchant treasury. Off-chain webhooks trigger app-level access instantly.",
                tag: "Instant",
              },
            ].map((step, i) => (
              <div
                key={step.num}
                className="relative bg-recur-surface border border-recur-border rounded-xl p-6 group hover:border-recur-primary/30 transition-colors"
              >
                {/* Faint connector on desktop */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-[11px] w-[22px] h-px bg-gradient-to-r from-recur-border to-transparent z-10" />
                )}
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[13px] font-bold text-recur-primary font-mono">
                    {step.num}
                  </span>
                  <span className="text-[10px] font-semibold text-recur-text-muted uppercase tracking-wider bg-recur-purple-tint/40 px-2 py-0.5 rounded-full">
                    {step.tag}
                  </span>
                </div>
                <h3 className="text-[17px] font-bold mb-2">{step.title}</h3>
                <p className="text-[14px] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ 06. SDK CODE BLOCK ═══════════════════════════════ */}
      <section id="developers" className="py-20 md:py-28 px-6">
        <div className="max-w-container mx-auto">
          <div className="section-animate text-center mb-16">
            <p className="text-[12px] font-semibold text-recur-primary uppercase tracking-wider mb-3">
              For developers
            </p>
            <h2 className="text-[28px] md:text-[36px] font-extrabold tracking-tight mb-4">
              Backend-in-a-Box
            </h2>
            <p className="text-[16px] text-recur-text-body max-w-[500px] mx-auto">
              A single React component. We handle the on-chain programs,
              Keepers, and reconciliation webhooks.
            </p>
          </div>

          <div className="section-animate flex flex-col lg:flex-row bg-recur-surface border border-recur-border rounded-2xl overflow-hidden">
            {/* Left: 3 steps */}
            <div className="flex-1 p-8 md:p-10 lg:p-12 border-b lg:border-b-0 lg:border-r border-recur-border">
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="step-badge">1</div>
                  <div>
                    <h4 className="text-[16px] font-bold mb-1">
                      Install the SDK
                    </h4>
                    <p className="text-[14px] leading-relaxed">
                      One npm package. Works with any React or Next.js project
                      on Solana.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="step-badge">2</div>
                  <div>
                    <h4 className="text-[16px] font-bold mb-1">
                      Import the Component
                    </h4>
                    <p className="text-[14px] leading-relaxed">
                      Pre-built elements abstract away Anchor and Web3.js
                      complexity entirely.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="step-badge">3</div>
                  <div>
                    <h4 className="text-[16px] font-bold mb-1">
                      Render and Collect Revenue
                    </h4>
                    <p className="text-[14px] leading-relaxed">
                      You handle the front-end. The Keeper network guarantees
                      you get paid every cycle.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: code block */}
            <div className="flex-[1.4] w-full bg-recur-base">
              {/* Terminal chrome */}
              <div className="flex items-center gap-2 px-6 py-3 border-b border-recur-border/60">
                <div className="w-[10px] h-[10px] rounded-full bg-recur-error/40" />
                <div className="w-[10px] h-[10px] rounded-full bg-recur-warning/40" />
                <div className="w-[10px] h-[10px] rounded-full bg-recur-success/40" />
                <span className="ml-3 text-[11px] text-recur-text-muted font-mono">
                  pricing-page.tsx
                </span>
              </div>
              <div className="p-6 md:p-8 font-mono text-[13px] leading-[1.9] overflow-x-auto">
                <div className="text-recur-text-muted">{"// install"}</div>
                <div>
                  <span className="text-recur-text-heading">npm install </span>
                  <span className="text-recur-success">@recur/react</span>
                </div>
                <br />
                <div className="text-recur-text-muted">
                  {"// drop into any Solana dApp"}
                </div>
                <div>
                  <span className="text-recur-glow">import</span>
                  <span className="text-recur-text-heading">
                    {" { RecurButton } "}
                  </span>
                  <span className="text-recur-glow">from</span>
                  <span className="text-recur-success">
                    {" "}
                    &apos;@recur/react&apos;
                  </span>
                </div>
                <br />
                <div>
                  <span className="text-recur-glow">
                    export default function{" "}
                  </span>
                  <span className="text-recur-warning">PricingPage</span>
                  <span className="text-recur-text-heading">{"() {"}</span>
                </div>
                <div className="pl-6">
                  <span className="text-recur-glow">return </span>
                  <span className="text-recur-text-heading">(</span>
                </div>
                <div className="pl-10">
                  <span className="text-recur-text-heading">&lt;</span>
                  <span className="text-recur-warning">RecurButton</span>
                </div>
                <div className="pl-14">
                  <span className="text-recur-success">planId</span>
                  <span className="text-recur-text-heading">
                    =&quot;premium_monthly&quot;
                  </span>
                </div>
                <div className="pl-14">
                  <span className="text-recur-success">amount</span>
                  <span className="text-recur-text-heading">={"{5}"}</span>
                </div>
                <div className="pl-14">
                  <span className="text-recur-success">token</span>
                  <span className="text-recur-text-heading">
                    =&quot;USDC&quot;
                  </span>
                </div>
                <div className="pl-14">
                  <span className="text-recur-success">interval</span>
                  <span className="text-recur-text-heading">
                    =&quot;monthly&quot;
                  </span>
                </div>
                <div className="pl-10">
                  <span className="text-recur-text-heading">/&gt;</span>
                </div>
                <div className="pl-6">
                  <span className="text-recur-text-heading">)</span>
                </div>
                <div>
                  <span className="text-recur-text-heading">{"}"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ 07. DASHBOARD MOCKUP ═══════════════════════════════ */}
      <section
        id="dashboard-section"
        className="section-animate py-20 md:py-28 px-6 bg-recur-surface/30"
      >
        <div className="max-w-container mx-auto">
          <div className="text-center mb-16">
            <p className="text-[12px] font-semibold text-recur-primary uppercase tracking-wider mb-3">
              Merchant Dashboard
            </p>
            <h2 className="text-[28px] md:text-[36px] font-extrabold tracking-tight mb-4">
              See Every Payment. In Real Time.
            </h2>
            <p className="text-[16px] text-recur-text-body max-w-[480px] mx-auto">
              MRR, active subscribers, collection rate: everything a finance
              team needs, on-chain.
            </p>
          </div>

          {/* Dashboard mockup */}
          <div className="bg-recur-base border border-recur-border rounded-2xl overflow-hidden max-w-[800px] mx-auto">
            {/* Dashboard header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-recur-border">
              <div className="flex items-center gap-3">
                <span className="text-[14px] font-bold text-recur-text-heading">
                  Acme Pro Pass
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-recur-success bg-recur-success/10 border border-recur-success/20 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-recur-success animate-pulse-dot" />
                live on Devnet
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 border-b border-recur-border">
              <div className="p-5 md:p-6 border-r border-recur-border">
                <div className="text-[11px] text-recur-text-muted uppercase tracking-wider mb-1">
                  Monthly MRR
                </div>
                <div className="text-[22px] md:text-[26px] font-extrabold text-recur-text-heading font-mono">
                  $2,400
                </div>
                <div className="text-[11px] text-recur-success mt-1 font-medium">
                  +12.4% this month
                </div>
              </div>
              <div className="p-5 md:p-6 border-r border-recur-border">
                <div className="text-[11px] text-recur-text-muted uppercase tracking-wider mb-1">
                  Active Subscribers
                </div>
                <div className="text-[22px] md:text-[26px] font-extrabold text-recur-text-heading font-mono">
                  480
                </div>
                <div className="text-[11px] text-recur-success mt-1 font-medium">
                  +34 this week
                </div>
              </div>
              <div className="p-5 md:p-6">
                <div className="text-[11px] text-recur-text-muted uppercase tracking-wider mb-1">
                  Collection Rate
                </div>
                <div className="text-[22px] md:text-[26px] font-extrabold text-recur-text-heading font-mono">
                  98.2%
                </div>
                <div className="text-[11px] text-recur-text-muted mt-1">
                  last 30 days
                </div>
              </div>
            </div>

            {/* Recent payments */}
            <div className="p-5 md:p-6">
              <div className="text-[10px] font-semibold text-recur-text-muted uppercase tracking-wider mb-4">
                Recent Payments
              </div>
              <div className="space-y-0">
                {[
                  {
                    addr: "7xKX...4mPQ",
                    amount: "+$5.00 USDC",
                    time: "2s ago",
                    status: "success",
                  },
                  {
                    addr: "3rLM...8vXZ",
                    amount: "+$5.00 USDC",
                    time: "1m ago",
                    status: "success",
                  },
                  {
                    addr: "9tNB...2kRW",
                    amount: "+$5.00 USDC",
                    time: "3m ago",
                    status: "success",
                  },
                  {
                    addr: "5sQE...7hYP",
                    amount: "Failed: Low Balance",
                    time: "5m ago",
                    status: "error",
                  },
                ].map((payment, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between py-2.5 text-[12px] border-b border-recur-border/40 last:border-0 transition-all duration-500 ${
                      dashPayments.includes(i)
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-1"
                    }`}
                  >
                    <span className="font-mono text-recur-text-body">
                      {payment.addr}
                    </span>
                    <span
                      className={`font-mono font-medium ${
                        payment.status === "success"
                          ? "text-recur-success"
                          : "text-recur-error"
                      }`}
                    >
                      {payment.amount}
                    </span>
                    <span className="text-recur-text-muted">
                      {payment.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ 08. COMPARISON TABLE ═══════════════════════════════ */}
      <section id="pricing" className="py-20 md:py-28 px-6">
        <div className="max-w-container mx-auto">
          <div className="section-animate text-center mb-16">
            <p className="text-[12px] font-semibold text-recur-primary uppercase tracking-wider mb-3">
              Pricing
            </p>
            <h2 className="text-[28px] md:text-[36px] font-extrabold tracking-tight mb-4">
              Transparent. Devastating.
            </h2>
            <p className="text-[16px] text-recur-text-body max-w-[480px] mx-auto">
              We don&apos;t hide fees in fine print. Here&apos;s how Recur
              compares to every alternative.
            </p>
          </div>

          <div className="section-animate overflow-x-auto">
            <div className="bg-recur-surface border border-recur-border rounded-2xl overflow-hidden min-w-[680px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-recur-border">
                    <th className="p-4 md:p-5 text-left text-[12px] font-semibold text-recur-text-muted uppercase tracking-wider">
                      Engine
                    </th>
                    <th className="p-4 md:p-5 text-left text-[12px] font-semibold text-recur-text-muted uppercase tracking-wider">
                      Fees
                    </th>
                    <th className="p-4 md:p-5 text-left text-[12px] font-semibold text-recur-text-muted uppercase tracking-wider">
                      Network
                    </th>
                    <th className="p-4 md:p-5 text-left text-[12px] font-semibold text-recur-text-muted uppercase tracking-wider">
                      Geography
                    </th>
                    <th className="p-4 md:p-5 text-left text-[12px] font-semibold text-recur-text-muted uppercase tracking-wider">
                      Lockup
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-recur-border/60">
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-heading font-medium">
                      Stripe Crypto
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-heading font-mono">
                      2.9% + 30c
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-body">
                      EVM Only
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-body">
                      US Only
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-body">
                      None
                    </td>
                  </tr>
                  <tr className="border-b border-recur-border/60">
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-heading font-medium">
                      GoCardless
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-heading font-mono">
                      1.0% + 20c
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-body">
                      Fiat Only
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-body">
                      Legacy KYC
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-body">
                      None
                    </td>
                  </tr>
                  <tr className="border-b border-recur-border/60">
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-heading font-medium">
                      Token Streams
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-heading font-mono">
                      0.0%
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-body">
                      Multi-chain
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-text-body">
                      Global
                    </td>
                    <td className="p-4 md:p-5 text-[14px] text-recur-error font-medium">
                      Full Vault Lock
                    </td>
                  </tr>
                  {/* Recur row (highlighted) */}
                  <tr className="bg-recur-purple-tint/40">
                    <td className="p-4 md:p-5 text-[14px] font-extrabold text-recur-light">
                      Recur
                    </td>
                    <td className="p-4 md:p-5 text-[14px] font-extrabold text-recur-success font-mono">
                      0.25% + 1c
                    </td>
                    <td className="p-4 md:p-5 text-[14px] font-semibold text-recur-text-heading">
                      Solana
                    </td>
                    <td className="p-4 md:p-5 text-[14px] font-semibold text-recur-text-heading">
                      Borderless
                    </td>
                    <td className="p-4 md:p-5 text-[14px] font-bold text-recur-success">
                      Zero
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ 09. USE CASES ═══════════════════════════════ */}
      <section className="py-20 md:py-28 px-6 bg-recur-surface/30">
        <div className="max-w-container mx-auto">
          <div className="section-animate text-center mb-16">
            <p className="text-[12px] font-semibold text-recur-primary uppercase tracking-wider mb-3">
              Use cases
            </p>
            <h2 className="text-[28px] md:text-[36px] font-extrabold tracking-tight mb-4">
              Built for Solana-Native Businesses
            </h2>
            <p className="text-[16px] text-recur-text-body max-w-[520px] mx-auto">
              Any business model that bills on a recurring basis. One primitive,
              infinite use cases.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* SaaS */}
            <div className="section-animate dark-card group hover:border-recur-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-recur-purple-tint flex items-center justify-center border border-[#3D2D70]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                  </svg>
                </div>
                <span className="text-[10px] font-semibold text-recur-text-muted uppercase tracking-wider">
                  Recurring
                </span>
              </div>
              <h3 className="text-[17px] font-bold mb-2">SaaS Subscriptions</h3>
              <p className="text-[14px] leading-relaxed">
                Bill users monthly in USDC. No capital lockups, instant
                settlement, auto-cancellation on failed payments.
              </p>
              <div className="mt-5 pt-4 border-t border-recur-border/40">
                <span className="text-[12px] text-recur-light font-medium">
                  DeFi dashboards, analytics tools, infra APIs
                </span>
              </div>
            </div>

            {/* Gaming */}
            <div className="section-animate dark-card group hover:border-recur-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-recur-purple-tint flex items-center justify-center border border-[#3D2D70]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M6 12h4m2 0h4" />
                    <path d="M14 8v4m0 0v4" />
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                  </svg>
                </div>
                <span className="text-[10px] font-semibold text-recur-text-muted uppercase tracking-wider">
                  Gaming
                </span>
              </div>
              <h3 className="text-[17px] font-bold mb-2">
                In-Game Battle Passes
              </h3>
              <p className="text-[14px] leading-relaxed">
                Rolling subscriptions to premium game tracks. Auto-renew through
                Phantom with no manual re-signing each season.
              </p>
              <div className="mt-5 pt-4 border-t border-recur-border/40">
                <span className="text-[12px] text-recur-light font-medium">
                  Battle passes, guild memberships, season passes
                </span>
              </div>
            </div>

            {/* Usage-based */}
            <div className="section-animate dark-card group hover:border-recur-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-recur-purple-tint flex items-center justify-center border border-[#3D2D70]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M18 20V10" />
                    <path d="M12 20V4" />
                    <path d="M6 20v-6" />
                  </svg>
                </div>
                <span className="text-[10px] font-semibold text-recur-text-muted uppercase tracking-wider">
                  Metered
                </span>
              </div>
              <h3 className="text-[17px] font-bold mb-2">
                Usage-Based API Billing
              </h3>
              <p className="text-[14px] leading-relaxed">
                Charge infrastructure costs dynamically. Keepers can handle
                variable amounts without requiring re-authorisation.
              </p>
              <div className="mt-5 pt-4 border-t border-recur-border/40">
                <span className="text-[12px] text-recur-light font-medium">
                  RPC providers, AI endpoints, oracle feeds
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ 10. FAQ ═══════════════════════════════ */}
      <section id="faq" className="py-20 md:py-28 px-6">
        <div className="max-w-[760px] mx-auto">
          <div className="section-animate text-center mb-16">
            <p className="text-[12px] font-semibold text-recur-primary uppercase tracking-wider mb-3">
              FAQ
            </p>
            <h2 className="text-[28px] md:text-[36px] font-extrabold tracking-tight">
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
                className="section-animate bg-recur-surface border border-recur-border rounded-xl overflow-hidden transition-colors hover:border-recur-primary/20"
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

      {/* ═══════════════════════════════ 11. CTA FOOTER ═══════════════════════════════ */}
      <section className="section-animate relative py-24 md:py-32 px-6 border-t border-recur-border bg-recur-surface/50 overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_500px_300px_at_50%_50%,rgba(124,58,237,0.06),transparent)]" />

        <div className="relative max-w-[600px] mx-auto text-center">
          <h2 className="text-[32px] md:text-[40px] font-extrabold tracking-tight mb-4">
            Start collecting in 5 minutes.
          </h2>
          <p className="text-[16px] text-recur-text-body mb-10 max-w-[420px] mx-auto">
            Three lines of code. No bank account. USDC direct to your treasury.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button className="btn-primary">Connect Wallet</button>
            <button className="btn-secondary">Explore Documentation</button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ FOOTER ═══════════════════════════════ */}
      <footer className="py-10 px-6 border-t border-recur-border/40">
        <div className="max-w-container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-[13px] font-extrabold text-recur-light tracking-[0.08em]">
            RECUR
          </div>
          <div className="flex items-center gap-6 text-[12px] text-recur-text-muted">
            <a
              href="#"
              className="hover:text-recur-text-heading transition-colors"
            >
              Docs
            </a>
            <a
              href="#"
              className="hover:text-recur-text-heading transition-colors"
            >
              GitHub
            </a>
            <a
              href="#"
              className="hover:text-recur-text-heading transition-colors"
            >
              Twitter
            </a>
          </div>
          <div className="text-[11px] text-recur-text-muted">
            Built on Solana. Colosseum Frontier 2026.
          </div>
        </div>
      </footer>
    </>
  );
}
