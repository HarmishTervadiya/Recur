export function VsStripe() {
  return (
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="#A78BFA" strokeWidth="1.5" />
                <path d="M12 6v12M6 12h12" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold text-recur-light mb-2">Solana Native</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              Stripe is EVM-only (Polygon, Base). No Solana. Recur: 400ms finality, $0.001 gas, no bridge complexity.
            </p>
          </div>

          <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors">
            <div className="mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="3" stroke="#A78BFA" strokeWidth="1.5" />
                <path d="M8 12l3 3 5-6" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold text-recur-light mb-2">Capped Approvals</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              Stripe&apos;s Bridge contracts allow uncapped withdrawals. Recur uses SPL delegate with per-cycle caps. Users see exactly what they approve.
            </p>
          </div>

          <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors">
            <div className="mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="#A78BFA" strokeWidth="1.5" />
                <path d="M8 14c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="9" cy="10" r="1" fill="#A78BFA" />
                <circle cx="15" cy="10" r="1" fill="#A78BFA" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold text-recur-light mb-2">Any Country, No KYC</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              Stripe requires US-registered merchants. Recur: 195+ countries, wallet-to-wallet, no bank account needed.
            </p>
          </div>

          <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors">
            <div className="mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 17l6-6 4 4 6-8" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold text-recur-light mb-2">Developer-First SDK</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              Stripe: checkout sessions, redirect URLs, webhook endpoints. Recur:{" "}
              <span className="font-mono text-recur-glow text-[11px]">npm install @recur/react</span>, done.
            </p>
          </div>
        </div>

        <div className="mt-8 bg-recur-purple-tint/30 border border-recur-border-light/40 rounded-[14px] p-6 max-w-2xl mx-auto text-center">
          <p className="text-[14px] text-recur-text-body italic leading-relaxed mb-3">
            &ldquo;This looks like uncapped ability to withdraw tokens.&rdquo;
          </p>
          <p className="text-[12px] text-recur-text-muted">
            Jess Houlgrave, WalletConnect, on Stripe&apos;s stablecoin approach
          </p>
          <p className="text-[12px] text-recur-light font-semibold mt-2">
            Recur&apos;s SPL delegate with explicit amount caps per cycle is the answer.
          </p>
        </div>
      </div>
    </section>
  );
}
