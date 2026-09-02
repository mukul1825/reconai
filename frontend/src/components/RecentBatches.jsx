import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { setCurrentBatch } from "../api/useCurrentBatch";
import { BatchStatusBadge } from "./Badges";
import { SkeletonRows, EmptyState, ErrorBanner } from "./States";
import { History } from "lucide-react";

function formatDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) {
    return `Today, ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Self-contained: fetches its own data, owns its own loading/empty/error/
 * pagination state, so DashboardPage stays about the CURRENT batch and
 * this stays about the batch's place in an ongoing operational history -
 * two different questions, two different fetches, not one bloated
 * component doing both.
 */
export default function RecentBatches({ currentBatchId }) {
  const [batches, setBatches] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    api
      .listBatches()
      .then((data) => {
        setBatches(data.batches);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await api.listBatches(nextCursor);
      setBatches((prev) => [...prev, ...data.batches]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  function openBatch(batchId) {
    if (batchId === currentBatchId) return;
    setCurrentBatch(batchId);
    navigate(`/dashboard?batch=${batchId}`);
  }

  return (
    <div className="mt-6">
      <p className="text-xs font-medium text-subtle mb-3">Recent batches</p>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4">
            <SkeletonRows count={4} />
          </div>
        ) : error ? (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        ) : batches.length === 0 ? (
          <EmptyState
            icon={History}
            title="No previous batches"
            description="Past reconciliation runs will show up here once you upload more than one."
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-2.5 font-medium text-xs text-subtle">Date</th>
                  <th className="px-4 py-2.5 font-medium text-xs text-subtle">Status</th>
                  <th className="px-4 py-2.5 font-medium text-xs text-subtle text-right">Match rate</th>
                  <th className="px-4 py-2.5 font-medium text-xs text-subtle text-right">Orders</th>
                  <th className="px-4 py-2.5 font-medium text-xs text-subtle text-right">Auto-resolved</th>
                  <th className="px-4 py-2.5 font-medium text-xs text-subtle text-right">Needs review</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const isCurrent = b.batchId === currentBatchId;
                  return (
                    <tr
                      key={b.batchId}
                      onClick={() => openBatch(b.batchId)}
                      className={`border-b border-line last:border-0 transition-colors ${
                        isCurrent ? "bg-accent-soft" : "cursor-pointer hover:bg-paper"
                      }`}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-ink">{formatDate(b.uploadedAt)}</span>
                        {isCurrent && (
                          <span className="ml-2 text-xs font-medium text-accent">Current</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <BatchStatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {b.matchRate != null ? `${b.matchRate}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-subtle">
                        {b.totalOrders}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-success">
                        {b.autoResolved}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-warning">
                        {b.pendingReview}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {nextCursor && (
              <div className="px-4 py-3 border-t border-line">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
