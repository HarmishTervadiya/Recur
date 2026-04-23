export function Problem() {
  return (
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
          <div className="dark-card hover:border-recur-border-light transition-colors">
            <div className="w-10 h-10 rounded-[10px] bg-recur-error/10 border border-recur-error/20 flex items-center justify-center mb-4">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
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

          <div className="dark-card hover:border-recur-border-light transition-colors">
            <div className="w-10 h-10 rounded-[10px] bg-recur-error/10 border border-recur-error/20 flex items-center justify-center mb-4">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="12" height="12" rx="2" stroke="#F87171" strokeWidth="1.5" />
                <path d="M7 7l4 4M11 7l-4 4" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round" />
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

          <div className="dark-card hover:border-recur-border-light transition-colors">
            <div className="w-10 h-10 rounded-[10px] bg-recur-error/10 border border-recur-error/20 flex items-center justify-center mb-4">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 2v14M2 9h14" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M5 5l8 8" stroke="#F87171" strokeWidth="2" strokeLinecap="round" />
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
  );
}
