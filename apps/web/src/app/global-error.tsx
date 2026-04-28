"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown in the root layout itself (e.g. provider crashes).
 * Must define its own <html> and <body> tags — replaces the root layout.
 * Kept intentionally dependency-free so it can render even if the app's
 * providers / fonts / global CSS fail to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#0A0613",
          color: "#E4E4E7",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div role="alert" style={{ textAlign: "center", maxWidth: 420 }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: "0 0 8px",
              color: "#FAFAFA",
            }}
          >
            Application error
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#A1A1AA",
              margin: "0 0 24px",
              lineHeight: 1.6,
            }}
          >
            A critical error prevented the app from loading. Please reload to
            try again.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 10,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                color: "#71717A",
                margin: "0 0 24px",
                wordBreak: "break-all",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 20px",
              borderRadius: 10,
              background: "#7C3AED",
              color: "#FFFFFF",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
