/**
 * Badges for matchType and recommendedAction. Deliberately text + color only
 * - no icon-per-status system, which is a common AI-dashboard tell (an icon
 * library used for its own sake rather than because it clarifies anything).
 * A reader scans these as fast as icons once the color-to-meaning mapping is
 * learned once, and it keeps the table calmer.
 */

const MATCH_TYPE_STYLES = {
  exact: "bg-success-soft text-success",
  fuzzy: "bg-warning-soft text-warning",
  split: "bg-accent-soft text-accent",
  none: "bg-line text-subtle",
};

const MATCH_TYPE_LABELS = {
  exact: "Exact",
  fuzzy: "Fuzzy",
  split: "Split",
  none: "Unmatched",
};

export function MatchTypeBadge({ type }) {
  const style = MATCH_TYPE_STYLES[type] || MATCH_TYPE_STYLES.none;
  const label = MATCH_TYPE_LABELS[type] || type;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

const BATCH_STATUS_STYLES = {
  complete: "bg-success-soft text-success",
  processing: "bg-accent-soft text-accent",
  failed: "bg-danger-soft text-danger",
};

const BATCH_STATUS_LABELS = {
  complete: "Complete",
  processing: "Processing",
  failed: "Failed",
};

export function BatchStatusBadge({ status }) {
  const style = BATCH_STATUS_STYLES[status] || "bg-line text-subtle";
  const label = BATCH_STATUS_LABELS[status] || status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
const ACTION_STYLES = {
  auto_resolve: "bg-success-soft text-success",
  escalate_high_value: "bg-danger-soft text-danger",
  request_more_data: "bg-accent-soft text-accent",
  flag_for_review: "bg-warning-soft text-warning",
};

const ACTION_LABELS = {
  auto_resolve: "Auto-resolved",
  escalate_high_value: "Escalated — high value",
  request_more_data: "Needs more data",
  flag_for_review: "Flagged for review",
};

export function ActionBadge({ action }) {
  const style = ACTION_STYLES[action] || "bg-line text-subtle";
  const label = ACTION_LABELS[action] || action;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
