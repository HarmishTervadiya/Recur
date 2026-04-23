import { RecurLogoWordmark } from "../icons/RecurLogoWordmark";

export function Footer() {
  return (
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
  );
}
