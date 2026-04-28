"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RecurLogoIcon } from "../components/icons/RecurLogoIcon";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Route error:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="min-h-screen bg-recur-base flex items-center justify-center px-6"
    >
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <RecurLogoIcon size={48} />
        </div>
        <h1 className="text-[26px] font-bold text-recur-text-heading mb-2">
          Something went wrong
        </h1>
        <p className="text-[13px] text-recur-text-muted mb-6">
          An unexpected error occurred while loading this page. You can try
          again, or head back home.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-recur-text-dim mb-6 break-all">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-primary text-[13px] px-5 py-2.5"
          >
            Try Again
          </button>
          <Link href="/" className="btn-secondary text-[13px] px-5 py-2.5">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
