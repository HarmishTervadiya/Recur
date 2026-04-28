"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../../../../lib/api-client";
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
      <h2 className="text-[15px] font-bold text-recur-text-heading mb-4">
        Transactions
      </h2>

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
