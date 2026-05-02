"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../../../../lib/api-client";
import { useTier } from "../../../../../lib/use-tier";
import { formatAmount, truncateWallet, type Transaction } from "./utils";

interface TransactionsTabProps {
  appId: string;
}

export function TransactionsTab({ appId }: TransactionsTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPage = useCallback(
    async (p: number, signal?: AbortSignal) => {
      setLoading(true);
      const res = await apiClient<Transaction[]>(
        `/merchant/apps/${appId}/transactions?page=${p}&limit=20`,
      );
      if (signal?.aborted) return;
      if (res.success && res.data) {
        setTransactions(res.data);
        setPage(p);
        if (res.pagination) setTotalPages(res.pagination.totalPages);
      }
      setLoading(false);
    },
    [appId],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchPage(1, controller.signal);
    return () => controller.abort();
  }, [fetchPage]);

  return (
    <div
      key="tab-transactions"
      id="tabpanel-transactions"
      role="tabpanel"
      aria-labelledby="tab-transactions"
      className="motion-safe:animate-fade-in"
    >
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-[15px] font-bold text-recur-text-heading">
          Transactions
        </h2>
        <ExportButtons />
      </div>

      {loading && transactions.length === 0 ? (
        <div
          className="dark-card text-center py-12"
          role="status"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Loading transactions…</span>
          <div
            className="motion-safe:animate-pulse h-4 w-32 bg-recur-border rounded mx-auto"
            aria-hidden="true"
          />
        </div>
      ) : transactions.length === 0 ? (
        <div className="dark-card text-center py-12">
          <p className="text-recur-text-muted text-[13px]">
            No transactions yet.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-recur-surface border border-recur-border rounded-[14px] overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">
                Transactions, page {page} of {totalPages || 1}
              </caption>
              <thead>
                <tr className="border-b border-recur-border">
                  {[
                    "From",
                    "Amount",
                    "Fee",
                    "Net",
                    "Status",
                    "Tx",
                    "Date",
                  ].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="text-left text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr
                    key={tx.id}
                    className={
                      i < transactions.length - 1
                        ? "border-b border-recur-card"
                        : ""
                    }
                  >
                    <td className="px-4 py-3 text-[11px] font-mono text-recur-text-body">
                      {tx.fromWallet ? truncateWallet(tx.fromWallet) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] font-mono text-recur-text-heading">
                      {formatAmount(tx.amountGross)}
                    </td>
                    <td className="px-4 py-3 text-[12px] font-mono text-recur-text-muted">
                      {formatAmount(tx.platformFee)}
                    </td>
                    <td className="px-4 py-3 text-[12px] font-mono text-recur-success font-semibold">
                      {formatAmount(tx.amountNet)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          tx.status === "success"
                            ? "text-recur-success bg-recur-success/10"
                            : "text-recur-error bg-recur-error/10"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tx.txSignature ? (
                        <a
                          href={`https://explorer.solana.com/tx/${tx.txSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-recur-light hover:text-recur-glow motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary rounded"
                        >
                          {tx.txSignature.slice(0, 8)}...
                        </a>
                      ) : (
                        <span className="text-[11px] text-recur-text-dim">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-recur-text-muted">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <nav
              className="flex items-center justify-center gap-2 mt-4"
              aria-label="Transactions pagination"
            >
              <button
                onClick={() => fetchPage(page - 1)}
                disabled={page <= 1 || loading}
                className="btn-secondary text-[11px] px-3 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span
                className="text-[11px] text-recur-text-muted"
                aria-live="polite"
              >
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => fetchPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="btn-secondary text-[11px] px-3 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export Buttons
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function ExportButtons() {
  const { isPro } = useTier();

  const handleExport = useCallback(
    (type: "transactions" | "subscriptions" | "subscribers", fullHistory = false) => {
      const token = typeof window !== "undefined"
        ? localStorage.getItem("recur_access_token")
        : null;

      const params = new URLSearchParams();
      // For free-tier 30-day export, omit `since` — the server defaults to 30 days
      // via enforceDateRange(). Sending a client-computed value causes clock-skew 402s.

      const url = `${API_BASE_URL}/merchant/exports/${type}.csv?${params.toString()}`;

      // Open in new tab with auth header via fetch + blob download
      fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Export failed: ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `recur-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(a.href);
        })
        .catch(() => {
          // Silently fail — user will see empty download or network error
        });
    },
    [],
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => handleExport("transactions", false)}
        className="btn-secondary text-[11px] px-3 py-1.5"
        title="Export last 30 days of transactions"
      >
        <DownloadIcon />
        Last 30 Days
      </button>

      {isPro ? (
        <>
          <button
            onClick={() => handleExport("transactions", true)}
            className="btn-secondary text-[11px] px-3 py-1.5"
            title="Export full transaction history"
          >
            <DownloadIcon />
            Full History
          </button>
          <button
            onClick={() => handleExport("subscriptions", true)}
            className="btn-secondary text-[11px] px-3 py-1.5"
            title="Export all subscriptions"
          >
            <DownloadIcon />
            Subscriptions
          </button>
          <button
            onClick={() => handleExport("subscribers", true)}
            className="btn-secondary text-[11px] px-3 py-1.5"
            title="Export all subscribers"
          >
            <DownloadIcon />
            Subscribers
          </button>
        </>
      ) : (
        <span
          className="text-[10px] text-recur-text-dim flex items-center gap-1"
          title="Upgrade to Pro for full export history"
        >
          <LockMiniIcon />
          <a
            href="/dashboard/settings#recur-pro"
            className="text-recur-primary hover:underline"
          >
            Pro: Full History
          </a>
        </span>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="inline mr-1"
      aria-hidden="true"
    >
      <path
        d="M6 1v7M3 6l3 3 3-3M2 10h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockMiniIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="7"
        width="10"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 7V5a3 3 0 016 0v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
