export function UseCases() {
  return (
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
            From SaaS to gaming to DeFi. Anywhere users pay recurring, Recur powers it.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors group">
            <div className="w-10 h-10 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-4 group-hover:bg-recur-primary/20 transition-colors">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect x="2" y="3" width="14" height="12" rx="2" stroke="#A78BFA" strokeWidth="1.5" />
                <path d="M2 7h14" stroke="#A78BFA" strokeWidth="1.5" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold mb-1.5">SaaS</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              Monthly tooling subscriptions. Dev tools, analytics, APIs. Accept USDC, skip Stripe&apos;s 2.9%.
            </p>
          </div>

          <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors group">
            <div className="w-10 h-10 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-4 group-hover:bg-recur-primary/20 transition-colors">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 2l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4l2-4z" stroke="#A78BFA" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold mb-1.5">Gaming</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              Battle passes, season passes, premium memberships. Auto-renew in USDC, keep players engaged.
            </p>
          </div>

          <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors group">
            <div className="w-10 h-10 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-4 group-hover:bg-recur-primary/20 transition-colors">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <circle cx="9" cy="6" r="3" stroke="#A78BFA" strokeWidth="1.5" />
                <path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold mb-1.5">Creators</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              Content subscriptions, Patreon-style memberships, NFT access passes. Direct to creator wallet.
            </p>
          </div>

          <div className="bg-recur-surface border border-recur-border rounded-[14px] p-5 hover:border-recur-border-light transition-colors group">
            <div className="w-10 h-10 rounded-[10px] bg-recur-purple-tint border border-recur-border-light flex items-center justify-center mb-4 group-hover:bg-recur-primary/20 transition-colors">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 2v14M2 9h14" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="9" cy="9" r="7" stroke="#A78BFA" strokeWidth="1.5" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold mb-1.5">DeFi</h3>
            <p className="text-[12px] text-recur-text-body leading-relaxed">
              Auto-DCA, recurring deposits, protocol fees. Programmable money flows on Solana rails.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
