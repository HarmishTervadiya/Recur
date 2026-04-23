export function CTA() {
  return (
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

        <div className="mt-10 flex items-center justify-center gap-2 text-[11px] text-recur-text-dim">
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
            <path d="M2.3 9.2h9l1.4-1.4H3.7L2.3 9.2z" fill="#14F195" />
            <path d="M2.3 2.8h9l1.4 1.4H3.7L2.3 2.8z" fill="#14F195" />
            <path d="M2.3 6h9l1.4-1.4H3.7L2.3 6z" fill="#9945FF" />
          </svg>
          Powered by Solana
        </div>
      </div>
    </section>
  );
}
