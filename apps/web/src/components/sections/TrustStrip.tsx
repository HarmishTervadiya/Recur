export function TrustStrip() {
  return (
    <section className="section-animate border-y border-recur-border py-4">
      <div className="max-w-container mx-auto px-6">
        <div className="flex items-center justify-center gap-6 flex-wrap text-[12px] text-recur-text-muted">
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="6" stroke="#7C3AED" strokeWidth="1.5" />
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
  );
}
