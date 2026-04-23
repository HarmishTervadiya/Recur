"use client";

import { useEffect, useState } from "react";
import { RecurLogoIcon } from "../icons/RecurLogoIcon";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
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
  );
}
