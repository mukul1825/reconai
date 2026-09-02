import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentBatch } from "../api/useCurrentBatch";
import { ArrowUpRight } from "lucide-react";
import { api } from "../api/client";
import ConfidenceBar from "../components/ConfidenceBar";
import { ActionBadge } from "../components/Badges";
import { SkeletonRows, TableSkeleton, EmptyState, ErrorBanner } from "../components/States";

// Only for events that AREN'T one of the 4 decision-policy actions
// (auto_resolve / escalate_high_value / request_more_data / flag_for_review)
// - those render as the same ActionBadge used on the Exceptions page, so a
// batch's audit trail and its exceptions queue never disagree about what a
// given decision was called.
const EVENT_LABELS = {
  batch_uploaded: "Batch uploaded",
  batch_processed: "Batch processed",
  human_approved: "Approved",
  human_rejected: "Rejected",
};

const DECISION_ACTIONS = new Set([
  "auto_resolve",
  "escalate_high_value",
  "request_more_data",
  "flag_for_review",
]);

function EventCell({ event }) {
  if (DECISION_ACTIONS.has(event)) {
    return <ActionBadge action={event} />;
  }
  return <span className="text-ink">{EVENT_LABELS[event] || event}</span>;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditTrailPage() {
  const batchId = useCurrentBatch();
  const [logs, setLogs] = useState([]);
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
      .getAudit(batchId)
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [batchId]);

  if (!batchId) {
    return (
      <EmptyState
        title="No batch selected"
        description="Every automatic and human decision is logged here once you run a batch."
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
        <h1 className="text-lg font-semibold tracking-tight">Audit trail</h1>
        <p className="text-sm text-subtle mt-1">
          Every decision this batch made, automatic or human, in order.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <TableSkeleton rows={8} columnWidths={["w-24", "w-28", "w-20", "w-16"]} />
      ) : logs.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg">
          <EmptyState title="No audit entries yet" />
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-2.5 font-medium text-xs text-subtle">Time</th>
                <th className="px-4 py-2.5 font-medium text-xs text-subtle">Event</th>
                <th className="px-4 py-2.5 font-medium text-xs text-subtle">Actor</th>
                <th className="px-4 py-2.5 font-medium text-xs text-subtle">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-b border-line last:border-0 hover:bg-paper/60 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-subtle whitespace-nowrap">
                    {formatTime(log.timestamp)}
                  </td>
                  <td className="px-4 py-2.5">
                    <EventCell event={log.event} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-subtle">{log.actor}</td>
                  <td className="px-4 py-2.5">
                    {log.confidence != null ? <ConfidenceBar value={log.confidence} size="small" /> : <span className="text-subtle text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
