export function Pricing() {
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

        <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-14">
          {/* Starter */}
          <div className="bg-recur-surface border border-recur-border rounded-[14px] p-6">
            <div className="text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-3">
              Starter
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[32px] font-[900] text-recur-text-heading">Free</span>
            </div>
            <p className="text-[13px] text-recur-text-muted mb-5">For developers testing on Devnet</p>
            <div className="space-y-2 mb-6">
              {["$0.05 flat + 0.25% per tx", "Unlimited Subscriptions", "SDK + React Component", "Webhook Notifications"].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-[13px] text-recur-text-body">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 7l3 3 5-6" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
              <span className="text-[32px] font-[900] text-recur-text-heading">$49</span>
              <span className="text-[14px] text-recur-text-muted">/month</span>
            </div>
            <p className="text-[13px] text-recur-text-muted mb-5">For production merchants</p>
            <div className="space-y-2 mb-6">
              {["Everything in Starter", "Merchant Dashboard", "Priority Keeper Execution", "Custom Branding + White-Label", "Dedicated Support"].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-[13px] text-recur-text-body">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 7l3 3 5-6" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                <tr key={i} className={i < 8 ? "border-b border-recur-card" : ""}>
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
