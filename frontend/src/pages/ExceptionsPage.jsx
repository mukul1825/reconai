import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentBatch } from "../api/useCurrentBatch";
import { Check, X, ArrowUpRight } from "lucide-react";
import { api } from "../api/client";
import { MatchTypeBadge, ActionBadge } from "../components/Badges";
import ConfidenceBar from "../components/ConfidenceBar";
import { SkeletonRows, EmptyState, ErrorBanner } from "../components/States";

export default function ExceptionsPage() {
  const batchId = useCurrentBatch();
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  useEffect(() => {
    if (!batchId) {
      setLoading(false);
      return;
    }
    load();
  }, [batchId]);

  function load() {
    setLoading(true);
    setError(null);
    api
      .getExceptions(batchId)
      .then(setExceptions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleResolve(matchId, decision) {
    setResolvingId(matchId);
    try {
      await api.resolveMatch(matchId, decision);
      setExceptions((prev) => prev.filter((e) => e._id !== matchId));
    } catch (err) {
      setError(err.message);
    } finally {
      setResolvingId(null);
    }
  }

  if (!batchId) {
    return (
      <EmptyState
        title="No batch selected"
        description="Upload a batch first, then review anything that couldn't be auto-resolved here."
        action={
          <Link to="/upload" className="text-sm font-medium text-accent hover:text-accent-hover inline-flex items-center gap-1">
            Upload a batch <ArrowUpRight size={14} />
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Exceptions</h1>
        <p className="text-sm text-subtle mt-1">
          Orders that need a human decision before they're marked resolved.
        </p>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}

      {loading ? (
        <SkeletonRows count={6} />
      ) : exceptions.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg">
          <EmptyState
            title="No exceptions to review"
            description="Everything in this batch was either auto-resolved or already reviewed."
          />
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-2.5 font-medium text-xs text-subtle">Match type</th>
                <th className="px-4 py-2.5 font-medium text-xs text-subtle">Confidence</th>
                <th className="px-4 py-2.5 font-medium text-xs text-subtle">Recommended action</th>
                <th className="px-4 py-2.5 font-medium text-xs text-subtle">Explanation</th>
                <th className="px-4 py-2.5 font-medium text-xs text-subtle text-right">Decision</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((ex) => (
                <tr key={ex._id} className="border-b border-line last:border-0 hover:bg-paper/60 transition-colors">
                  <td className="px-4 py-3 align-top">
                    <MatchTypeBadge type={ex.matchType} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ConfidenceBar value={ex.confidence} size="small" />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ActionBadge action={ex.recommendedAction} />
                    {ex.missingFields?.length > 0 && (
                      <p className="text-xs text-subtle mt-1 font-mono">missing: {ex.missingFields.join(", ")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top max-w-sm">
                    <p className="text-sm text-ink">{ex.explanation}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleResolve(ex._id, "approve")}
                        disabled={resolvingId === ex._id}
                        aria-label="Approve"
                        className="w-7 h-7 rounded flex items-center justify-center border border-line text-success hover:bg-success-soft hover:border-success/30 transition-colors disabled:opacity-50"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => handleResolve(ex._id, "reject")}
                        disabled={resolvingId === ex._id}
                        aria-label="Reject"
                        className="w-7 h-7 rounded flex items-center justify-center border border-line text-danger hover:bg-danger-soft hover:border-danger/30 transition-colors disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
