"use client";

import { useCallback, useState } from "react";
import { useToast } from "./ToastProvider";

interface CopyableIdProps {
  label: string;
  value: string;
  truncate?: boolean;
}

function truncateMiddle(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

async function writeClipboard(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyableId({ label, value, truncate = true }: CopyableIdProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const display = truncate ? truncateMiddle(value) : value;

  const handleCopy = useCallback(async () => {
    const ok = await writeClipboard(value);
    if (ok) {
      setCopied(true);
      toast("success", `${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast("error", `Failed to copy ${label}`);
    }
  }, [label, value, toast]);

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-recur-text-dim">
      <span className="uppercase tracking-wider not-italic">{label}:</span>
      <code
        className="text-recur-text-muted"
        title={value}
        aria-label={`${label} ${value}`}
      >
        {display}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center justify-center w-5 h-5 rounded text-recur-text-dim hover:text-recur-light hover:bg-recur-purple-tint motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary focus-visible:ring-offset-2 focus-visible:ring-offset-recur-base"
        aria-label={`Copy ${label}`}
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 10V4a1 1 0 0 1 1-1h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </span>
  );
}
