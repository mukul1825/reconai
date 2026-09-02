import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentBatch } from "../api/useCurrentBatch";
import { ArrowUpRight } from "lucide-react";
import { api } from "../api/client";
import { SkeletonRows, EmptyState, ErrorBanner } from "../components/States";
import RecentBatches from "../components/RecentBatches";

function StatCard({ label, value, sublabel, tone = "default" }) {
  const toneClass = {
    default: "text-ink",
    success: "text-success",
    warning: "text-warning",
  }[tone];

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <p className="text-xs text-subtle font-medium">{label}</p>
      <p className={`stat-number text-2xl font-semibold mt-1.5 ${toneClass}`}>{value}</p>
      {sublabel && <p className="text-xs text-subtle mt-1">{sublabel}</p>}
    </div>
  );
}

/**
 * The dashboard's one hero number - match rate. Everything else on this
 * page is supporting detail; this is the number a recruiter (or a real
 * ops lead) should be able to read from across the room. The fill bar
 * beneath it deliberately echoes ConfidenceBar's visual language (same
 * track/fill shape, same color-band logic) rather than introducing a new
 * chart type - one signature device, reused, not a second one invented.
 */
function HeroStat({ matchRate }) {
  let fillColor = "bg-danger";
  if (matchRate >= 90) fillColor = "bg-success";
  else if (matchRate >= 50) fillColor = "bg-warning";

  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <p className="text-xs text-subtle font-medium">Match rate</p>
      <p className="stat-number text-4xl sm:text-5xl font-semibold text-ink mt-1.5 leading-none">
        {matchRate}%
      </p>
      <div className="h-1.5 rounded-full bg-line overflow-hidden mt-4 max-w-xs">
        <div
          className={`h-1.5 ${fillColor} rounded-full transition-all`}
          style={{ width: `${matchRate}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The match-type breakdown as one stacked horizontal bar, not a pie chart.
 * A stacked bar reads left-to-right in reading order and makes proportion
 * comparison direct (compare widths) rather than asking the eye to compare
 * wedge angles - the right chart for "what share of orders resolved how."
 */
function MatchTypeBar({ byMatchType, total }) {
  const segments = [
    { key: "exact", label: "Exact", color: "bg-success" },
    { key: "fuzzy", label: "Fuzzy", color: "bg-warning" },
    { key: "split", label: "Split", color: "bg-accent" },
    { key: "none", label: "Unmatched", color: "bg-line" },
  ];

  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-line">
        {segments.map((seg) => {
          const count = byMatchType[seg.key] || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;
          return <div key={seg.key} className={seg.color} style={{ width: `${pct}%` }} />;
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {segments.map((seg) => {
          const count = byMatchType[seg.key] || 0;
          return (
            <div key={seg.key} className="flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${seg.color}`} />
              <span className="text-subtle">{seg.label}</span>
              <span className="font-mono text-ink">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const batchId = useCurrentBatch();
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!batchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .getBatch(batchId)
      .then(setBatch)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [batchId]);

  if (!batchId) {
    return (
      <div>
        <EmptyState
          title="No batch selected"
          description="Upload a batch to see reconciliation results here."
          action={
            <Link
              to="/upload"
              className="text-sm font-medium text-accent hover:text-accent-hover inline-flex items-center gap-1"
            >
              Upload a batch <ArrowUpRight size={14} />
            </Link>
          }
        />
        <RecentBatches currentBatchId={null} />
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-line/50 animate-pulse" />
            ))}
          </div>
          <SkeletonRows count={3} />
        </div>
        <RecentBatches currentBatchId={batchId} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <ErrorBanner message={error} />
        <RecentBatches currentBatchId={batchId} />
      </div>
    );
  }

  const { totals, matchRate } = batch;
  const totalOrders = totals.autoResolved + totals.pendingReview + totals.resolved + totals.rejected;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Batch summary</h1>
          <p className="text-xs font-mono text-subtle mt-1">{batchId}</p>
        </div>
        <Link
          to="/exceptions"
          className="text-sm font-medium text-accent hover:text-accent-hover inline-flex items-center gap-1"
        >
          Review exceptions <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="mb-3">
        <HeroStat matchRate={matchRate} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Auto-resolved" value={totals.autoResolved} tone="success" />
        <StatCard label="Needs review" value={totals.pendingReview} tone="warning" />
        <StatCard label="Total orders" value={totalOrders} />
      </div>

      <div className="bg-surface border border-line rounded-lg p-4">
        <p className="text-xs font-medium text-subtle mb-3">Resolution by match type</p>
        <MatchTypeBar byMatchType={batch.byMatchType || {}} total={totalOrders} />
      </div>

      <RecentBatches currentBatchId={batchId} />
    </div>
  );
}
