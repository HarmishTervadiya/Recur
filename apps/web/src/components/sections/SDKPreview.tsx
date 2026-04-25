"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export function SDKPreview() {
  const [activeTab, setActiveTab] = useState<"npm" | "yarn" | "pnpm">("npm");
  const [copied, setCopied] = useState(false);
  const [codeTyped, setCodeTyped] = useState<number[]>([]);
  const codeTriggered = useRef(false);

  useEffect(() => {
    const el = document.getElementById("code-block");
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !codeTriggered.current) {
          codeTriggered.current = true;
          entry.target.classList.add("visible");
          const totalLines = 14;
          for (let i = 0; i < totalLines; i++) {
            setTimeout(() => setCodeTyped((prev) => [...prev, i]), i * 60);
          }
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const installCmd =
    activeTab === "npm"
      ? "npm install"
      : activeTab === "yarn"
        ? "yarn add"
        : "pnpm add";

  const handleCopy = useCallback(() => {
    const code = `${installCmd} @recur/sdk

import { RecurClient } from '@recur/sdk'

const recur = new RecurClient({
  rpcUrl: 'https://api.devnet.solana.com',
  apiBaseUrl: 'https://api.recur.so'
})

const plan = await recur.getPlan(appId, planId)`;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [installCmd]);

  const codeLines = [
    { content: <span className="text-recur-text-dim">{"// install"}</span> },
    {
      content: (
        <>
          <span className="text-recur-text-heading">{installCmd}</span>{" "}
          <span className="text-recur-success">@recur/sdk</span>
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
            {"{ RecurClient }"}
          </span>{" "}
          <span className="text-recur-glow">from</span>{" "}
          <span className="text-recur-success">
            &apos;@recur/sdk&apos;
          </span>
        </>
      ),
    },
    { content: <br /> },
    {
      content: (
        <>
          <span className="text-recur-glow">const</span>{" "}
          <span className="text-recur-warning">recur</span>{" "}
          <span className="text-recur-text-heading">= new RecurClient({"{"}</span>
        </>
      ),
    },
    {
      content: (
        <span className="pl-6">
          <span className="text-recur-success">rpcUrl</span>
          <span className="text-recur-text-heading">
            : &quot;https://api.devnet.solana.com&quot;,
          </span>
        </span>
      ),
    },
    {
      content: (
        <span className="pl-12">
          <span className="text-recur-success">apiBaseUrl</span>
          <span className="text-recur-text-heading">
            : &quot;https://api.recur.so&quot;,
          </span>
        </span>
      ),
    },
    {
      content: (
        <span className="pl-16">
          <span className="text-recur-text-heading">{"})"}</span>
        </span>
      ),
    },
    {
      content: (
        <span className="pl-16">
          <span className="text-recur-glow">const</span>{" "}
          <span className="text-recur-warning">plan</span>{" "}
          <span className="text-recur-text-heading">= await recur.getPlan(</span>
        </span>
      ),
    },
    {
      content: (
        <span className="pl-16">
          <span className="text-recur-success">appId</span>
          <span className="text-recur-text-heading">
            ,{" "}
          </span>
          <span className="text-recur-success">planId</span>
        </span>
      ),
    },
    {
      content: (
        <span className="pl-16">
          <span className="text-recur-text-heading">)</span>
        </span>
      ),
    },
    {
      content: (
        <span className="pl-12">
          <span className="text-recur-text-dim">{"// build and send tx in your UI"}</span>
        </span>
      ),
    },
  ];

  return (
    <section id="developers" className="section-animate py-24 px-6">
      <div className="max-w-container mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-recur-primary mb-2">
              Developer SDK
            </div>
            <h2 className="text-[clamp(24px,3.5vw,32px)] font-[800] tracking-[-0.02em] mb-3">
              Three Lines. That&apos;s It.
            </h2>
            <p className="text-[15px] text-recur-text-body leading-relaxed mb-8 max-w-[440px]">
              Install the SDK, verify an app-owned plan, then build the wallet
              transaction inside your Solana dApp. No checkout sessions, no redirects.
            </p>

            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <div className="step-badge mt-0.5">1</div>
                <div>
                  <div className="text-[13px] font-bold text-recur-text-heading">
                    Install
                  </div>
                  <div className="text-[12px] text-recur-text-muted font-mono mt-0.5">
                    npm install @recur/sdk
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
                    {"import { RecurClient } from '@recur/sdk'"}
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
                    {"recur.getPlan(appId, planId)"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
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
              <button
                onClick={handleCopy}
                className="ml-auto text-[11px] font-medium text-recur-text-dim hover:text-recur-light px-3 py-1.5 transition-colors flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 6l3 3 5-6" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-recur-success">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M8 4V2.5A1.5 1.5 0 006.5 1h-4A1.5 1.5 0 001 2.5v4A1.5 1.5 0 002.5 8H4" stroke="currentColor" strokeWidth="1.2" />
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
              {codeLines.map((line, i) => (
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
  );
}
